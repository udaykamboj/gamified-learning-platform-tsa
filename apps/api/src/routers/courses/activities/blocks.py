from typing import Union
from fastapi import APIRouter, Depends, Request
from src.db.courses.blocks import BlockRead
from src.core.events.database import get_db_session
from src.security.auth import get_current_user
from src.services.blocks.block_types.imageBlock.imageBlock import (
    get_image_block,
)
from src.services.blocks.block_types.videoBlock.videoBlock import (
    get_video_block,
)
from src.services.blocks.block_types.pdfBlock.pdfBlock import (
    get_pdf_block,
)
from src.services.blocks.block_types.audioBlock.audioBlock import (
    get_audio_block,
)

from src.db.users import AnonymousUser, PublicUser

router = APIRouter()

####################
# Image Block
####################


@router.get(
    "/image",
    response_model=BlockRead,
    summary="Get image block",
    description="Retrieve an image block by its UUID.",
    responses={
        200: {"description": "Image block returned.", "model": BlockRead},
        401: {"description": "Authentication required"},
        404: {"description": "Image block not found"},
    },
)
async def api_get_image_file_block(
    request: Request,
    block_uuid: str,
    db_session=Depends(get_db_session),
    current_user: Union[PublicUser, AnonymousUser] = Depends(get_current_user),
) -> BlockRead:
    """
    Get image file
    """
    return await get_image_block(request, block_uuid, current_user, db_session)


####################
# Video Block
####################


@router.get(
    "/video",
    response_model=BlockRead,
    summary="Get video block",
    description="Retrieve a video block by its UUID.",
    responses={
        200: {"description": "Video block returned.", "model": BlockRead},
        401: {"description": "Authentication required"},
        404: {"description": "Video block not found"},
    },
)
async def api_get_video_file_block(
    request: Request,
    block_uuid: str,
    db_session=Depends(get_db_session),
    current_user: Union[PublicUser, AnonymousUser] = Depends(get_current_user),
) -> BlockRead:
    """
    Get video file
    """
    return await get_video_block(request, block_uuid, current_user, db_session)


####################
# PDF Block
####################


@router.get(
    "/pdf",
    response_model=BlockRead,
    summary="Get PDF block",
    description="Retrieve a PDF block by its UUID.",
    responses={
        200: {"description": "PDF block returned.", "model": BlockRead},
        401: {"description": "Authentication required"},
        404: {"description": "PDF block not found"},
    },
)
async def api_get_pdf_file_block(
    request: Request,
    block_uuid: str,
    db_session=Depends(get_db_session),
    current_user: Union[PublicUser, AnonymousUser] = Depends(get_current_user),
) -> BlockRead:
    """
    Get pdf file
    """
    return await get_pdf_block(request, block_uuid, current_user, db_session)


####################
# Audio Block
####################


@router.get(
    "/audio",
    response_model=BlockRead,
    summary="Get audio block",
    description="Retrieve an audio block by its UUID.",
    responses={
        200: {"description": "Audio block returned.", "model": BlockRead},
        401: {"description": "Authentication required"},
        404: {"description": "Audio block not found"},
    },
)
async def api_get_audio_file_block(
    request: Request,
    block_uuid: str,
    db_session=Depends(get_db_session),
    current_user: Union[PublicUser, AnonymousUser] = Depends(get_current_user),
) -> BlockRead:
    """
    Get audio file
    """
    return await get_audio_block(request, block_uuid, current_user, db_session)
