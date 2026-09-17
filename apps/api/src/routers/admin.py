"""
Admin API Router — headless platform administration via API tokens.

All endpoints are scoped by org_slug and require API token authentication
(Bearer lh_...). The token's organization must match the org_slug in the URL.

This API administers accounts and monitors courses. It deliberately has no
endpoints that act on a student's learning — no enrolling, completing,
resetting, certificate awarding, cohort access or signing in as a user
(docs/refactor/progress/00-requirements.md, R3, R19, R20).
"""

from typing import Any, Dict, List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from pydantic import BaseModel, EmailStr, Field
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.events.database import get_db_session
from src.db.users import AnonymousUser, PublicUser, UserRead, UserSession
from src.security.auth import get_current_user
from src.services.users.users import get_user_session
from src.services.admin.admin import (
    _require_api_token,
    _resolve_org_slug,
    anonymize_user,
    export_user_data,
    get_course_analytics,
    get_user_by_email,
    list_course_enrollments,
    remove_user_from_org_admin,
    update_user_profile,
)


router = APIRouter()


@router.get(
    "/users/session",
    response_model=UserSession,
    summary="Get current admin user session",
    description="Return the full session for the current admin user.",
)
async def api_get_admin_current_user_session(
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Union[PublicUser, AnonymousUser] = Depends(get_current_user),
) -> UserSession:
    if isinstance(current_user, AnonymousUser) or not getattr(current_user, "is_admin_user", False):
        raise HTTPException(
            status_code=401,
            detail="Admin authentication required",
        )
    return await get_user_session(request, db_session, current_user)


# ── Response models for OpenAPI documentation ────────────────────────────────


class RemoveUserResponse(BaseModel):
    detail: str


class CourseEnrollmentItem(BaseModel):
    """A single row in a course enrollment listing."""
    user: Dict[str, Any]
    enrolled_at: str
    status: str


class UpdateUserRequest(BaseModel):
    """Fields that can be updated via the admin profile PATCH."""
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar_image: Optional[str] = None
    bio: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    profile: Optional[Dict[str, Any]] = None


class AnonymizeUserResponse(BaseModel):
    detail: str
    user_id: int
    anonymized_email: str
    api_tokens_revoked: int


class CourseAnalyticsResponse(BaseModel):
    course_uuid: str
    enrollment_count: int
    completed_count: int
    in_progress_count: int
    total_activities: int
    average_completion_percentage: float
    certificate_count: int


class UserDataExportResponse(BaseModel):
    """Full GDPR data export bundle."""
    profile: Dict[str, Any] = Field(description="The user's profile (scrubbed of sensitive fields)")
    memberships: List[Dict[str, Any]] = Field(description="Org memberships scoped to the caller's org")
    trails: List[Dict[str, Any]] = Field(description="Learning trails in the caller's org")
    trail_runs: List[Dict[str, Any]] = Field(description="Course enrollments / trail runs")
    trail_steps: List[Dict[str, Any]] = Field(description="Activity completions")
    certificates: List[Dict[str, Any]] = Field(description="Certificates earned in the caller's org")
    exported_at: str = Field(description="ISO8601 timestamp when the export was generated")


# ── Accounts ─────────────────────────────────────────────────────────────────


@router.delete(
    "/{org_slug}/users/{user_id}",
    response_model=RemoveUserResponse,
    summary="Remove a user from the platform",
    description=(
        "Remove a user's platform membership (account moderation). "
        "Blocks removing the last admin."
    ),
    responses={
        200: {"description": "Membership removed.", "model": RemoveUserResponse},
        400: {"description": "User is the last admin"},
        404: {"description": "User not in org"},
    },
)
async def api_admin_remove_user(
    org_slug: str,
    user_id: int,
    current_user=Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> RemoveUserResponse:
    token_user = _require_api_token(current_user)
    await _resolve_org_slug(org_slug, token_user, db_session)
    result = await remove_user_from_org_admin(token_user, user_id, db_session)
    return RemoveUserResponse(**result)


@router.get(
    "/{org_slug}/users/by-email/{email}",
    response_model=UserRead,
    summary="Look up a user by email",
    description=(
        "Find a user by email within the organization. Returns 404 if the user "
        "does not exist or is not a member of this org."
    ),
    responses={
        200: {"description": "The user matching the given email within this org.", "model": UserRead},
        404: {"description": "User not found in this organization"},
    },
)
async def api_admin_get_user_by_email(
    org_slug: str,
    email: str = Path(description="URL-encoded email address"),
    current_user=Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> UserRead:
    token_user = _require_api_token(current_user)
    await _resolve_org_slug(org_slug, token_user, db_session)

    # Throttle per-token: 200/404 distinguishes "in org" vs "not in org",
    # which is useful to integrators but also a bulk-enumeration oracle if
    # a token is leaked.
    from src.services.security.rate_limiting import check_admin_user_lookup_rate_limit
    is_allowed, retry_after = check_admin_user_lookup_rate_limit(token_user.id)
    if not is_allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many user lookups. Please slow down.",
            headers={"Retry-After": str(retry_after)},
        )

    return await get_user_by_email(token_user, email, db_session)


@router.patch(
    "/{org_slug}/users/{user_id}",
    response_model=UserRead,
    summary="Update a user's profile",
    description=(
        "Update profile fields of an org member. Supports partial updates — "
        "only fields present in the request body are changed. Duplicate "
        "email/username is rejected."
    ),
    responses={
        200: {"description": "Updated user profile.", "model": UserRead},
        400: {"description": "Duplicate email or username"},
        404: {"description": "User not in org"},
    },
)
async def api_admin_update_user_profile(
    org_slug: str,
    user_id: int,
    body: UpdateUserRequest,
    current_user=Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> UserRead:
    token_user = _require_api_token(current_user)
    await _resolve_org_slug(org_slug, token_user, db_session)
    updates = body.model_dump(exclude_unset=True)
    return await update_user_profile(token_user, user_id, updates, db_session)


# ── GDPR export / anonymize ──────────────────────────────────────────────────


@router.get(
    "/{org_slug}/users/{user_id}/export",
    response_model=UserDataExportResponse,
    summary="Full GDPR data export for a user",
    description=(
        "Return a JSON bundle containing the user's profile, org memberships, "
        "trails, runs, steps and certificates. Intended for GDPR Article 15 "
        "(Right of Access) compliance. All sub-collections are scoped to the "
        "caller's org."
    ),
    responses={
        200: {"description": "Bundle of all user data scoped to this org.", "model": UserDataExportResponse},
        404: {"description": "User not in org"},
    },
)
async def api_admin_export_user_data(
    org_slug: str,
    user_id: int,
    current_user=Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> UserDataExportResponse:
    token_user = _require_api_token(current_user)
    await _resolve_org_slug(org_slug, token_user, db_session)
    bundle = await export_user_data(token_user, user_id, db_session)
    return UserDataExportResponse(**bundle)


@router.post(
    "/{org_slug}/users/{user_id}/anonymize",
    response_model=AnonymizeUserResponse,
    summary="GDPR right-to-be-forgotten",
    description=(
        "Scrub a user's PII (email, name, avatar, bio, details, profile, "
        "password). Delete API tokens the user created. Keeps trails and "
        "certificates so course analytics remain accurate. Invalidates "
        "session cache."
    ),
    responses={
        200: {"description": "User PII scrubbed; reports how many API tokens were revoked.", "model": AnonymizeUserResponse},
        404: {"description": "User not in org"},
    },
)
async def api_admin_anonymize_user(
    org_slug: str,
    user_id: int,
    current_user=Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> AnonymizeUserResponse:
    token_user = _require_api_token(current_user)
    await _resolve_org_slug(org_slug, token_user, db_session)
    result = await anonymize_user(token_user, user_id, db_session)
    return AnonymizeUserResponse(**result)


# ── Course monitoring (read-only) ────────────────────────────────────────────


@router.get(
    "/{org_slug}/courses/{course_uuid}/enrollments",
    response_model=List[CourseEnrollmentItem],
    summary="List users enrolled in a course",
    description=(
        "Get the users who enrolled themselves in a course, with pagination. "
        "Returns enrollment status and enrolled_at per user."
    ),
    responses={
        200: {"description": "One row per enrolled user in this course, with status and enrolled_at."},
        404: {"description": "Course not found"},
    },
)
async def api_admin_list_course_enrollments(
    org_slug: str,
    course_uuid: str,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    current_user=Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> List[CourseEnrollmentItem]:
    token_user = _require_api_token(current_user)
    await _resolve_org_slug(org_slug, token_user, db_session)
    results = await list_course_enrollments(
        token_user, course_uuid, db_session, page=page, limit=limit
    )
    return [CourseEnrollmentItem(**r) for r in results]


@router.get(
    "/{org_slug}/courses/{course_uuid}/analytics",
    response_model=CourseAnalyticsResponse,
    summary="Aggregate stats for a course",
    description=(
        "Returns enrollment/completion counts, average completion percentage "
        "across all enrollees, and total certificates earned."
    ),
    responses={
        200: {"description": "Aggregate course stats: enrollment, completion, certificates, etc.", "model": CourseAnalyticsResponse},
        404: {"description": "Course not found"},
    },
)
async def api_admin_get_course_analytics(
    org_slug: str,
    course_uuid: str,
    current_user=Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CourseAnalyticsResponse:
    token_user = _require_api_token(current_user)
    await _resolve_org_slug(org_slug, token_user, db_session)
    result = await get_course_analytics(token_user, course_uuid, db_session)
    return CourseAnalyticsResponse(**result)
