from typing import List
from fastapi import APIRouter, Depends, Request, Query

from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.events.database import get_db_session
from src.db.courses.course_updates import (
    CourseUpdateRead,
)
from src.db.users import PublicUser
from src.db.courses.courses import (
    CourseRead,
    FullCourseRead,
)
from src.security.auth import get_current_user
from src.security.features_utils.dependencies import require_courses_feature
from src.security.rbac import check_resource_access, AccessAction
from src.services.courses.courses import (
    get_course,
    get_course_by_id,
    get_course_meta,
    get_courses_orgslug,
    get_courses_count_orgslug,
    search_courses,
    get_course_user_rights,
)
from src.services.courses.updates import (
    get_updates_by_course_uuid,
)


router = APIRouter(dependencies=[Depends(require_courses_feature)])


@router.get(
    "/{course_uuid}",
    response_model=CourseRead,
    summary="Get course by UUID",
    description="Retrieve a single course by its UUID.",
    responses={
        200: {"description": "Course retrieved successfully", "model": CourseRead},
        403: {"description": "User lacks read access to this course"},
        404: {"description": "Course not found"},
    },
)
async def api_get_course(
    request: Request,
    course_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseRead:
    """
    Get single Course by course_uuid
    """
    return await get_course(
        request, course_uuid, current_user=current_user, db_session=db_session
    )


@router.get(
    "/id/{course_id}",
    response_model=CourseRead,
    summary="Get course by ID",
    description="Retrieve a single course by its numeric database ID.",
    responses={
        200: {"description": "Course retrieved successfully", "model": CourseRead},
        403: {"description": "User lacks read access to this course"},
        404: {"description": "Course not found"},
    },
)
async def api_get_course_by_id(
    request: Request,
    course_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> CourseRead:
    """
    Get single Course by id
    """
    return await get_course_by_id(
        request, course_id, current_user=current_user, db_session=db_session
    )


@router.get(
    "/{course_uuid}/meta",
    response_model=FullCourseRead,
    summary="Get course metadata",
    description=(
        "Retrieve full course metadata including chapters and activities. "
        "Use slim=true to exclude heavy activity content/details, useful for "
        "navigation menus."
    ),
    responses={
        200: {"description": "Course metadata retrieved successfully", "model": FullCourseRead},
        403: {"description": "User lacks read access to this course"},
        404: {"description": "Course not found"},
    },
)
async def api_get_course_meta(
    request: Request,
    course_uuid: str,
    with_unpublished_activities: bool = False,
    slim: bool = False,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> FullCourseRead:
    """
    Get single Course Metadata (chapters, activities) by course_uuid.
    Use slim=true to exclude heavy activity content/details (useful for navigation).
    """
    # SECURITY: with_unpublished_activities is client-controlled and is passed
    # straight through to the data layer without any privilege gating. Only
    # users who can edit the course (authors/admins) should be able to see
    # unpublished/draft activities; otherwise any reader of a public course
    # could leak drafts via ?with_unpublished_activities=true. Downgrade the
    # flag to False for callers without UPDATE access.
    if with_unpublished_activities:
        decision = await check_resource_access(
            request,
            db_session,
            current_user,
            course_uuid,
            AccessAction.UPDATE,
            raise_on_deny=False,
        )
        if not decision.allowed:
            with_unpublished_activities = False

    return await get_course_meta(
        request, course_uuid, with_unpublished_activities, current_user=current_user, db_session=db_session, slim=slim
    )


@router.get(
    "/org_slug/{org_slug}/page/{page}/limit/{limit}",
    response_model=List[CourseRead],
    summary="List courses for an organization",
    description=(
        "Paginated list of courses for an organization identified by slug. "
        "Set include_unpublished=true to include unpublished courses (requires "
        "update permission on the organization)."
    ),
    responses={
        200: {"description": "Paginated list of courses", "model": List[CourseRead]},
        403: {"description": "User lacks permission to list unpublished courses"},
        404: {"description": "Organization not found"},
    },
)
async def api_get_course_by_orgslug(
    request: Request,
    page: int,
    limit: int,
    org_slug: str,
    include_unpublished: bool = False,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[CourseRead]:
    """
    Get courses by page and limit
    """
    return await get_courses_orgslug(
        request, current_user, org_slug, db_session, page, limit, include_unpublished
    )


@router.get(
    "/org_slug/{org_slug}/count",
    summary="Count courses in an organization",
    description="Return the total number of courses for the organization identified by slug.",
    responses={
        200: {"description": "Total course count"},
        404: {"description": "Organization not found"},
    },
)
async def api_get_courses_count(
    request: Request,
    org_slug: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> int:
    """
    Get total count of courses for an organization
    """
    return await get_courses_count_orgslug(
        request, current_user, org_slug, db_session
    )


@router.get(
    "/org_slug/{org_slug}/search",
    response_model=List[CourseRead],
    summary="Search courses",
    description=(
        "Full-text search courses by title and description within an organization. "
        "Query length is capped at 200 characters and results are paginated with a "
        "maximum page size of 50 to prevent data dumping."
    ),
    responses={
        200: {"description": "Paginated list of matching courses", "model": List[CourseRead]},
        404: {"description": "Organization not found"},
        422: {"description": "Invalid query or pagination parameters"},
    },
)
async def api_search_courses(
    request: Request,
    org_slug: str,
    query: str = Query(..., min_length=1, max_length=200, description="Search query"),
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=10, ge=1, le=50, description="Items per page (max 50)"),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[CourseRead]:
    """
    Search courses by title and description.

    SECURITY:
    - Maximum limit is 50 to prevent data dumping
    - Query length limited to 200 characters
    - Uses parameterized SQL queries (SQL injection protected)
    """
    return await search_courses(
        request, current_user, org_slug, query, db_session, page, limit
    )


@router.get(
    "/{course_uuid}/updates",
    response_model=List[CourseUpdateRead],
    summary="List course updates",
    description="Return all course update posts for a given course.",
    responses={
        200: {"description": "List of course update posts", "model": List[CourseUpdateRead]},
        403: {"description": "User lacks read access to the course"},
        404: {"description": "Course not found"},
    },
)
async def api_get_course_updates(
    request: Request,
    course_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> List[CourseUpdateRead]:
    """
    Get Course Updates by course_uuid
    """

    # SECURITY: Enforce read access on the parent course before returning its
    # updates. The underlying service only checks course existence, so without
    # this guard any user (including anonymous) could read updates of private /
    # unpublished courses.
    await check_resource_access(
        request, db_session, current_user, course_uuid, AccessAction.READ
    )

    return await get_updates_by_course_uuid(
        request, course_uuid, current_user, db_session
    )


@router.get(
    "/{course_uuid}/rights",
    summary="Get course user rights",
    description=(
        "Return what the current user can do with a platform course: read the "
        "outline, enroll, work on the content once enrolled, or monitor it (admins)."
    ),
    responses={
        200: {"description": "Rights object: permissions, enrollment and roles"},
        404: {"description": "Course not found"},
    },
)
async def api_get_course_user_rights(
    request: Request,
    course_uuid: str,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> dict:
    """
    Get the current user's rights on a course.

    ```json
    {
        "course_uuid": "course_123",
        "user_id": 456,
        "is_anonymous": false,
        "permissions": {"read": true, "enroll": false, "work_on_content": true, "monitor": false},
        "enrollment": {"is_enrolled": true},
        "roles": {"is_admin": false, "is_student": true}
    }
    ```
    """
    return await get_course_user_rights(request, course_uuid, current_user, db_session)
