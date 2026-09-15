"""
Tests for the Admin API service layer.

Tests the headless admin API functions that operate via API token authentication.
Uses an in-memory SQLite database with real SQLModel tables.
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, patch
from sqlmodel import SQLModel, select
from sqlalchemy import JSON
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import HTTPException
from starlette.requests import Request

from src.db.users import APITokenUser, User
from src.db.organizations import Organization
from src.db.user_organizations import UserOrganization
from src.db.courses.courses import Course
from src.db.courses.certifications import CertificateUser, Certifications
from src.db.courses.chapters import Chapter
from src.db.courses.activities import Activity, ActivityTypeEnum, ActivitySubTypeEnum
from src.db.courses.chapter_activities import ChapterActivity
from src.db.trails import Trail
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep
from src.db.api_tokens import APIToken
from src.db.roles import Role, RoleTypeEnum

from src.services.admin.admin import (_require_api_token, _resolve_org_slug, _get_user_in_org, anonymize_user, export_user_data, get_course_analytics, get_user_by_email, list_course_enrollments, remove_user_from_org_admin, update_user_profile)


# ── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
async def engine():
    # Replace JSONB columns with JSON before creating tables
    for table in SQLModel.metadata.tables.values():
        for col in table.columns:
            if isinstance(col.type, JSONB):
                col.type = JSON()

    eng = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with eng.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest.fixture
async def db(engine):
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest.fixture
async def org(db):
    org = Organization(
        id=1,
        name="Test Org",
        slug="test-org",
        email="test@org.com",
        org_uuid="org_test123",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org


@pytest.fixture
async def other_org(db):
    org = Organization(
        id=2,
        name="Other Org",
        slug="other-org",
        email="other@org.com",
        org_uuid="org_other456",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org


@pytest.fixture
async def user(db, org):
    u = User(
        id=1,
        username="testuser",
        first_name="Test",
        last_name="User",
        email="test@example.com",
        password="hashed",
        user_uuid="user_test123",
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)

    membership = UserOrganization(
        user_id=u.id, org_id=org.id, role_id=1,
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(membership)
    await db.commit()
    return u


@pytest.fixture
def token_user(org, user):
    return APITokenUser(
        id=1,
        user_uuid="apitoken_test123",
        username="api_token",
        org_id=org.id,
        token_name="Test Token",
        created_by_user_id=user.id,
    )


@pytest.fixture
def other_org_token(other_org):
    return APITokenUser(
        id=2,
        user_uuid="apitoken_other456",
        username="api_token",
        org_id=other_org.id,
        token_name="Other Org Token",
        created_by_user_id=99,
    )


@pytest.fixture
async def course(db, org):
    c = Course(
        id=1,
        name="Test Course",
        description="A test course",
        public=True,
        published=True,
        open_to_contributors=False,
        org_id=org.id,
        course_uuid="course_test123",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


@pytest.fixture
async def unpublished_course(db, org):
    c = Course(
        id=2,
        name="Unpublished Course",
        description="Not published",
        public=False,
        published=False,
        open_to_contributors=False,
        org_id=org.id,
        course_uuid="course_unpub456",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


@pytest.fixture
async def chapter(db, org, course):
    ch = Chapter(
        id=1,
        name="Test Chapter",
        description="A chapter",
        org_id=org.id,
        course_id=course.id,
        chapter_uuid="chapter_test123",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(ch)
    await db.commit()
    await db.refresh(ch)
    return ch


@pytest.fixture
async def activity(db, org, course):
    a = Activity(
        id=1,
        name="Test Activity",
        activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE,
        published=True,
        org_id=org.id,
        course_id=course.id,
        activity_uuid="activity_test123",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return a


@pytest.fixture
async def chapter_activity(db, org, course, chapter, activity):
    ca = ChapterActivity(
        id=1,
        order=1,
        chapter_id=chapter.id,
        activity_id=activity.id,
        course_id=course.id,
        org_id=org.id,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(ca)
    await db.commit()
    await db.refresh(ca)
    return ca


@pytest.fixture
async def foreign_activity(db, other_org):
    foreign_course = Course(
        id=200,
        name="Foreign Course",
        description="A foreign course",
        public=True,
        published=True,
        open_to_contributors=False,
        org_id=other_org.id,
        course_uuid="course_foreign200",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(foreign_course)
    await db.commit()
    await db.refresh(foreign_course)

    foreign_activity = Activity(
        id=200,
        name="Foreign Activity",
        activity_type=ActivityTypeEnum.TYPE_DYNAMIC,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DYNAMIC_PAGE,
        published=True,
        org_id=other_org.id,
        course_id=foreign_course.id,
        activity_uuid="activity_foreign200",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(foreign_activity)
    await db.commit()
    await db.refresh(foreign_activity)
    return foreign_activity


@pytest.fixture
def mock_request():
    """Create a minimal mock request for functions that need it."""
    scope = {"type": "http", "method": "GET", "path": "/", "headers": [], "query_string": b""}
    return Request(scope)


@pytest.fixture
async def second_user(db, org):
    """A second org member, used in bulk-enroll and group-membership tests."""
    u = User(
        id=20,
        username="bob",
        first_name="Bob",
        last_name="User",
        email="bob@example.com",
        password="hashed",
        user_uuid="user_bob20",
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    membership = UserOrganization(
        user_id=u.id, org_id=org.id, role_id=4,
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(membership)
    await db.commit()
    return u


@pytest.fixture
async def org_admin_user(db, org):
    """A user with the admin role in the org — required for last-admin tests."""
    u = User(
        id=30,
        username="orgadmin",
        first_name="Admin",
        last_name="Root",
        email="admin@example.com",
        password="hashed",
        user_uuid="user_admin30",
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    membership = UserOrganization(
        user_id=u.id, org_id=org.id, role_id=1,  # ADMIN_ROLE_ID
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(membership)
    await db.commit()
    return u


@pytest.fixture
async def certification(db, course):
    """A Certifications row tied to the test course."""
    cert = Certifications(
        id=1,
        certification_uuid="certification_test123",
        course_id=course.id,
        config={},
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(cert)
    await db.commit()
    await db.refresh(cert)
    return cert


@pytest.fixture
async def student_role(db, org):
    """A student role in the test org — used for role-change tests."""
    role = Role(
        id=4,
        name="Student",
        description="Default student role",
        rights={},
        org_id=org.id,
        role_type=RoleTypeEnum.TYPE_ORGANIZATION,
        role_uuid="role_student_4",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return role


@pytest.fixture
async def admin_role(db, org):
    """The admin role (id=1) for role-change tests."""
    role = Role(
        id=1,
        name="Admin",
        description="Org admin role",
        rights={},
        org_id=org.id,
        role_type=RoleTypeEnum.TYPE_ORGANIZATION,
        role_uuid="role_admin_1",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return role


@pytest.fixture
def mock_admin_side_effects():
    """Mock side-effect calls (webhooks, analytics, usage, redis cache).

    These external dependencies are not available in the sqlite test environment.
    """
    patches = [
        patch("src.services.admin.admin.dispatch_webhooks", new_callable=AsyncMock),
        patch("src.services.admin.admin.track", new_callable=AsyncMock),
        patch("src.services.admin.admin.check_limits_with_usage", new_callable=AsyncMock, return_value=True),
        patch("src.services.admin.admin.increase_feature_usage", new_callable=AsyncMock, return_value=True),
        patch("src.services.admin.admin.decrease_feature_usage", new_callable=AsyncMock, return_value=True),
    ]
    started = [p.start() for p in patches]
    yield {
        "dispatch_webhooks": started[0],
        "track": started[1],
        "check_limits_with_usage": started[2],
        "increase_feature_usage": started[3],
        "decrease_feature_usage": started[4],
    }
    for p in patches:
        p.stop()


# ── Helper: patch plan check ────────────────────────────────────────────────

def _patch_plan():
    """Patch plan check to always allow (returns 'pro')."""
    return patch(
        "src.services.admin.admin.get_org_plan",
        return_value="pro",
    )


def _patch_plan_and_meets():
    """Patch both plan functions for _resolve_org_slug."""
    return [
        patch("src.services.admin.admin.get_org_plan", return_value="pro"),
        patch("src.services.admin.admin.plan_meets_requirement", return_value=True),
    ]


# ── Auth / Guard tests ─────────────────────────────────────────────────────


class TestRequireApiToken:

    def test_accepts_api_token_user(self, token_user):
        result = _require_api_token(token_user)
        assert isinstance(result, APITokenUser)
        assert result.org_id == token_user.org_id

    def test_rejects_regular_user(self):
        from src.db.users import PublicUser
        regular = PublicUser(
            id=1, email="a@b.com", username="x",
            first_name="A", last_name="B", user_uuid="u1",
        )
        with pytest.raises(HTTPException) as exc:
            _require_api_token(regular)
        assert exc.value.status_code == 403

    def test_rejects_anonymous_user(self):
        from src.db.users import AnonymousUser
        with pytest.raises(HTTPException) as exc:
            _require_api_token(AnonymousUser())
        assert exc.value.status_code == 403


class TestResolveOrgSlug:

    async def test_resolves_matching_org(self, token_user, org, db):
        with _patch_plan(), patch("src.services.admin.admin.plan_meets_requirement", return_value=True):
            result = await _resolve_org_slug("test-org", token_user, db)
        assert result.id == org.id

    async def test_rejects_unknown_slug(self, token_user, db):
        with pytest.raises(HTTPException) as exc:
            await _resolve_org_slug("nonexistent", token_user, db)
        assert exc.value.status_code == 404

    async def test_rejects_mismatched_org(self, other_org_token, org, db):
        with _patch_plan(), patch("src.services.admin.admin.plan_meets_requirement", return_value=True):
            with pytest.raises(HTTPException) as exc:
                await _resolve_org_slug("test-org", other_org_token, db)
            assert exc.value.status_code == 403

    async def test_rejects_insufficient_plan(self, token_user, org, db):
        with patch("src.services.admin.admin.get_org_plan", return_value="free"), \
             patch("src.services.admin.admin.plan_meets_requirement", return_value=False):
            with pytest.raises(HTTPException) as exc:
                await _resolve_org_slug("test-org", token_user, db)
            assert exc.value.status_code == 403
            assert "Pro plan" in exc.value.detail


class TestGetUserInOrg:

    async def test_returns_user_in_org(self, user, org, db):
        result = await _get_user_in_org(user.id, org.id, db)
        assert result.id == user.id

    async def test_rejects_nonexistent_user(self, org, db):
        with pytest.raises(HTTPException) as exc:
            await _get_user_in_org(9999, org.id, db)
        assert exc.value.status_code == 404

    async def test_rejects_user_not_in_org(self, user, other_org, db):
        with pytest.raises(HTTPException) as exc:
            await _get_user_in_org(user.id, other_org.id, db)
        assert exc.value.status_code == 403


# ── Course access tests ─────────────────────────────────────────────────────


# ── Enrollment endpoint tests ──────────────────────────────────────────────


# ── Progress endpoint tests ────────────────────────────────────────────────


class TestGetUserTrailDetail:

    @pytest.fixture
    async def course_chapter(self, db, org, course, chapter):
        from src.db.courses.course_chapters import CourseChapter
        cc = CourseChapter(
            order=1,
            course_id=course.id,
            chapter_id=chapter.id,
            org_id=org.id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db.add(cc)
        await db.commit()
        await db.refresh(cc)
        return cc


# ── Auth token endpoint tests ──────────────────────────────────────────────


class TestIssueUserToken:

    @pytest.fixture
    def reader_token(self, token_user):
        """Impersonation needs the token to actually hold users.action_read."""
        token_user.rights = {"users": {"action_read": True}}
        return token_user

    @pytest.fixture
    async def member(self, org, db):
        """A non-privileged target — admins/maintainers cannot be impersonated."""
        u = User(
            id=77,
            username="member",
            first_name="Mem",
            last_name="Ber",
            email="member@example.com",
            password="hashed",
            user_uuid="user_member77",
        )
        db.add(u)
        await db.commit()
        await db.refresh(u)
        db.add(UserOrganization(
            user_id=u.id, org_id=org.id, role_id=4,
            creation_date=str(datetime.now()), update_date=str(datetime.now()),
        ))
        await db.commit()
        return u


# ── Provision user tests ────────────────────────────────────────────────────


# ── Remove user from org tests ──────────────────────────────────────────────


class TestRemoveUserFromOrg:

    async def test_removes_membership(self, token_user, second_user, db, mock_admin_side_effects):
        result = await remove_user_from_org_admin(token_user, second_user.id, db)
        assert result["detail"] == "User removed from org"

        membership = (await db.execute(
            select(UserOrganization).where(
                UserOrganization.user_id == second_user.id,
                UserOrganization.org_id == token_user.org_id,
            )
        )).scalars().first()
        assert membership is None

        still_exists = (await db.execute(select(User).where(User.id == second_user.id))).scalars().first()
        assert still_exists is not None

    async def test_last_admin_blocked(self, org, org_admin_user, db, mock_admin_side_effects):
        admin_token = APITokenUser(
            id=77,
            user_uuid="apitoken_admin",
            username="api_token",
            org_id=org.id,
            token_name="Admin Token",
            created_by_user_id=org_admin_user.id,
        )
        with pytest.raises(HTTPException) as exc:
            await remove_user_from_org_admin(admin_token, org_admin_user.id, db)
        assert exc.value.status_code == 400


# ── Get user by email tests ─────────────────────────────────────────────────


class TestGetUserByEmail:

    async def test_finds_user_in_org(self, token_user, user, db):
        result = await get_user_by_email(token_user, user.email, db)
        assert result.id == user.id
        assert result.email == user.email

    async def test_user_in_other_org_returns_404(self, token_user, other_org, db):
        outsider = User(
            id=50, username="outsider50", first_name="Out", last_name="Sider",
            email="outsider50@example.com", password="hashed", user_uuid="user_out50",
        )
        db.add(outsider)
        await db.commit()
        db.add(UserOrganization(
            user_id=outsider.id, org_id=other_org.id, role_id=1,
            creation_date=str(datetime.now()), update_date=str(datetime.now()),
        ))
        await db.commit()

        with pytest.raises(HTTPException) as exc:
            await get_user_by_email(token_user, "outsider50@example.com", db)
        assert exc.value.status_code == 404

    async def test_nonexistent_email_returns_404(self, token_user, db):
        with pytest.raises(HTTPException) as exc:
            await get_user_by_email(token_user, "nobody@example.com", db)
        assert exc.value.status_code == 404


# ── Magic link tests ────────────────────────────────────────────────────────


# ── Bulk enroll tests ───────────────────────────────────────────────────────


# ── List course enrollments tests ───────────────────────────────────────────


class TestListCourseEnrollments:


    async def test_empty_course(self, token_user, course, db):
        result = await list_course_enrollments(token_user, course.course_uuid, db)
        assert result == []


# ── Reset progress tests ────────────────────────────────────────────────────


# ── Award / revoke certificate tests ────────────────────────────────────────


# ── User group membership tests ─────────────────────────────────────────────


# ── Update user profile tests ───────────────────────────────────────────────


class TestUpdateUserProfile:

    async def test_updates_fields(self, token_user, user, db):
        result = await update_user_profile(
            token_user, user.id,
            {"first_name": "Updated", "bio": "New bio"},
            db,
        )
        assert result.first_name == "Updated"
        assert result.bio == "New bio"

    async def test_partial_update_preserves_other_fields(self, token_user, user, db):
        original_email = user.email
        await update_user_profile(token_user, user.id, {"first_name": "Changed"}, db)
        await db.refresh(user)
        assert user.first_name == "Changed"
        assert user.email == original_email

    async def test_duplicate_email_rejected(self, token_user, user, second_user, db):
        with pytest.raises(HTTPException) as exc:
            await update_user_profile(
                token_user, user.id, {"email": second_user.email}, db
            )
        assert exc.value.status_code == 400

    async def test_duplicate_username_rejected(self, token_user, user, second_user, db):
        with pytest.raises(HTTPException) as exc:
            await update_user_profile(
                token_user, user.id, {"username": second_user.username}, db
            )
        assert exc.value.status_code == 400


    async def test_rejects_url_in_display_name(self, token_user, user, db):
        # The admin API path must not be a way around the display-name URL guard.
        with pytest.raises(HTTPException) as exc:
            await update_user_profile(
                token_user, user.id, {"username": "win money http://evil.io"}, db
            )
        assert exc.value.status_code == 400
        assert exc.value.detail["code"] == "PROFILE_FIELD_INVALID"


# ── Change user role tests ──────────────────────────────────────────────────


# ── User group CRUD tests ───────────────────────────────────────────────────


# ── Cohort → course access tests ────────────────────────────────────────────


# ── Bulk unenroll tests ─────────────────────────────────────────────────────


# ── GDPR export / anonymize tests ───────────────────────────────────────────


class TestExportUserData:


    async def test_filters_out_other_org_memberships(self, token_user, user, other_org, db):
        """User is in test org and other_org; export from test token must only return test org's membership."""
        db.add(UserOrganization(
            user_id=user.id, org_id=other_org.id, role_id=4,
            creation_date=str(datetime.now()), update_date=str(datetime.now()),
        ))
        await db.commit()

        result = await export_user_data(token_user, user.id, db)
        assert len(result["memberships"]) == 1
        assert result["memberships"][0]["org_id"] == token_user.org_id

    async def test_filters_out_other_org_certificates(self, token_user, user, other_org, db):
        """Certs in another org should not appear in this org's export."""
        # Create a course + certification + cert_user in the OTHER org
        other_course = Course(
            id=555, name="Other course", description="", public=True, published=True,
            open_to_contributors=False, org_id=other_org.id,
            course_uuid="course_other555",
            creation_date=str(datetime.now()), update_date=str(datetime.now()),
        )
        db.add(other_course)
        await db.commit()
        await db.refresh(other_course)

        other_cert = Certifications(
            id=555, certification_uuid="cert_other555",
            course_id=other_course.id, config={},
            creation_date=str(datetime.now()), update_date=str(datetime.now()),
        )
        db.add(other_cert)
        await db.commit()

        db.add(CertificateUser(
            id=555, user_id=user.id, certification_id=other_cert.id,
            user_certification_uuid="uc_other_555",
            created_at=str(datetime.now()), updated_at=str(datetime.now()),
        ))
        await db.commit()

        result = await export_user_data(token_user, user.id, db)
        assert result["certificates"] == []


class TestAnonymizeUser:

    async def test_scrubs_pii(self, token_user, user, db, mock_admin_side_effects):
        original_email = user.email
        result = await anonymize_user(token_user, user.id, db)
        assert result["api_tokens_revoked"] == 0
        assert "deleted-user-" in result["anonymized_email"]

        await db.refresh(user)
        assert user.email != original_email
        assert user.email == f"deleted-user-{user.id}@anonymized.example.com"
        assert user.first_name == "Deleted"
        assert user.password == ""
        assert user.email_verified is False
        assert user.signup_method == "anonymized"

    async def test_revokes_api_tokens(self, token_user, user, db, mock_admin_side_effects):
        api_token = APIToken(
            id=500,
            name="User's token",
            token_uuid="apitoken_user_500",
            token_prefix="lh_user500",
            token_hash="abc" * 20,
            org_id=token_user.org_id,
            created_by_user_id=user.id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
            is_active=True,
        )
        db.add(api_token)
        await db.commit()

        result = await anonymize_user(token_user, user.id, db)
        assert result["api_tokens_revoked"] == 1

        remaining = (await db.execute(
            select(APIToken).where(APIToken.created_by_user_id == user.id)
        )).scalars().all()
        assert remaining == []

    async def test_does_not_revoke_other_org_api_tokens(self, token_user, user, other_org, db, mock_admin_side_effects):
        """Anonymize in org A must NOT delete the user's API tokens in org B."""
        other_org_token = APIToken(
            id=600,
            name="Other org token",
            token_uuid="apitoken_user_600",
            token_prefix="lh_user600",
            token_hash="def" * 20,
            org_id=other_org.id,
            created_by_user_id=user.id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
            is_active=True,
        )
        db.add(other_org_token)
        await db.commit()

        result = await anonymize_user(token_user, user.id, db)
        assert result["api_tokens_revoked"] == 0

        remaining = (await db.execute(
            select(APIToken).where(APIToken.org_id == other_org.id)
        )).scalars().all()
        assert len(remaining) == 1


# ── Course analytics tests ──────────────────────────────────────────────────


class TestCourseAnalytics:

    async def test_empty_course(self, token_user, course, db):
        result = await get_course_analytics(token_user, course.course_uuid, db)
        assert result["course_uuid"] == course.course_uuid
        assert result["enrollment_count"] == 0
        assert result["completed_count"] == 0
        assert result["average_completion_percentage"] == 0.0
        assert result["certificate_count"] == 0


    async def test_course_not_found(self, token_user, db):
        with pytest.raises(HTTPException) as exc:
            await get_course_analytics(token_user, "missing", db)
        assert exc.value.status_code == 404
