"""Extra tests for src.services.admin.admin to improve coverage.

Targets:
  Lines 847-848, 852-853 - remove_user_from_org_admin exception swallowing
  Line 827  - remove_user_from_org_admin user not in org (second membership check)
  Line 899  - _validate_magic_link_redirect whitespace-only returns None
  Lines 986, 995 - consume_magic_link_token incomplete payload / ghost user
  Line 1125 - list_course_enrollments course not found
  Line 1227 - award_certificate course not found
  Lines 1276, 1282 - revoke_certificate cert/course boundary checks
  Lines 1509-1510 - update_user_profile _invalidate_session_cache swallowed
  Line 1529 - change_user_role role belongs to wrong org
  Line 1538 - change_user_role user not in org (second membership check)
  Lines 1561-1562 - change_user_role _invalidate_session_cache swallowed
  Line 1836 - bulk_unenroll_users enrolled user with TrailSteps -> steps deleted
  Lines 1979-1980 - anonymize_user _invalidate_session_cache swallowed
  Line 2058 - get_course_analytics certification + CertificateUser count > 0
"""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from src.db.courses.certifications import CertificateUser, Certifications
from src.db.courses.courses import Course
from src.db.roles import Role, RoleTypeEnum
from src.db.trail_runs import StatusEnum, TrailRun
from src.db.trail_steps import TrailStep
from src.db.trails import Trail
from src.db.user_organizations import UserOrganization
from src.db.users import APITokenUser, User
from src.services.admin.admin import (anonymize_user, get_course_analytics, list_course_enrollments, remove_user_from_org_admin, update_user_profile)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_token_user(org_id: int) -> APITokenUser:
    return APITokenUser(
        id=99,
        user_uuid="api_token_user",
        username="api_token_user",
        org_id=org_id,
        rights={},
        token_name="test-token",
        created_by_user_id=1,
    )


async def _add_user_to_org(db, user: User, org, role_id: int = 4) -> UserOrganization:
    uo = UserOrganization(
        user_id=user.id,
        org_id=org.id,
        role_id=role_id,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(uo)
    await db.commit()
    return uo


async def _create_user(db, *, user_id: int, username: str, email: str) -> User:
    u = User(
        id=user_id,
        username=username,
        first_name="Test",
        last_name="User",
        email=email,
        password="hashed",
        user_uuid=f"user_{username}",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


async def _create_certification(db, course, *, cert_id: int = 10) -> Certifications:
    cert = Certifications(
        id=cert_id,
        course_id=course.id,
        config={},
        certification_uuid=f"cert_{cert_id}",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(cert)
    await db.commit()
    await db.refresh(cert)
    return cert


async def _create_certificate_user(
    db,
    certification: Certifications,
    user: User,
    *,
    cu_id: int = 20,
    uuid: str = "cert-user-uuid-extra",
) -> CertificateUser:
    cu = CertificateUser(
        id=cu_id,
        user_id=user.id,
        certification_id=certification.id,
        user_certification_uuid=uuid,
        created_at=str(datetime.now()),
        updated_at=str(datetime.now()),
    )
    db.add(cu)
    await db.commit()
    await db.refresh(cu)
    return cu


async def _create_trail_run(db, user: User, course: Course, org) -> TrailRun:
    trail = Trail(
        org_id=org.id,
        user_id=user.id,
        trail_uuid=f"trail_{user.id}",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(trail)
    await db.commit()
    await db.refresh(trail)

    tr = TrailRun(
        trail_id=trail.id,
        course_id=course.id,
        org_id=org.id,
        user_id=user.id,
        status=StatusEnum.STATUS_IN_PROGRESS,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(tr)
    await db.commit()
    await db.refresh(tr)
    return tr


# ---------------------------------------------------------------------------
# Line 899 — _validate_magic_link_redirect whitespace-only
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Lines 986, 995 — consume_magic_link_token
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Line 1125 — list_course_enrollments course not found
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_course_enrollments_course_not_found(db, org):
    token_user = _make_token_user(org.id)
    with pytest.raises(HTTPException) as exc_info:
        await list_course_enrollments(token_user, "nonexistent-uuid", db)
    assert exc_info.value.status_code == 404
    assert "course not found" in exc_info.value.detail.lower()


# ---------------------------------------------------------------------------
# Line 1227 — award_certificate course not found
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Lines 1276, 1282 — revoke_certificate boundary checks
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Lines 847-848, 852-853 — remove_user_from_org_admin exception swallowing
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_remove_user_from_org_invalidate_cache_raises_is_swallowed(db, org, admin_role, user_role):
    """Lines 847-848: _invalidate_session_cache raises → swallowed, function succeeds."""
    token_user = _make_token_user(org.id)

    # We need an admin user in the org too (so we're not removing the last admin)
    admin_user = await _create_user(db, user_id=60, username="admin60", email="admin60@test.com")
    await _add_user_to_org(db, admin_user, org, role_id=admin_role.id)

    # Another admin so there are 2 admins (prevents last-admin guard)
    admin_user2 = await _create_user(db, user_id=61, username="admin61", email="admin61@test.com")
    await _add_user_to_org(db, admin_user2, org, role_id=admin_role.id)

    # Regular user to remove
    reg_user = await _create_user(db, user_id=62, username="reg62", email="reg62@test.com")
    await _add_user_to_org(db, reg_user, org, role_id=user_role.id)

    with patch("src.services.admin.admin.dispatch_webhooks", new_callable=AsyncMock):
        with patch("src.routers.users._invalidate_session_cache", side_effect=RuntimeError("cache fail")):
            with patch("src.services.admin.admin.decrease_feature_usage"):
                result = await remove_user_from_org_admin(token_user, reg_user.id, db)

    assert result == {"detail": "User removed from org"}


@pytest.mark.asyncio
async def test_remove_user_from_org_decrease_feature_usage_raises_is_swallowed(db, org, admin_role, user_role):
    """Lines 852-853: decrease_feature_usage raises → swallowed, function succeeds."""
    token_user = _make_token_user(org.id)

    admin_user = await _create_user(db, user_id=63, username="admin63", email="admin63@test.com")
    await _add_user_to_org(db, admin_user, org, role_id=admin_role.id)

    admin_user2 = await _create_user(db, user_id=64, username="admin64", email="admin64@test.com")
    await _add_user_to_org(db, admin_user2, org, role_id=admin_role.id)

    reg_user = await _create_user(db, user_id=65, username="reg65", email="reg65@test.com")
    await _add_user_to_org(db, reg_user, org, role_id=user_role.id)

    with patch("src.services.admin.admin.dispatch_webhooks", new_callable=AsyncMock):
        with patch("src.routers.users._invalidate_session_cache"):
            with patch("src.services.admin.admin.decrease_feature_usage", side_effect=RuntimeError("usage fail")):
                result = await remove_user_from_org_admin(token_user, reg_user.id, db)

    assert result == {"detail": "User removed from org"}


# ---------------------------------------------------------------------------
# Lines 1509-1510 — update_user_profile _invalidate_session_cache swallowed
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_user_profile_invalidate_cache_raises_is_swallowed(db, org, user_role):
    """Lines 1509-1510: _invalidate_session_cache raises → swallowed."""
    token_user = _make_token_user(org.id)
    user = await _create_user(db, user_id=70, username="profile70", email="profile70@test.com")
    await _add_user_to_org(db, user, org, role_id=user_role.id)

    with patch("src.routers.users._invalidate_session_cache", side_effect=RuntimeError("cache fail")):
        result = await update_user_profile(token_user, user.id, {"bio": "updated bio"}, db)

    assert result.id == user.id


# ---------------------------------------------------------------------------
# Line 1529 — change_user_role role belongs to wrong org
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Lines 1561-1562 — change_user_role _invalidate_session_cache swallowed
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Line 1836 — bulk_unenroll_users user with no TrailRun → not_enrolled
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Lines 1979-1980 — anonymize_user _invalidate_session_cache swallowed
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_anonymize_user_invalidate_cache_raises_is_swallowed(db, org, user_role):
    """Lines 1979-1980: _invalidate_session_cache raises → swallowed."""
    token_user = _make_token_user(org.id)
    user = await _create_user(db, user_id=100, username="anon100", email="anon100@test.com")
    await _add_user_to_org(db, user, org, role_id=user_role.id)

    with patch("src.services.admin.admin.dispatch_webhooks", new_callable=AsyncMock):
        with patch("src.routers.users._invalidate_session_cache", side_effect=RuntimeError("cache fail")):
            result = await anonymize_user(token_user, user.id, db)

    assert result["user_id"] == user.id
    assert "anonymized" in result["detail"].lower()


# ---------------------------------------------------------------------------
# Line 2058 — get_course_analytics certification + CertificateUser count > 0
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_course_analytics_with_certification_and_cert_users(db, org, course, user_role):
    """Line 2058: certification exists and CertificateUser count > 0."""
    token_user = _make_token_user(org.id)
    user = await _create_user(db, user_id=110, username="certuser110", email="certuser110@test.com")
    await _add_user_to_org(db, user, org, role_id=user_role.id)

    cert = await _create_certification(db, course, cert_id=12)
    await _create_certificate_user(db, cert, user, cu_id=40, uuid="analytics-cert-uuid")

    result = await get_course_analytics(token_user, course.course_uuid, db)

    assert result["course_uuid"] == course.course_uuid
    assert result["certificate_count"] == 1


# ---------------------------------------------------------------------------
# Line 827 — remove_user_from_org_admin: user passes _get_user_in_org but
# no UserOrganization row exists (second membership query returns None).
# We patch _get_user_in_org to bypass the first check.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_remove_user_from_org_admin_no_membership_row_raises_404(db, org):
    """Line 827: _get_user_in_org succeeds but UserOrganization row missing."""
    token_user = _make_token_user(org.id)
    user = await _create_user(db, user_id=120, username="orphan120", email="orphan120@test.com")

    with patch("src.services.admin.admin._get_user_in_org", return_value=user):
        with pytest.raises(HTTPException) as exc_info:
            await remove_user_from_org_admin(token_user, user.id, db)

    assert exc_info.value.status_code == 404
    assert "User not in org" in exc_info.value.detail


# ---------------------------------------------------------------------------
# Line 1538 — change_user_role: user passes _get_user_in_org but no
# UserOrganization row exists (second membership query returns None).
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Line 1836 — bulk_unenroll_users: enrolled user with TrailSteps gets steps
# deleted (the db_session.delete(step) branch).
# ---------------------------------------------------------------------------


