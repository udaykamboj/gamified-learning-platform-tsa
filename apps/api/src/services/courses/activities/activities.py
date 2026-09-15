from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.courses.courses import Course
from src.db.courses.chapters import Chapter
from src.db.courses.activities import Activity, ActivityRead
from src.db.courses.chapter_activities import ChapterActivity
from src.db.users import AnonymousUser, PublicUser, User
from fastapi import HTTPException, Request

import logging

from src.core.ee_hooks import check_ee_activity_paid_access
from src.security.rbac import check_resource_access, AccessAction
from src.services.courses.locks import is_course_content_locked

logger = logging.getLogger(__name__)

# Module-level set to hold strong references to background embedding tasks,
# preventing them from being garbage-collected before they complete.
_embedding_tasks: set = set()


####################################################
# CRUD
####################################################


async def get_activity(
    request: Request,
    activity_uuid: str,
    current_user: PublicUser,
    db_session: AsyncSession,
):
    # Optimize by joining Activity with Course and last modified user in a single query
    statement = (
        select(Activity, Course, User)
        .join(Course)
        .outerjoin(User, Activity.last_modified_by_id == User.id)
        .where(Activity.activity_uuid == activity_uuid)
    )
    result = (await db_session.execute(statement)).first()

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Activity not found",
        )

    activity, course, last_modified_user = result

    # RBAC check
    await check_resource_access(request, db_session, current_user, course.course_uuid, AccessAction.READ)

    # Paid access check (via EE hook with fallback to True if EE not available)
    has_paid_access = await check_ee_activity_paid_access(
        request=request,
        activity_id=activity.id,
        user=current_user,
        db_session=db_session
    )

    activity_read = ActivityRead.model_validate(activity)
    activity_read.content = activity_read.content if has_paid_access else { "paid_access": False }
    # Include last modified user info
    activity_read.last_modified_by_username = last_modified_user.username if last_modified_user else None

    await _apply_activity_lock(activity_read, activity, course, current_user, db_session)

    return activity_read


async def _apply_activity_lock(
    activity_read: ActivityRead,
    activity: Activity,
    course: Course,
    current_user,
    db_session: AsyncSession,
) -> None:
    """Scrub the activity's content until the caller has enrolled in the course.

    The client renders an "enroll to continue" gate for ``is_locked=True``.
    See ``services/courses/locks.py``.
    """
    if await is_course_content_locked(course.id, course.org_id, current_user, db_session):
        activity_read.content = {}
        activity_read.details = None
        activity_read.is_locked = True

async def get_activityby_id(
    request: Request,
    activity_id: int,
    current_user: PublicUser,
    db_session: AsyncSession,
):
    # Optimize by joining Activity with Course in a single query
    statement = (
        select(Activity, Course)
        .join(Course)
        .where(Activity.id == activity_id)
    )
    result = (await db_session.execute(statement)).first()

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Activity not found",
        )

    activity, course = result

    # RBAC check
    await check_resource_access(request, db_session, current_user, course.course_uuid, AccessAction.READ)

    return ActivityRead.model_validate(activity)


####################################################
# Misc
####################################################


async def get_activities(
    request: Request,
    coursechapter_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> list[ActivityRead]:
    # Single query joining Activity, Chapter, and Course to avoid 3 sequential queries
    statement = (
        select(Activity, Chapter, Course)
        .join(ChapterActivity, Activity.id == ChapterActivity.activity_id)
        .join(Chapter, ChapterActivity.chapter_id == Chapter.id)
        .join(Course, Chapter.course_id == Course.id)
        .where(
            ChapterActivity.chapter_id == coursechapter_id,
            Activity.published == True,
        )
    )
    results = (await db_session.execute(statement)).all()

    if not results:
        raise HTTPException(
            status_code=404,
            detail="No published activities found",
        )

    _, chapter, course = results[0]
    await check_resource_access(request, db_session, current_user, course.course_uuid, AccessAction.READ)

    return [ActivityRead.model_validate(activity) for activity, _, _ in results]
