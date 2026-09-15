from typing import List
from fastapi import HTTPException, Request, status
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.courses.course_updates import (
    CourseUpdate,
    CourseUpdateRead,
)
from src.db.courses.courses import Course
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac import check_resource_access, AccessAction


# Get Course Updates by Course ID
async def get_updates_by_course_uuid(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> List[CourseUpdateRead]:
    # FInd if course exists
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = (await db_session.execute(statement)).scalars().first()

    if not course or course.id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Course does not exist"
        )

    # RBAC check — course updates inherit the course's visibility. Without this
    # any caller (including anonymous users) could read the update feed of a
    # private / unpublished course just by knowing its uuid.
    await check_resource_access(request, db_session, current_user, course.course_uuid, AccessAction.READ)

    statement = (
        select(CourseUpdate)
        .where(CourseUpdate.course_id == course.id)
        .order_by(col(CourseUpdate.creation_date).desc())
    )  # https://sqlmodel.tiangolo.com/tutorial/where/#type-annotations-and-errors
    updates = (await db_session.execute(statement)).scalars().all()

    return [CourseUpdateRead(**update.model_dump()) for update in updates]
