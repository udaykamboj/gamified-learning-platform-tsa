"""
Admin API service layer.

Provides headless API operations using API token authentication.
All functions require an APITokenUser and operate within the token's org scope.
Account administration and course monitoring only: nothing here changes a
student's enrollment, progress, certificates or access
(docs/refactor/progress/00-requirements.md, R3).
"""

from datetime import datetime
from typing import List
from fastapi import HTTPException, status
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.courses import Course
from src.db.courses.certifications import (
    CertificateUser,
    CertificateUserRead,
    Certifications,
)
from src.db.organizations import Organization
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep
from src.db.trails import Trail
from src.db.api_tokens import APIToken
from src.db.user_organizations import UserOrganization
from src.db.users import APITokenUser, User, UserRead
from src.services.analytics import events as analytics_events
from src.services.webhooks.dispatch import dispatch_webhooks
from src.security.features_utils.plan_check import get_org_plan
from src.security.features_utils.plans import plan_meets_requirement
from src.security.features_utils.usage import (
    decrease_feature_usage,
)
from src.security.rbac.constants import ADMIN_ROLE_ID


def _require_api_token(current_user) -> APITokenUser:
    """Ensure the current user is an API token."""
    if not isinstance(current_user, APITokenUser):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint requires API token authentication",
        )
    return current_user


async def _resolve_org_slug(org_slug: str, token_user: APITokenUser, db_session: AsyncSession) -> Organization:
    """Resolve an org_slug, verify it matches the API token's org, and check plan."""
    org = (await db_session.execute(
        select(Organization).where(Organization.slug == org_slug)
    )).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if org.id != token_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API token does not have access to this organization",
        )
    # Enforce pro plan requirement for admin API
    current_plan = await get_org_plan(org.id, db_session)
    if not plan_meets_requirement(current_plan, "pro"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin API requires a Pro plan or higher.",
        )
    return org


async def _get_user_in_org(user_id: int, org_id: int, db_session: AsyncSession) -> User:
    """Get a user and verify they belong to the token's organization (single JOIN)."""
    result = (await db_session.execute(
        select(User)
        .join(
            UserOrganization,
            (UserOrganization.user_id == User.id) & (UserOrganization.org_id == org_id),
        )
        .where(User.id == user_id)
    )).scalar_one_or_none()

    if result is None:
        # Distinguish "user not found" from "not a member" for a better error
        exists = (await db_session.execute(select(User.id).where(User.id == user_id))).scalar_one_or_none()
        if not exists:
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization",
        )
    return result


# -- Accounts -----------------------------------------------------------------


async def remove_user_from_org_admin(
    token_user: APITokenUser,
    user_id: int,
    db_session: AsyncSession,
) -> dict:
    """Remove a user's org membership (scope: membership only)."""

    await _get_user_in_org(user_id, token_user.org_id, db_session)

    membership = (await db_session.execute(
        select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.org_id == token_user.org_id,
        )
    )).scalars().first()
    if not membership:
        raise HTTPException(status_code=404, detail="User not in org")

    admin_memberships = (await db_session.execute(
        select(UserOrganization).where(
            UserOrganization.org_id == token_user.org_id,
            UserOrganization.role_id == ADMIN_ROLE_ID,
        )
    )).scalars().all()
    if len(admin_memberships) == 1 and admin_memberships[0].user_id == user_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot remove the last admin of the organization",
        )

    await db_session.delete(membership)
    await db_session.commit()

    try:
        from src.routers.users import _invalidate_session_cache
        _invalidate_session_cache(user_id)
    except Exception:
        pass

    try:
        await decrease_feature_usage("members", token_user.org_id, db_session)
    except Exception:
        pass

    await dispatch_webhooks(
        event_name=analytics_events.USER_REMOVED_FROM_ORG,
        org_id=token_user.org_id,
        data={"user_id": user_id, "org_id": token_user.org_id},
    )

    return {"detail": "User removed from org"}


async def get_user_by_email(
    token_user: APITokenUser,
    email: str,
    db_session: AsyncSession,
) -> UserRead:
    """Find a user by email within the token's org. 404 if not a member."""

    row = (await db_session.execute(
        select(User)
        .join(UserOrganization, UserOrganization.user_id == User.id)  # type: ignore
        .where(
            User.email == email,
            UserOrganization.org_id == token_user.org_id,
        )
    )).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found in this organization")
    return UserRead.model_validate(row)


# -- Course monitoring --------------------------------------------------------


async def list_course_enrollments(
    token_user: APITokenUser,
    course_uuid: str,
    db_session: AsyncSession,
    page: int = 1,
    limit: int = 25,
) -> List[dict]:
    """List users enrolled in a course within the token's org."""

    course = (await db_session.execute(
        select(Course).where(
            Course.course_uuid == course_uuid,
            Course.org_id == token_user.org_id,
        )
    )).scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    offset = (page - 1) * limit
    rows = (await db_session.execute(
        select(User, TrailRun)
        .join(TrailRun, TrailRun.user_id == User.id)  # type: ignore
        .where(
            TrailRun.course_id == course.id,
            TrailRun.org_id == token_user.org_id,
        )
        .order_by(TrailRun.creation_date.desc())  # type: ignore
        .offset(offset)
        .limit(limit)
    )).all()

    return [
        {
            "user": UserRead.model_validate(user).model_dump(),
            "enrolled_at": trail_run.creation_date,
            "status": trail_run.status.value if hasattr(trail_run.status, "value") else str(trail_run.status),
        }
        for user, trail_run in rows
    ]


# -- User profile -------------------------------------------------------------


_USER_UPDATABLE_FIELDS = {
    "username", "first_name", "last_name", "email",
    "avatar_image", "bio", "details", "profile",
}


async def update_user_profile(
    token_user: APITokenUser,
    user_id: int,
    updates: dict,
    db_session: AsyncSession,
) -> UserRead:
    """Update a user's profile fields. Org-scoped — user must be a member."""

    user = await _get_user_in_org(user_id, token_user.org_id, db_session)

    if "email" in updates and updates["email"] != user.email:
        existing = (await db_session.execute(
            select(User).where(User.email == updates["email"], User.id != user_id)
        )).scalars().first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")

    if "username" in updates and updates["username"] != user.username:
        existing = (await db_session.execute(
            select(User).where(User.username == updates["username"], User.id != user_id)
        )).scalars().first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already in use")

    # Reject phishing links in display-name fields here too — the admin API
    # token path must not be a way around the signup/profile-update guard.
    from src.services.security.profile_validation import validate_profile_fields

    name_check = validate_profile_fields({
        "username": updates.get("username"),
        "first_name": updates.get("first_name"),
        "last_name": updates.get("last_name"),
    })
    if not name_check.is_valid:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "PROFILE_FIELD_INVALID",
                "message": "Display name fields may not contain URLs or links",
                "errors": name_check.errors,
                "invalid_fields": name_check.invalid_fields,
            },
        )

    for field, value in updates.items():
        if field in _USER_UPDATABLE_FIELDS and value is not None:
            setattr(user, field, value)

    user.update_date = str(datetime.now())
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    try:
        from src.routers.users import _invalidate_session_cache
        _invalidate_session_cache(user_id)
    except Exception:
        pass

    return UserRead.model_validate(user)


# -- GDPR export / anonymize --------------------------------------------------


async def export_user_data(
    token_user: APITokenUser,
    user_id: int,
    db_session: AsyncSession,
) -> dict:
    """Full GDPR data export scoped to the token's org.

    Only returns data that belongs to the token's organization — other-org
    memberships and certificates are intentionally excluded so a token for
    org A cannot read a user's history in org B.
    """

    user = await _get_user_in_org(user_id, token_user.org_id, db_session)

    memberships = (await db_session.execute(
        select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.org_id == token_user.org_id,
        )
    )).scalars().all()

    trails = (await db_session.execute(
        select(Trail).where(
            Trail.user_id == user_id,
            Trail.org_id == token_user.org_id,
        )
    )).scalars().all()
    trail_runs = (await db_session.execute(
        select(TrailRun).where(
            TrailRun.user_id == user_id,
            TrailRun.org_id == token_user.org_id,
        )
    )).scalars().all()
    trail_steps = (await db_session.execute(
        select(TrailStep).where(
            TrailStep.user_id == user_id,
            TrailStep.org_id == token_user.org_id,
        )
    )).scalars().all()

    # Certificates scoped to this org via Certifications -> Course -> org_id
    cert_rows = (await db_session.execute(
        select(CertificateUser, Certifications, Course)
        .join(Certifications, Certifications.id == CertificateUser.certification_id)  # type: ignore
        .join(Course, Course.id == Certifications.course_id)  # type: ignore
        .where(
            CertificateUser.user_id == user_id,
            Course.org_id == token_user.org_id,
        )
    )).all()
    cert_users = [cu for cu, _cert, _course in cert_rows]


    return {
        "profile": UserRead.model_validate(user).model_dump(),
        "memberships": [m.model_dump() for m in memberships],
        "trails": [t.model_dump() for t in trails],
        "trail_runs": [tr.model_dump() for tr in trail_runs],
        "trail_steps": [ts.model_dump() for ts in trail_steps],
        "certificates": [
            CertificateUserRead(**cu.model_dump()).model_dump() for cu in cert_users
        ],
        "exported_at": datetime.now().isoformat(),
    }


async def anonymize_user(
    token_user: APITokenUser,
    user_id: int,
    db_session: AsyncSession,
) -> dict:
    """GDPR right-to-be-forgotten. Scrub PII, delete API tokens, invalidate session.

    Cross-org note: the ``User`` row is global (shared across all orgs the
    user belongs to), so scrubbing PII fields (email, name, avatar, bio,
    details, profile) affects every org. API token cleanup is scoped to the
    *caller's* org — tokens the user created in other orgs are NOT touched.
    If the user also belongs to other orgs, the caller should coordinate a
    purge in each org, or use a dedicated "global anonymize" flow (not
    exposed here) that has platform-wide authority.
    """

    user = await _get_user_in_org(user_id, token_user.org_id, db_session)

    # example.com is reserved by RFC 2606 and has no MX record, so the address
    # is undeliverable while still being a well-formed one. The previous
    # ".local" is a special-use name that email-validator rejects; rows scrubbed
    # before this change still carry it, which is why UserRead has to tolerate
    # stored addresses rather than re-validate them.
    placeholder_email = f"deleted-user-{user_id}@anonymized.example.com"
    placeholder_username = f"deleted_user_{user_id}"

    existing_tokens = (await db_session.execute(
        select(APIToken).where(
            APIToken.created_by_user_id == user_id,
            APIToken.org_id == token_user.org_id,
        )
    )).scalars().all()
    for token in existing_tokens:
        await db_session.delete(token)

    user.email = placeholder_email
    user.username = placeholder_username
    user.first_name = "Deleted"
    user.last_name = "User"
    user.avatar_image = ""
    user.bio = ""
    user.details = {}
    user.profile = {}
    user.password = ""
    user.email_verified = False
    user.email_verified_at = None
    user.last_login_ip = None
    user.signup_method = "anonymized"
    user.update_date = str(datetime.now())
    db_session.add(user)
    await db_session.commit()

    try:
        from src.routers.users import _invalidate_session_cache
        _invalidate_session_cache(user_id)
    except Exception:
        pass

    await dispatch_webhooks(
        event_name="user_anonymized",
        org_id=token_user.org_id,
        data={
            "user_id": user_id,
            "anonymized_email": placeholder_email,
            "api_tokens_revoked": len(existing_tokens),
        },
    )

    return {
        "detail": "User anonymized",
        "user_id": user_id,
        "anonymized_email": placeholder_email,
        "api_tokens_revoked": len(existing_tokens),
    }


# -- Course analytics ---------------------------------------------------------


async def get_course_analytics(
    token_user: APITokenUser,
    course_uuid: str,
    db_session: AsyncSession,
) -> dict:
    """Aggregate course stats: enrollment, completion, in-progress, cert count."""

    from src.db.trail_runs import StatusEnum

    course = (await db_session.execute(
        select(Course).where(
            Course.course_uuid == course_uuid,
            Course.org_id == token_user.org_id,
        )
    )).scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    total_activities = (await db_session.execute(
        select(func.count(ChapterActivity.id)).where(  # type: ignore
            ChapterActivity.course_id == course.id
        )
    )).scalar_one()

    trail_runs = (await db_session.execute(
        select(TrailRun).where(
            TrailRun.course_id == course.id,
            TrailRun.org_id == token_user.org_id,
        )
    )).scalars().all()

    enrollment_count = len(trail_runs)
    completed_count = sum(1 for tr in trail_runs if tr.status == StatusEnum.STATUS_COMPLETED)
    in_progress_count = sum(1 for tr in trail_runs if tr.status == StatusEnum.STATUS_IN_PROGRESS)

    average_completion_percentage = 0.0
    if trail_runs and total_activities:
        # Single GROUP BY query replaces one query per enrolled user
        completion_rows = (await db_session.execute(
            select(TrailStep.user_id, func.count(TrailStep.id))  # type: ignore
            .where(
                TrailStep.course_id == course.id,
                TrailStep.complete == True,
            )
            .group_by(TrailStep.user_id)
        )).all()
        completed_by_user = {row[0]: row[1] for row in completion_rows}
        if trail_runs:
            total_pct = sum(
                completed_by_user.get(tr.user_id, 0) / total_activities * 100
                for tr in trail_runs
            )
            average_completion_percentage = round(total_pct / len(trail_runs), 1)

    certificate_count = 0
    certification = (await db_session.execute(
        select(Certifications).where(Certifications.course_id == course.id)
    )).scalars().first()
    if certification:
        certificate_count = (await db_session.execute(
            select(func.count(CertificateUser.id)).where(  # type: ignore
                CertificateUser.certification_id == certification.id
            )
        )).scalar_one()

    return {
        "course_uuid": course_uuid,
        "enrollment_count": enrollment_count,
        "completed_count": completed_count,
        "in_progress_count": in_progress_count,
        "total_activities": total_activities,
        "average_completion_percentage": average_completion_percentage,
        "certificate_count": certificate_count,
    }
