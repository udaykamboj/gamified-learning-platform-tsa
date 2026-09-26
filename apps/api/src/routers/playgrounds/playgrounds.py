from typing import List
from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.playgrounds import (
    PlaygroundCreate,
    PlaygroundRead,
    PlaygroundShareCreate,
    PlaygroundShareRead,
    PlaygroundUpdate,
)
from src.db.playground_reactions import PlaygroundReactionSummary
from src.db.users import PublicUser, AnonymousUser
from src.security.auth import get_current_user
from src.services.playgrounds.playgrounds import (
    create_playground,
    get_playground,
    list_org_playgrounds,
    update_playground,
    update_playground_thumbnail,
    delete_playground,
    duplicate_playground,
    list_playground_shares,
    share_playground,
    unshare_playground,
)
from src.services.playgrounds.playground_reactions import (
    get_playground_reactions,
    toggle_playground_reaction,
)

router = APIRouter()


@router.post(
    "/",
    response_model=PlaygroundRead,
    summary="Create a playground",
    description="Create a new private playground owned by the current user. Any signed-in member can create as many as they want.",
    responses={
        200: {"description": "Playground created successfully.", "model": PlaygroundRead},
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient permissions to create playgrounds"},
        404: {"description": "Organization not found"},
    },
)
async def api_create_playground(
    request: Request,
    org_id: int,
    playground_object: PlaygroundCreate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> PlaygroundRead:
    return await create_playground(request, org_id, playground_object, current_user, db_session)


@router.get(
    "/org/{org_id}",
    response_model=List[PlaygroundRead],
    summary="List my playgrounds",
    description="List the current user's playgrounds: the ones they own and the ones shared with them, most recent first.",
    responses={
        200: {"description": "List of playgrounds accessible to the current user.", "model": List[PlaygroundRead]},
        401: {"description": "Authentication required"},
        403: {"description": "Access denied to this organization"},
    },
)
async def api_list_org_playgrounds(
    request: Request,
    org_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[PlaygroundRead]:
    return await list_org_playgrounds(request, org_id, current_user, db_session)


@router.get(
    "/{playground_uuid}",
    response_model=PlaygroundRead,
    summary="Get a playground by UUID",
    description="Retrieve a single playground by its UUID. The current user must have access to the playground.",
    responses={
        200: {"description": "The requested playground.", "model": PlaygroundRead},
        401: {"description": "Authentication required"},
        403: {"description": "Access denied to this playground"},
        404: {"description": "Playground not found"},
    },
)
async def api_get_playground(
    request: Request,
    playground_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> PlaygroundRead:
    return await get_playground(request, playground_uuid, current_user, db_session)


@router.put(
    "/{playground_uuid}",
    response_model=PlaygroundRead,
    summary="Update a playground",
    description="Update a playground. Owners and shared editors can edit; only the owner changes who can open it.",
    responses={
        200: {"description": "Playground updated successfully.", "model": PlaygroundRead},
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient permissions to update playground"},
        404: {"description": "Playground not found"},
    },
)
async def api_update_playground(
    request: Request,
    playground_uuid: str,
    playground_object: PlaygroundUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> PlaygroundRead:
    return await update_playground(request, playground_uuid, playground_object, current_user, db_session)


@router.delete(
    "/{playground_uuid}",
    summary="Delete a playground",
    description="Delete a playground. Only its owner can.",
    responses={
        200: {"description": "Playground deleted successfully."},
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient permissions to delete playground"},
        404: {"description": "Playground not found"},
    },
)
async def api_delete_playground(
    request: Request,
    playground_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> dict:
    return await delete_playground(request, playground_uuid, current_user, db_session)


@router.post(
    "/{playground_uuid}/duplicate",
    response_model=PlaygroundRead,
    summary="Duplicate a playground",
    description="Copy a playground you can open into a new private playground you own.",
    responses={
        200: {"description": "Playground duplicated successfully.", "model": PlaygroundRead},
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient permissions to create playgrounds"},
        404: {"description": "Playground not found"},
    },
)
async def api_duplicate_playground(
    request: Request,
    playground_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> PlaygroundRead:
    return await duplicate_playground(request, playground_uuid, current_user, db_session)


@router.post(
    "/{playground_uuid}/thumbnail",
    response_model=PlaygroundRead,
    summary="Upload a playground thumbnail",
    description="Upload or replace the thumbnail image for a playground. Owners and shared editors can.",
    responses={
        200: {"description": "Thumbnail uploaded and playground updated.", "model": PlaygroundRead},
        400: {"description": "No thumbnail file provided"},
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient permissions to update playground"},
        404: {"description": "Playground or organization not found"},
    },
)
async def api_update_playground_thumbnail(
    request: Request,
    playground_uuid: str,
    thumbnail: UploadFile = File(...),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> PlaygroundRead:
    return await update_playground_thumbnail(request, playground_uuid, current_user, db_session, thumbnail)


@router.get(
    "/{playground_uuid}/shares",
    response_model=List[PlaygroundShareRead],
    summary="List who a playground is shared with",
    responses={
        200: {"description": "People the playground is shared with and their role."},
        401: {"description": "Authentication required"},
        404: {"description": "Playground not found"},
    },
)
async def api_list_playground_shares(
    request: Request,
    playground_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[PlaygroundShareRead]:
    return await list_playground_shares(request, playground_uuid, current_user, db_session)


@router.post(
    "/{playground_uuid}/shares",
    response_model=PlaygroundShareRead,
    summary="Share a playground with someone",
    description="Share a playground with a platform member by username or email, as viewer or editor. Owner only.",
    responses={
        200: {"description": "Shared (or role updated)."},
        403: {"description": "Only the owner can share"},
        404: {"description": "Playground or person not found"},
    },
)
async def api_share_playground(
    request: Request,
    playground_uuid: str,
    share_object: PlaygroundShareCreate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> PlaygroundShareRead:
    return await share_playground(request, playground_uuid, share_object, current_user, db_session)


@router.delete(
    "/{playground_uuid}/shares/{user_id}",
    summary="Stop sharing a playground with someone",
    description="The owner removes a person, or a person leaves a playground shared with them.",
    responses={
        200: {"description": "Share removed."},
        403: {"description": "Only the owner can remove other people"},
        404: {"description": "Playground or share not found"},
    },
)
async def api_unshare_playground(
    request: Request,
    playground_uuid: str,
    user_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> dict:
    return await unshare_playground(request, playground_uuid, user_id, current_user, db_session)


@router.get(
    "/{playground_uuid}/reactions",
    response_model=List[PlaygroundReactionSummary],
    summary="List reactions on a playground",
    description="Return reaction counts and the current user's reactions for a playground. Supports anonymous viewers.",
    responses={
        200: {"description": "Aggregated reaction summary for the playground.", "model": List[PlaygroundReactionSummary]},
        404: {"description": "Playground not found"},
    },
)
async def api_get_playground_reactions(
    request: Request,
    playground_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser | AnonymousUser = Depends(get_current_user),
) -> List[PlaygroundReactionSummary]:
    return await get_playground_reactions(request, playground_uuid, current_user, db_session)


@router.post(
    "/{playground_uuid}/reactions",
    summary="Toggle a reaction on a playground",
    description="Toggle the current user's reaction (emoji) on a playground. Adds the reaction if missing or removes it if already present.",
    responses={
        200: {"description": "Reaction toggled successfully."},
        401: {"description": "Authentication required"},
        404: {"description": "Playground not found"},
    },
)
async def api_toggle_playground_reaction(
    request: Request,
    playground_uuid: str,
    reaction: dict,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> dict:
    return await toggle_playground_reaction(
        request, playground_uuid, reaction.get("emoji", ""), current_user, db_session
    )
