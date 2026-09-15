from typing import List
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.db.courses.course_chapters import CourseChapter
from src.db.courses.activities import Activity, ActivityRead
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import (
    Chapter,
    ChapterRead,
)
from src.db.courses.courses import Course
from fastapi import HTTPException, status, Request
from src.security.rbac import check_resource_access, AccessAction
from src.services.courses.locks import is_course_content_locked


####################################################
# CRUD
####################################################


async def get_chapter(
    request: Request,
    chapter_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> ChapterRead:
    # Fetch Chapter and Course in one query to avoid two sequential round-trips
    statement = (
        select(Chapter, Course)
        .outerjoin(Course, Course.id == Chapter.course_id)
        .where(Chapter.id == chapter_id)
    )
    result = (await db_session.execute(statement)).first()

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chapter does not exist"
        )

    chapter, course = result

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course does not exist"
        )

    # RBAC check
    await check_resource_access(request, db_session, current_user, course.course_uuid, AccessAction.READ)

    # Get activities for this chapter
    statement = (
        select(Activity)
        .join(ChapterActivity, Activity.id == ChapterActivity.activity_id) # type: ignore
        .where(ChapterActivity.chapter_id == chapter_id)
        .distinct(Activity.id) # type: ignore
    )

    activities = (await db_session.execute(statement)).scalars().all()

    chapter = ChapterRead(
        **chapter.model_dump(),
        activities=[ActivityRead(**activity.model_dump()) for activity in activities],
    )

    await _apply_locks_to_chapters([chapter], course, current_user, db_session)

    return chapter


async def get_course_chapters(
    request: Request,
    course_id: int,
    db_session: AsyncSession,
    current_user: PublicUser | AnonymousUser,
    with_unpublished_activities: bool,
    page: int = 1,
    limit: int = 10,
    slim: bool = False,
    course: "Course | None" = None,
) -> List[ChapterRead]:

    # Skip the duplicate Course lookup when the caller (e.g. get_course_meta)
    # already has the course in hand.
    if course is None:
        statement = select(Course).where(Course.id == course_id)
        course = (await db_session.execute(statement)).scalars().first()

    # A non-existent course_id (e.g. from the public
    # /chapters/course/{course_id}/page/... endpoint) must return a clean 404.
    # Without this guard the RBAC check below dereferences course.course_uuid
    # on None and the request 500s instead.
    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course does not exist"
        )

    statement = (
        select(Chapter)
        .join(CourseChapter, Chapter.id == CourseChapter.chapter_id) # type: ignore
        .where(CourseChapter.course_id == course_id)
        .where(Chapter.course_id == course_id)
        .order_by(CourseChapter.order) # type: ignore
        .group_by(Chapter.id, CourseChapter.order) # type: ignore
    )
    chapters = (await db_session.execute(statement)).scalars().all()

    chapters = [ChapterRead(**chapter.model_dump(), activities=[]) for chapter in chapters]

    # RBAC check — cheap when the caller already ran it on this request
    # (the checker is memoized on request.state).
    await check_resource_access(request, db_session, current_user, course.course_uuid, AccessAction.READ)  # type: ignore

    chapter_ids = [chapter.id for chapter in chapters]
    if chapter_ids:
        if slim:
            # SQL-level slim: project only the navigation columns. Activity.content
            # (TipTap JSON) and Activity.details can be very large; excluding them
            # from the SELECT is the biggest single win for course-tree payload.
            activity_statement = (
                select(
                    ChapterActivity.chapter_id,
                    Activity.id,
                    Activity.org_id,
                    Activity.course_id,
                    Activity.name,
                    Activity.activity_type,
                    Activity.activity_sub_type,
                    Activity.activity_uuid,
                    Activity.published,
                    Activity.creation_date,
                    Activity.update_date,
                    Activity.current_version,
                    Activity.last_modified_by_id,
                    Activity.lock_type,
                    ChapterActivity.order,
                )
                .join(Activity, Activity.id == ChapterActivity.activity_id)  # type: ignore
                .where(ChapterActivity.chapter_id.in_(chapter_ids))  # type: ignore
                .order_by(ChapterActivity.chapter_id, ChapterActivity.order)  # type: ignore
            )
            if not with_unpublished_activities:
                activity_statement = activity_statement.where(Activity.published == True)

            rows = (await db_session.execute(activity_statement)).all()

            chapter_activities_map: dict[int, list[ActivityRead]] = {}
            seen: set[tuple[int, int]] = set()
            for row in rows:
                (
                    chapter_id_val,
                    a_id,
                    a_org_id,
                    a_course_id,
                    a_name,
                    a_type,
                    a_sub_type,
                    a_uuid,
                    a_published,
                    a_creation,
                    a_update,
                    a_version,
                    a_last_modified_by,
                    a_lock_type,
                    _order,
                ) = row
                key = (chapter_id_val, a_id)
                if key in seen:
                    continue
                seen.add(key)
                chapter_activities_map.setdefault(chapter_id_val, []).append(
                    ActivityRead(
                        id=a_id,
                        org_id=a_org_id,
                        course_id=a_course_id,
                        name=a_name,
                        activity_type=a_type,
                        activity_sub_type=a_sub_type,
                        content={},
                        details=None,
                        published=a_published,
                        activity_uuid=a_uuid,
                        creation_date=a_creation,
                        update_date=a_update,
                        current_version=a_version,
                        last_modified_by_id=a_last_modified_by,
                        lock_type=a_lock_type,
                    )
                )
        else:
            activity_statement = (
                select(ChapterActivity, Activity)
                .join(Activity, Activity.id == ChapterActivity.activity_id)  # type: ignore
                .where(ChapterActivity.chapter_id.in_(chapter_ids))  # type: ignore
                .order_by(ChapterActivity.chapter_id, ChapterActivity.order)  # type: ignore
            )
            if not with_unpublished_activities:
                activity_statement = activity_statement.where(Activity.published == True)

            activity_results = (await db_session.execute(activity_statement)).all()

            chapter_activities_map = {}
            seen = set()
            for chapter_activity, activity in activity_results:
                key = (chapter_activity.chapter_id, activity.id)
                if key in seen:
                    continue
                seen.add(key)
                chapter_activities_map.setdefault(chapter_activity.chapter_id, []).append(
                    ActivityRead(**activity.model_dump())
                )

        for chapter in chapters:
            chapter.activities = chapter_activities_map.get(chapter.id, [])

    await _apply_locks_to_chapters(chapters, course, current_user, db_session)

    return chapters


async def _apply_locks_to_chapters(
    chapters: List[ChapterRead],
    course: "Course | None",
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> None:
    """Strip activity content until the caller has enrolled in the course.

    The outline (chapter and activity names) stays visible so students can
    decide whether to enroll. See ``services/courses/locks.py``.
    """
    if not chapters or course is None:
        return

    locked = await is_course_content_locked(course.id, course.org_id, current_user, db_session)
    for chapter in chapters:
        chapter.is_locked = locked
        for activity in chapter.activities:
            activity.is_locked = locked
            if locked:
                activity.content = {}
                activity.details = None


# Important Note : this is legacy code that has been used because
# the frontend is still not adapted for the new data structure, this implementation is absolutely not the best one
# and should not be used for future features
async def DEPRECEATED_get_course_chapters(
    request: Request,
    course_uuid: str,
    current_user: PublicUser,
    db_session: AsyncSession,
):
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = (await db_session.execute(statement)).scalars().first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course does not exist"
        )

    # RBAC check
    await check_resource_access(request, db_session, current_user, course.course_uuid, AccessAction.READ)

    chapters_in_db = await get_course_chapters(request, course.id, db_session, current_user)  # type: ignore

    # activities

    # chapters
    chapters = {}

    for chapter in chapters_in_db:
        chapter_activityIds = []

        for activity in chapter.activities:
            chapter_activityIds.append(activity.activity_uuid)

        chapters[chapter.chapter_uuid] = {
            "uuid": chapter.chapter_uuid,
            "id": chapter.id,
            "name": chapter.name,
            "activityIds": chapter_activityIds,
        }

    # activities
    activities_list = {}
    statement = (
        select(Activity)
        .join(ChapterActivity, ChapterActivity.activity_id == Activity.id) # type: ignore
        .where(ChapterActivity.activity_id == Activity.id)
        .group_by(Activity.id) # type: ignore
    )
    activities_in_db = (await db_session.execute(statement)).scalars().all()

    for activity in activities_in_db:
        activities_list[activity.activity_uuid] = {
            "uuid": activity.activity_uuid,
            "id": activity.id,
            "name": activity.name,
            "type": activity.activity_type,
            "content": activity.content,
        }

    # get chapter order
    statement = (
        select(Chapter)
        .join(CourseChapter, CourseChapter.chapter_id == Chapter.id) # type: ignore
        .where(CourseChapter.chapter_id == Chapter.id)
        .group_by(Chapter.id, CourseChapter.order) # type: ignore
        .order_by(CourseChapter.order) # type: ignore
    )
    chapters_in_db = (await db_session.execute(statement)).scalars().all()

    chapterOrder = []

    for chapter in chapters_in_db:
        chapterOrder.append(chapter.chapter_uuid)

    final = {
        "chapters": chapters,
        "chapterOrder": chapterOrder,
        "activities": activities_list,
    }

    return final


