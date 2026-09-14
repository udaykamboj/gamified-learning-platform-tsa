"""Account types for the single-organization platform.

Every account is exactly one of two types, derived from the existing LearnHouse
role model rather than a new column:

* ``admin``   — a platform superadmin, or a member of the platform org whose
  role grants ``dashboard.action_access`` (the seeded Admin, Maintainer and
  Instructor roles, or a custom staff role). Admins manage courses, content and
  students.
* ``student`` — everyone else. Public signup always produces this (the seeded
  "User" role, id 4).

On top of that, ``can_manage_platform`` marks the admins allowed into the
platform console (user promotion/demotion, platform overview): superadmins and
members holding the Admin role (id 1). Maintainers and Instructors are admins
who only get course management.

Only memberships in the platform org count. A role in any other organization
row (for example a leftover demo org) never makes someone an admin.

These are computed per request from the database. Nothing here trusts a JWT
claim, a cached session or a cookie — those are routing hints at most.
"""

from dataclasses import dataclass
from typing import Literal, Optional

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.roles import Role
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.security.rbac.constants import ADMIN_ROLE_ID

PlatformRole = Literal["admin", "student"]


@dataclass(frozen=True)
class PlatformAccess:
    role: PlatformRole
    can_manage_platform: bool
    is_superadmin: bool
    platform_org_id: Optional[int]
    role_ids: tuple[int, ...]

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


def role_grants_dashboard_access(role: Optional[Role]) -> bool:
    """True if the role's rights include ``dashboard.action_access``.

    Tolerates ``rights`` stored as a plain dict or a Pydantic model.
    """
    if role is None or role.rights is None:
        return False
    rights = role.rights
    if not isinstance(rights, dict):
        try:
            rights = rights.model_dump()
        except Exception:
            return False
    dashboard = rights.get("dashboard") or {}
    return bool(dashboard.get("action_access", False))


async def resolve_platform_access(user_id: int, db_session: AsyncSession) -> PlatformAccess:
    """Compute the account type of ``user_id`` from the database."""
    from src.services.orgs.platform import find_platform_org

    is_superadmin = bool(
        (
            await db_session.execute(select(User.is_superadmin).where(User.id == user_id))
        ).scalars().first()
    )

    platform_org = await find_platform_org(db_session)
    roles: list[Role] = []
    if platform_org is not None and platform_org.id is not None:
        roles = list(
            (
                await db_session.execute(
                    select(Role)
                    .join(UserOrganization, UserOrganization.role_id == Role.id)
                    .where(UserOrganization.user_id == user_id)
                    .where(UserOrganization.org_id == platform_org.id)
                )
            ).scalars().all()
        )

    has_staff_role = any(role_grants_dashboard_access(r) for r in roles)
    holds_admin_role = any(r.id == ADMIN_ROLE_ID for r in roles)

    return PlatformAccess(
        role="admin" if (is_superadmin or has_staff_role) else "student",
        can_manage_platform=is_superadmin or holds_admin_role,
        is_superadmin=is_superadmin,
        platform_org_id=int(platform_org.id) if platform_org is not None and platform_org.id is not None else None,
        role_ids=tuple(int(r.id) for r in roles if r.id is not None),
    )


async def _get_current_user_lazy(request: Request, db_session: AsyncSession = Depends(get_db_session)):
    # Lazy import: src.security.auth imports the users service, which imports
    # rbac, which would import this module back.
    from src.security.auth import get_current_user

    return await get_current_user(request, db_session)


async def _require_session_user(current_user):
    from src.db.users import AnonymousUser, PublicUser

    if isinstance(current_user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    # API tokens (org-scoped or superadmin) are automation credentials, not
    # accounts. Admin surfaces are for signed-in people only.
    if not isinstance(current_user, PublicUser):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint requires a signed-in account",
        )
    return current_user


async def require_admin_account(
    current_user=Depends(_get_current_user_lazy),
    db_session: AsyncSession = Depends(get_db_session),
):
    """Dependency: the caller must be an admin account (403 for students)."""
    user = await _require_session_user(current_user)
    access = await resolve_platform_access(int(user.id), db_session)
    if not access.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin account required",
        )
    return user


async def require_platform_admin(
    current_user=Depends(_get_current_user_lazy),
    db_session: AsyncSession = Depends(get_db_session),
):
    """Dependency: the caller may use the platform console.

    Superadmins and members holding the Admin role. Students, Maintainers and
    Instructors get 403.
    """
    user = await _require_session_user(current_user)
    access = await resolve_platform_access(int(user.id), db_session)
    if not access.can_manage_platform:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform admin access required",
        )
    return user
