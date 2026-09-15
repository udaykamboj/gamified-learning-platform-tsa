"""Enrollment lock for course content.

Courses are platform content: anyone can see a course's outline, but lesson,
practice and test content opens once the student has enrolled in the course
themselves (from Skills or the course page). Nobody else grants or removes
that access (docs/refactor/progress/00-requirements.md, R8).

- anonymous visitors: outline only, content locked
- signed-in students: content unlocked when enrolled (a TrailRun exists)
- admins: never locked, so they can monitor course content
"""

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.security.auth import resolve_acting_user_id
from src.security.rbac.constants import ADMIN_ROLE_IDS
from src.services.trail.enrollment import is_user_enrolled_in_course

ENROLLMENT_REQUIRED = "ENROLLMENT_REQUIRED"


async def is_org_admin(user_id: int, org_id: int, db_session: AsyncSession) -> bool:
    """True if the user is an admin of this org (never locked out of content)."""
    uo = (await db_session.execute(
        select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.org_id == org_id,
        )
    )).scalars().first()
    return bool(uo and uo.role_id in ADMIN_ROLE_IDS)


async def is_course_content_locked(
    course_id: int,
    org_id: int,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> bool:
    """True if the caller must enroll before seeing this course's content."""
    if isinstance(current_user, AnonymousUser):
        return True
    acting_user_id = resolve_acting_user_id(current_user)
    if getattr(current_user, "is_superadmin", False):
        return False
    if await is_org_admin(acting_user_id, org_id, db_session):
        return False
    return not await is_user_enrolled_in_course(db_session, acting_user_id, course_id)


async def require_enrollment(
    course_id: int,
    org_id: int,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> None:
    """Raise 403 unless the caller is enrolled (used by submit/complete paths)."""
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    acting_user_id = resolve_acting_user_id(current_user)
    if not await is_user_enrolled_in_course(db_session, acting_user_id, course_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": ENROLLMENT_REQUIRED,
                "message": "Enroll in this course to work on it",
            },
        )
