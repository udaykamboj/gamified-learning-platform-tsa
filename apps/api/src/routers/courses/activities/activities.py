from typing import List, Optional
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from src.db.courses.activities import ActivityRead
from src.db.users import PublicUser
from src.core.events.database import get_db_session
from src.services.courses.activities.activities import (
    get_activity,
    get_activities,
    get_activityby_id,
)
from src.security.auth import get_current_user

router = APIRouter()


class ExternalVideoUpdateBody(BaseModel):
    name: Optional[str] = None
    uri: Optional[str] = None
    startTime: Optional[int] = None
    endTime: Optional[int] = None
    autoplay: Optional[bool] = None
    muted: Optional[bool] = None


def _parse_extra_metadata(raw: Optional[str]) -> Optional[dict]:
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=422, detail="extra_metadata must be a JSON object"
        )
    if not isinstance(parsed, dict):
        raise HTTPException(
            status_code=422, detail="extra_metadata must be a JSON object"
        )
    return parsed


def _validate_details(raw: str) -> str:
    """Validate that a ``details`` form field is a JSON object before it is
    handed to the service layer (which calls ``json.loads`` unguarded). Without
    this, malformed JSON would surface as an unhandled 500 instead of a 422."""
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=422, detail="details must be a JSON object"
        )
    if not isinstance(parsed, dict):
        raise HTTPException(
            status_code=422, detail="details must be a JSON object"
        )
    return raw


# Versioning endpoints - MUST be before /{activity_uuid} catch-all routes


# Activity CRUD endpoints


@router.get(
    "/{activity_uuid}",
    response_model=ActivityRead,
    summary="Get activity by UUID",
    description="Get a single activity by its UUID.",
    responses={
        200: {"description": "Activity returned.", "model": ActivityRead},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this activity"},
        404: {"description": "Activity not found"},
    },
)
async def api_get_activity(
    request: Request,
    activity_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> ActivityRead:
    """
    Get single activity by activity_id
    """
    return await get_activity(
        request, activity_uuid, current_user=current_user, db_session=db_session
    )


@router.get(
    "/id/{activity_id}",
    response_model=ActivityRead,
    summary="Get activity by ID",
    description="Get a single activity by its numeric database ID.",
    responses={
        200: {"description": "Activity returned.", "model": ActivityRead},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this activity"},
        404: {"description": "Activity not found"},
    },
)
async def api_get_activityby_id(
    request: Request,
    activity_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> ActivityRead:
    """
    Get single activity by activity_id
    """
    return await get_activityby_id(
        request, activity_id, current_user=current_user, db_session=db_session
    )


@router.get(
    "/chapter/{chapter_id}",
    response_model=List[ActivityRead],
    summary="List chapter activities",
    description="Get all activities that belong to the given chapter, in their configured order.",
    responses={
        200: {
            "description": "List of activities for the chapter.",
            "model": List[ActivityRead],
        },
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this chapter"},
        404: {"description": "Chapter not found"},
    },
)
async def api_get_chapter_activities(
    request: Request,
    chapter_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> List[ActivityRead]:
    """
    Get Activities for a chapter
    """
    return await get_activities(request, chapter_id, current_user, db_session)


# Video activity


