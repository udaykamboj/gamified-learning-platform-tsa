"""
Course enrollment lookups.

A TrailRun row for (user, course) is the enrollment record: it is created by
"Start course" (add_course_to_trail) and removed when the course is dropped.
Kept free of RBAC imports so the access checker can use it without a cycle.
"""

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.trail_runs import TrailRun


async def is_user_enrolled_in_course(
    db_session: AsyncSession, user_id: int, course_id: int
) -> bool:
    if not user_id or not course_id:
        return False
    statement = select(TrailRun.id).where(
        TrailRun.user_id == user_id, TrailRun.course_id == course_id
    )
    return (await db_session.execute(statement)).first() is not None
