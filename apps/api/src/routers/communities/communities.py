from typing import List
from fastapi import APIRouter, Depends, Request, Path
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.db.communities.communities import CommunityRead, CommunityUpdate
from src.security.auth import get_current_user
from src.services.communities.communities import (
    get_community,
    get_communities_by_org,
    get_community_by_course,
    update_community,
    get_community_user_rights,
)


router = APIRouter()


@router.get(
    "/{community_uuid}",
    response_model=CommunityRead,
    summary="Get a community",
    description="Retrieve a community by its UUID. The caller must be able to read the community.",
    responses={
        200: {"description": "Community retrieved.", "model": CommunityRead},
        401: {"description": "Authentication required"},
        403: {"description": "User does not have read access to this community"},
        404: {"description": "Community not found"},
    },
)
async def api_get_community(
    request: Request,
    community_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CommunityRead:
    """
    Get a community by UUID.
    """
    return await get_community(request, community_uuid, current_user, db_session)


@router.get(
    "/org/{org_id}/page/{page}/limit/{limit}",
    response_model=List[CommunityRead],
    summary="List communities for an organization",
    description="Retrieve a paginated list of communities belonging to an organization.",
    responses={
        200: {"description": "Paginated list of communities.", "model": List[CommunityRead]},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks access to this organization's communities"},
        404: {"description": "Organization not found"},
    },
)
async def api_get_communities_by_org(
    request: Request,
    org_id: int,
    page: int = Path(ge=1),
    # Upper bound guards against negative/absurd values (the original 500 bug)
    # while staying above real callers — the sitemap requests limit=1000.
    limit: int = Path(ge=1, le=1000),
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> List[CommunityRead]:
    """
    Get paginated list of communities for an organization.
    """
    return await get_communities_by_org(
        request, org_id, current_user, db_session, page, limit
    )


@router.get(
    "/course/{course_uuid}",
    summary="Get community for a course",
    description="Retrieve the community that is linked to a specific course, if one exists.",
    responses={
        200: {"description": "Community linked to the course, or null if no community is linked."},
        401: {"description": "Authentication required"},
        403: {"description": "User does not have access to this course"},
        404: {"description": "Course not found"},
    },
)
async def api_get_community_by_course(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CommunityRead | None:
    """
    Get the community linked to a specific course.
    """
    return await get_community_by_course(request, course_uuid, current_user, db_session)


@router.put(
    "/{community_uuid}",
    response_model=CommunityRead,
    summary="Update a community's moderation rules",
    description="Update banned words and posting limits. Moderators (admins) only.",
    responses={
        200: {"description": "Community updated successfully.", "model": CommunityRead},
        401: {"description": "Authentication required"},
        403: {"description": "Only moderators can do this"},
        404: {"description": "Community not found"},
    },
)
async def api_update_community(
    request: Request,
    community_uuid: str,
    community_data: CommunityUpdate,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CommunityRead:
    """
    Update a community's moderation rules. Moderators (admins) only.
    """
    return await update_community(
        request, community_uuid, community_data, current_user, db_session
    )


@router.get(
    "/{community_uuid}/rights",
    summary="Get current user rights for a community",
    description="Return a detailed breakdown of the rights the current user has on a community (read, write, moderate, admin).",
    responses={
        200: {"description": "User rights for the community."},
        401: {"description": "Authentication required"},
        404: {"description": "Community not found"},
    },
)
async def api_get_community_rights(
    request: Request,
    community_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Get detailed user rights for a specific community.
    """
    return await get_community_user_rights(
        request, community_uuid, current_user, db_session
    )


