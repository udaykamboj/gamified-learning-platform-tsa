"""Roles are read-only platform data.

StarLab has two roles, Admin and Student, seeded by
``services/setup/setup.py::install_default_elements``. There is no custom-role
authoring: custom roles were the teacher-permission layer
(docs/refactor/progress/00-requirements.md, R1/R2).
"""

from typing import List
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.security.rbac.rbac import authorization_verify_if_user_is_anon
from src.security.rbac.constants import PLATFORM_ROLE_IDS
from src.security.org_auth import require_org_role_permission
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.security.auth import resolve_acting_user_id
from src.db.roles import Role, RoleRead
from src.db.organizations import Organization
from fastapi import HTTPException, Request


async def get_roles_by_organization(
    request: Request,
    db_session: AsyncSession,
    org_id: int,
    current_user: PublicUser | AnonymousUser | APITokenUser,
) -> List[RoleRead]:
    """List the platform roles (Admin, Student) for an organization member."""
    statement = select(Organization).where(Organization.id == org_id)
    organization = (await db_session.execute(statement)).scalars().first()

    if not organization:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    await require_org_role_permission(resolve_acting_user_id(current_user), org_id, db_session, "roles", "action_read")

    roles = (
        await db_session.execute(
            select(Role).where(Role.id.in_(PLATFORM_ROLE_IDS)).order_by(Role.id)  # type: ignore
        )
    ).scalars().all()

    role_reads = []
    for role in roles:
        role_data = role.model_dump()
        if role_data.get('org_id') is None:
            role_data['org_id'] = 0
        role_reads.append(RoleRead(**role_data))

    return role_reads


async def read_role(
    request: Request, db_session: AsyncSession, role_id: int, current_user: PublicUser | AnonymousUser | APITokenUser
):
    statement = select(Role).where(Role.id == role_id)
    result = await db_session.execute(statement)

    role = result.scalars().first()

    if not role:
        raise HTTPException(
            status_code=404,
            detail="Role not found",
        )

    # RBAC check — scope permission to the role's own org to prevent cross-org IDOR.
    # Global roles (org_id=None) are readable by any authenticated user.
    acting_user_id = resolve_acting_user_id(current_user)
    await authorization_verify_if_user_is_anon(acting_user_id)
    if role.org_id is not None:
        await require_org_role_permission(acting_user_id, role.org_id, db_session, "roles", "action_read")

    role = RoleRead(**role.model_dump())

    return role
