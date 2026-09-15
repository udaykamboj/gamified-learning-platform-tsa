from typing import List
from fastapi import APIRouter, Depends, Request
from src.core.events.database import get_db_session
from src.db.courses.chapters import (
    ChapterRead,
)
from src.services.courses.chapters import (
    DEPRECEATED_get_course_chapters,
    get_chapter,
    get_course_chapters,
)

from src.services.users.users import PublicUser
from src.security.auth import get_current_user

router = APIRouter()


@router.get(
    "/{chapter_id}",
    response_model=ChapterRead,
    summary="Get chapter by ID",
    description="Retrieve a single chapter by its numeric ID.",
    responses={
        200: {"description": "Chapter retrieved successfully", "model": ChapterRead},
        403: {"description": "User lacks read access to this chapter"},
        404: {"description": "Chapter not found"},
        409: {"description": "Chapter does not exist"},
    },
)
async def api_get_coursechapter(
    request: Request,
    chapter_id: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> ChapterRead:
    """
    Get single CourseChapter by chapter_id
    """
    return await get_chapter(request, chapter_id, current_user, db_session)


@router.get(
    "/course/{course_uuid}/meta",
    deprecated=True,
    summary="Get chapters metadata (deprecated)",
    description="Deprecated endpoint returning chapter metadata for a course. Use /course/{course_uuid}/meta on the courses router instead.",
    responses={
        200: {"description": "Chapter metadata"},
        403: {"description": "User lacks read access to the course"},
        404: {"description": "Course not found"},
    },
)
async def api_get_chapter_meta(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """
    Get Chapters metadata
    """
    return await DEPRECEATED_get_course_chapters(
        request, course_uuid, current_user, db_session
    )


@router.get(
    "/course/{course_id}/page/{page}/limit/{limit}",
    response_model=List[ChapterRead],
    summary="List course chapters",
    description="Paginated list of chapters for the specified course.",
    responses={
        200: {"description": "Paginated list of chapters", "model": List[ChapterRead]},
        403: {"description": "User lacks read access to the course"},
        404: {"description": "Course not found"},
    },
)
async def api_get_chapter_by(
    request: Request,
    course_id: int,
    page: int,
    limit: int,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> List[ChapterRead]:
    """
    Get Course Chapters by page and limit
    """
    return await get_course_chapters(
        request,
        course_id,
        db_session,
        current_user,
        with_unpublished_activities=False,
        page=page,
        limit=limit,
    )


