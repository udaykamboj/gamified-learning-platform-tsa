"""Sync the platform-authored catalog into the database.

Courses are the product's content, not something anyone builds in the admin
dashboard (docs/refactor/progress/00-requirements.md, R6, R7). They live as
JSON files in ``src/content/catalog/courses``, written in the block DSL of
``content.py``, and this module upserts them into the existing course tables so
the course pages, enrollment, progress, auto-graded assignments, analytics and
Q&A keep using their normal models.

The sync also creates the platform-wide Community and each course's Q&A space.

Every row gets a UUID derived from its slug, so running the sync again updates
rows in place (student progress and discussions survive) and does nothing when
nothing changed. It runs on every boot (``core/events/autoinstall.py``) and from
``python cli.py sync-platform-content``.

Courses in the database that are not in the catalog (for example ones authored
in the dashboard before this refactor) are unpublished, not deleted, so their
enrollment and progress history is kept.
"""

import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.content.catalog.content import compile_document
from src.db.courses.activities import Activity, ActivitySubTypeEnum, ActivityTypeEnum
from src.db.courses.assignments import (
    Assignment,
    AssignmentTask,
    AssignmentTaskTypeEnum,
    GradingTypeEnum,
    SolutionRevealEnum,
)
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.course_chapters import CourseChapter
from src.db.courses.courses import Course, ThumbnailType

logger = logging.getLogger(__name__)

CATALOG_DIR = Path(__file__).parent / "courses"
_NAMESPACE = uuid.UUID("3b1f8a52-6c1e-5d6a-9f7e-2a4c9b0d7e11")

PLATFORM_COMMUNITY = {
    "key": "community",
    "name": "Community",
    "description": "Ask questions, help each other and share what you're building.",
}

# Practice and unit-test behaviour: instant score, unlimited tries, no deadline.
_ROLE_SETTINGS = {
    "practice": {
        "pass_threshold_percentage": 70.0,
        "solution_reveal": SolutionRevealEnum.ON_SUBMISSION,
    },
    "assessment": {
        "pass_threshold_percentage": 80.0,
        "solution_reveal": SolutionRevealEnum.AFTER_GRADING,
    },
}


def stable_uuid(prefix: str, *parts: str) -> str:
    return f"{prefix}_{uuid.uuid5(_NAMESPACE, '|'.join(parts))}"


def _now() -> str:
    return str(datetime.now())


def _apply(instance: Any, **fields: Any) -> bool:
    """Assign only the fields that differ. Returns True if anything changed."""
    changed = False
    for name, value in fields.items():
        if getattr(instance, name) != value:
            setattr(instance, name, value)
            changed = True
    return changed


@dataclass
class SyncStats:
    created: int = 0
    updated: int = 0
    removed: int = 0
    retired_courses: list[str] = field(default_factory=list)


def load_catalog() -> list[dict]:
    """All catalog courses, in catalog order."""
    courses = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(CATALOG_DIR.glob("*.json"))]
    return sorted(courses, key=lambda c: (c.get("order", 0), c["slug"]))


def _quiz_contents(task_slug: str, questions: list[dict]) -> dict:
    """Catalog quiz questions -> the assignment QUIZ task schema the grader reads."""
    return {
        "questions": [
            {
                "questionUUID": stable_uuid("question", task_slug, q["q"]),
                "questionText": q["q"],
                "options": [
                    {
                        "optionUUID": stable_uuid("option", task_slug, q["q"], text),
                        "text": text,
                        "type": "text",
                        "fileID": "",
                        "assigned_right_answer": bool(correct),
                    }
                    for text, correct in q["a"]
                ],
            }
            for q in questions
        ]
    }


async def sync_platform_content(db_session: AsyncSession) -> SyncStats:
    """Upsert the catalog into the platform organization."""
    from src.services.communities.communities import ensure_community
    from src.services.orgs.platform import find_platform_org

    stats = SyncStats()
    org = await find_platform_org(db_session)
    if org is None or org.id is None:
        logger.info("Catalog sync skipped: the platform organization is not installed yet")
        return stats

    await ensure_community(
        db_session,
        org_id=org.id,
        community_uuid=stable_uuid("community", org.org_uuid, PLATFORM_COMMUNITY["key"]),
        name=PLATFORM_COMMUNITY["name"],
        description=PLATFORM_COMMUNITY["description"],
    )

    catalog_uuids: set[str] = set()
    for position, spec in enumerate(load_catalog()):
        course = await _sync_course(db_session, org.id, spec, position, stats)
        catalog_uuids.add(course.course_uuid)
        await ensure_community(
            db_session,
            org_id=org.id,
            community_uuid=stable_uuid("community", course.course_uuid, "qa"),
            name=f"{course.name} Q&A",
            description=f"Questions and answers about {course.name}",
            course_id=course.id,
        )

    # Retire courses that aren't platform content.
    stale = (
        await db_session.execute(
            select(Course).where(Course.org_id == org.id, Course.published == True)  # noqa: E712
        )
    ).scalars().all()
    for course in stale:
        if course.course_uuid not in catalog_uuids:
            course.published = False
            course.update_date = _now()
            db_session.add(course)
            stats.retired_courses.append(course.course_uuid)

    await db_session.commit()

    from src.services.courses.cache import invalidate_course_meta_cache, invalidate_courses_cache

    try:  # cache is best-effort
        invalidate_courses_cache(org.slug)
        for course_uuid in catalog_uuids | set(stats.retired_courses):
            invalidate_course_meta_cache(course_uuid)
    except Exception:
        pass

    return stats


async def _sync_course(
    db_session: AsyncSession, org_id: int, spec: dict, position: int, stats: SyncStats
) -> Course:
    course_uuid = stable_uuid("course", spec["slug"])
    course = (
        await db_session.execute(select(Course).where(Course.course_uuid == course_uuid))
    ).scalars().first()
    fields = dict(
        name=spec["name"],
        description=spec.get("description", ""),
        about=spec.get("about", ""),
        learnings=spec.get("learnings", ""),
        tags=spec.get("tags", ""),
        public=True,
        published=True,
        open_to_contributors=False,
        org_id=org_id,
        extra_metadata={"catalog_slug": spec["slug"], "catalog_order": position},
    )
    if course is None:
        course = Course(
            course_uuid=course_uuid,
            thumbnail_type=ThumbnailType.IMAGE,
            thumbnail_image="",
            thumbnail_video="",
            creation_date=_now(),
            update_date=_now(),
            **fields,
        )
        db_session.add(course)
        await db_session.flush()
        stats.created += 1
    elif _apply(course, **fields):
        course.update_date = _now()
        db_session.add(course)
        stats.updated += 1

    wanted_chapters: set[int] = set()
    wanted_activities: set[int] = set()
    for order, chapter_spec in enumerate(spec.get("chapters", [])):
        chapter = await _sync_chapter(db_session, course, chapter_spec, order, stats)
        wanted_chapters.add(chapter.id)
        for activity_order, activity_spec in enumerate(chapter_spec.get("activities", [])):
            activity = await _sync_activity(db_session, course, chapter, activity_spec, activity_order, stats)
            wanted_activities.add(activity.id)

    # Content removed from the catalog leaves the course.
    removed_activities = (
        await db_session.execute(
            select(Activity).where(Activity.course_id == course.id, Activity.id.not_in(wanted_activities or {0}))
        )
    ).scalars().all()
    for activity in removed_activities:
        await db_session.delete(activity)
        stats.removed += 1
    removed_chapters = (
        await db_session.execute(
            select(Chapter).where(Chapter.course_id == course.id, Chapter.id.not_in(wanted_chapters or {0}))
        )
    ).scalars().all()
    for chapter in removed_chapters:
        await db_session.delete(chapter)
        stats.removed += 1
    await db_session.flush()
    return course


async def _sync_chapter(
    db_session: AsyncSession, course: Course, spec: dict, order: int, stats: SyncStats
) -> Chapter:
    chapter_uuid = stable_uuid("chapter", spec["slug"])
    chapter = (
        await db_session.execute(select(Chapter).where(Chapter.chapter_uuid == chapter_uuid))
    ).scalars().first()
    fields = dict(
        name=spec["name"],
        description=spec.get("description", ""),
        org_id=course.org_id,
        course_id=course.id,
    )
    if chapter is None:
        chapter = Chapter(
            chapter_uuid=chapter_uuid,
            thumbnail_image="",
            creation_date=_now(),
            update_date=_now(),
            **fields,
        )
        db_session.add(chapter)
        await db_session.flush()
        stats.created += 1
    elif _apply(chapter, **fields):
        chapter.update_date = _now()
        db_session.add(chapter)
        stats.updated += 1

    link = (
        await db_session.execute(
            select(CourseChapter).where(
                CourseChapter.course_id == course.id, CourseChapter.chapter_id == chapter.id
            )
        )
    ).scalars().first()
    if link is None:
        db_session.add(
            CourseChapter(
                course_id=course.id,
                chapter_id=chapter.id,
                org_id=course.org_id,
                order=order,
                creation_date=_now(),
                update_date=_now(),
            )
        )
    elif _apply(link, order=order):
        link.update_date = _now()
        db_session.add(link)
    return chapter


_ACTIVITY_TYPES = {
    "document": (ActivityTypeEnum.TYPE_DYNAMIC, ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE),
    "video": (ActivityTypeEnum.TYPE_VIDEO, ActivitySubTypeEnum.SUBTYPE_VIDEO_YOUTUBE),
    "assignment": (ActivityTypeEnum.TYPE_ASSIGNMENT, ActivitySubTypeEnum.SUBTYPE_ASSIGNMENT_ANY),
}


async def _sync_activity(
    db_session: AsyncSession,
    course: Course,
    chapter: Chapter,
    spec: dict,
    order: int,
    stats: SyncStats,
) -> Activity:
    from src.services.courses.activities.learning import LEARNING_ROLE_KEY

    kind = spec["kind"]
    activity_type, activity_sub_type = _ACTIVITY_TYPES[kind]
    if kind == "document":
        content = compile_document(spec.get("body", []))
        details = None
    elif kind == "video":
        content = {"youtube_id": spec["youtube_id"]}
        details = None
    else:
        content = {}
        details = {LEARNING_ROLE_KEY: spec["assignment"]["role"]}

    activity_uuid = stable_uuid("activity", spec["slug"])
    activity = (
        await db_session.execute(select(Activity).where(Activity.activity_uuid == activity_uuid))
    ).scalars().first()
    fields = dict(
        name=spec["name"],
        activity_type=activity_type,
        activity_sub_type=activity_sub_type,
        content=content,
        details=details,
        published=True,
        org_id=course.org_id,
        course_id=course.id,
    )
    if activity is None:
        activity = Activity(
            activity_uuid=activity_uuid,
            creation_date=_now(),
            update_date=_now(),
            **fields,
        )
        db_session.add(activity)
        await db_session.flush()
        stats.created += 1
    elif _apply(activity, **fields):
        activity.update_date = _now()
        db_session.add(activity)
        stats.updated += 1

    # An activity belongs to exactly one chapter.
    await db_session.execute(
        delete(ChapterActivity).where(
            ChapterActivity.activity_id == activity.id, ChapterActivity.chapter_id != chapter.id
        )
    )
    link = (
        await db_session.execute(
            select(ChapterActivity).where(
                ChapterActivity.chapter_id == chapter.id, ChapterActivity.activity_id == activity.id
            )
        )
    ).scalars().first()
    if link is None:
        db_session.add(
            ChapterActivity(
                chapter_id=chapter.id,
                activity_id=activity.id,
                course_id=course.id,
                org_id=course.org_id,
                order=order,
                creation_date=_now(),
                update_date=_now(),
            )
        )
    elif _apply(link, order=order):
        link.update_date = _now()
        db_session.add(link)

    if kind == "assignment":
        await _sync_assignment(db_session, course, chapter, activity, spec["assignment"], stats)
    return activity


async def _sync_assignment(
    db_session: AsyncSession,
    course: Course,
    chapter: Chapter,
    activity: Activity,
    spec: dict,
    stats: SyncStats,
) -> None:
    role_settings = _ROLE_SETTINGS[spec["role"]]
    assignment_uuid = stable_uuid("assignment", activity.activity_uuid)
    assignment = (
        await db_session.execute(select(Assignment).where(Assignment.assignment_uuid == assignment_uuid))
    ).scalars().first()
    fields = dict(
        title=spec["title"],
        description=spec.get("description", ""),
        due_date=None,
        published=True,
        grading_type=GradingTypeEnum.PERCENTAGE,
        auto_grading=True,
        show_correct_answers=True,
        allow_retries=True,
        max_retries=0,
        ungraded=False,
        org_id=course.org_id,
        course_id=course.id,
        chapter_id=chapter.id,
        activity_id=activity.id,
        **role_settings,
    )
    if assignment is None:
        assignment = Assignment(
            assignment_uuid=assignment_uuid,
            creation_date=_now(),
            update_date=_now(),
            **fields,
        )
        db_session.add(assignment)
        await db_session.flush()
        stats.created += 1
    elif _apply(assignment, **fields):
        assignment.update_date = _now()
        db_session.add(assignment)
        stats.updated += 1

    wanted_tasks: set[int] = set()
    for task_spec in spec.get("tasks", []):
        task_uuid = stable_uuid("assignmenttask", task_spec["slug"])
        task = (
            await db_session.execute(
                select(AssignmentTask).where(AssignmentTask.assignment_task_uuid == task_uuid)
            )
        ).scalars().first()
        task_fields = dict(
            title=task_spec["title"],
            description=task_spec.get("description", ""),
            hint=task_spec.get("hint", ""),
            assignment_type=AssignmentTaskTypeEnum.QUIZ,
            contents=_quiz_contents(task_spec["slug"], task_spec["questions"]),
            max_grade_value=task_spec.get("max_grade_value", 100),
            assignment_id=assignment.id,
            org_id=course.org_id,
            course_id=course.id,
            chapter_id=chapter.id,
            activity_id=activity.id,
        )
        if task is None:
            task = AssignmentTask(
                assignment_task_uuid=task_uuid,
                reference_file="",
                creation_date=_now(),
                update_date=_now(),
                **task_fields,
            )
            db_session.add(task)
            await db_session.flush()
            stats.created += 1
        elif _apply(task, **task_fields):
            task.update_date = _now()
            db_session.add(task)
            stats.updated += 1
        wanted_tasks.add(task.id)

    stale_tasks = (
        await db_session.execute(
            select(AssignmentTask).where(
                AssignmentTask.assignment_id == assignment.id,
                AssignmentTask.id.not_in(wanted_tasks or {0}),
            )
        )
    ).scalars().all()
    for task in stale_tasks:
        await db_session.delete(task)
        stats.removed += 1
