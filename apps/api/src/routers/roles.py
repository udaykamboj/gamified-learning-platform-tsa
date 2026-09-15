from fastapi import APIRouter, Depends, Request
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.events.database import get_db_session
from src.db.roles import RoleRead
from src.security.auth import get_current_user
from src.services.roles.roles import read_role, get_roles_by_organization
from src.db.users import PublicUser
from typing import List


# Read-only: the platform has exactly two roles, Admin and Student. Custom
# role authoring was removed with the teacher layer
# (docs/refactor/progress/00-requirements.md, R1/R2).
router = APIRouter()


@router.get(
    "/org/{org_id}",
    response_model=List[RoleRead],
    summary="List roles for organization",
    description="Get the platform roles (Admin and Student).",
    responses={
        200: {"description": "The platform roles."},
        401: {"description": "Authentication required"},
    },
)
async def api_get_roles_by_organization(
    request: Request,
    org_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
)-> List[RoleRead]:
    """
    Get the platform roles
    """
    return await get_roles_by_organization(request, db_session, org_id, current_user)


@router.get(
    "/{role_id}",
    response_model=RoleRead,
    summary="Get role",
    description="Get a single role by its role_id.",
    responses={
        200: {"description": "Role details.", "model": RoleRead},
        401: {"description": "Authentication required"},
    },
)
async def api_get_role(
    request: Request,
    role_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
)-> RoleRead:
    """
    Get single role by role_id
    """
    return await read_role(request, db_session, role_id, current_user)
