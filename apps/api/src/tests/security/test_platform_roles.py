"""Account types (admin / student) are computed on the backend, from the
platform org membership only, and enforced by dependencies — not by the UI."""

from datetime import datetime
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from src.db.roles import Role, RoleTypeEnum
from src.db.user_organizations import UserOrganization
from src.db.users import APITokenUser, AnonymousUser, PublicUser, User
from src.security.platform_roles import (
    require_admin_account,
    require_platform_admin,
    resolve_platform_access,
    role_grants_dashboard_access,
)
from src.services.users.users import get_user_session
from src.tests.conftest import ADMIN_RIGHTS, USER_RIGHTS


def _now() -> str:
    return str(datetime.now())


async def _add_user(db, user_id: int, *, is_superadmin: bool = False) -> PublicUser:
    u = User(
        id=user_id,
        username=f"user{user_id}",
        first_name="F",
        last_name="L",
        email=f"user{user_id}@test.com",
        password="hashed",
        user_uuid=f"user_{user_id}",
        is_superadmin=is_superadmin,
        creation_date=_now(),
        update_date=_now(),
    )
    db.add(u)
    await db.commit()
    return PublicUser(
        id=u.id,
        username=u.username,
        first_name=u.first_name,
        last_name=u.last_name,
        email=u.email,
        user_uuid=u.user_uuid,
        is_superadmin=is_superadmin,
    )


async def _join(db, user_id: int, org_id: int, role_id: int) -> None:
    db.add(
        UserOrganization(
            user_id=user_id, org_id=org_id, role_id=role_id,
            creation_date=_now(), update_date=_now(),
        )
    )
    await db.commit()


@pytest.fixture
async def staff_role(db, org):
    """An Instructor-like role: dashboard access, but not the Admin role."""
    rights = USER_RIGHTS.model_dump()
    rights["dashboard"] = {"action_access": True}
    r = Role(
        id=3, name="Instructor", org_id=None, role_type=RoleTypeEnum.TYPE_GLOBAL,
        role_uuid="role_instructor", rights=rights, creation_date=_now(), update_date=_now(),
    )
    db.add(r)
    await db.commit()
    return r


class TestResolvePlatformAccess:
    async def test_student_role_is_a_student(self, db, org, regular_user):
        access = await resolve_platform_access(regular_user.id, db)
        assert access.role == "student"
        assert access.can_manage_platform is False
        assert access.platform_org_id == org.id

    async def test_admin_role_is_an_admin_who_can_manage_the_platform(self, db, org, admin_user):
        access = await resolve_platform_access(admin_user.id, db)
        assert access.role == "admin"
        assert access.can_manage_platform is True

    async def test_staff_role_is_an_admin_without_platform_console(self, db, org, user_role, staff_role):
        await _add_user(db, 10)
        await _join(db, 10, org.id, staff_role.id)
        access = await resolve_platform_access(10, db)
        assert access.role == "admin"
        assert access.can_manage_platform is False

    async def test_superadmin_without_membership_is_a_platform_admin(self, db, org):
        await _add_user(db, 11, is_superadmin=True)
        access = await resolve_platform_access(11, db)
        assert access.role == "admin"
        assert access.can_manage_platform is True

    async def test_admin_role_in_another_org_does_not_make_an_admin(
        self, db, org, other_org, admin_role, user_role
    ):
        # Admin of a second org row (e.g. a leftover demo org), student of the platform.
        await _add_user(db, 12)
        await _join(db, 12, other_org.id, admin_role.id)
        await _join(db, 12, org.id, user_role.id)
        access = await resolve_platform_access(12, db)
        assert access.role == "student"
        assert access.can_manage_platform is False

    async def test_no_membership_at_all_is_a_student(self, db, org):
        await _add_user(db, 13)
        assert (await resolve_platform_access(13, db)).role == "student"

    def test_role_grants_dashboard_access_tolerates_shapes(self):
        assert role_grants_dashboard_access(None) is False
        assert role_grants_dashboard_access(Role(name="x", rights=None)) is False
        assert role_grants_dashboard_access(Role(name="x", rights=ADMIN_RIGHTS.model_dump())) is True
        assert role_grants_dashboard_access(Role(name="x", rights=USER_RIGHTS.model_dump())) is False


class TestDependencies:
    async def test_platform_admin_dependency(self, db, org, admin_user, regular_user):
        assert (await require_platform_admin(current_user=admin_user, db_session=db)).id == admin_user.id

        with pytest.raises(HTTPException) as student:
            await require_platform_admin(current_user=regular_user, db_session=db)
        assert student.value.status_code == 403

        with pytest.raises(HTTPException) as anon:
            await require_platform_admin(current_user=AnonymousUser(), db_session=db)
        assert anon.value.status_code == 401

        token = APITokenUser(id=5, org_id=org.id, rights={}, created_by_user_id=admin_user.id)
        with pytest.raises(HTTPException) as api_token:
            await require_platform_admin(current_user=token, db_session=db)
        assert api_token.value.status_code == 403

    async def test_staff_are_admin_accounts_but_not_platform_admins(self, db, org, user_role, staff_role):
        staff = await _add_user(db, 20)
        await _join(db, 20, org.id, staff_role.id)

        assert (await require_admin_account(current_user=staff, db_session=db)).id == 20
        with pytest.raises(HTTPException) as exc:
            await require_platform_admin(current_user=staff, db_session=db)
        assert exc.value.status_code == 403

    async def test_students_are_not_admin_accounts(self, db, org, regular_user):
        with pytest.raises(HTTPException) as exc:
            await require_admin_account(current_user=regular_user, db_session=db)
        assert exc.value.status_code == 403


class TestSessionPayload:
    async def test_session_carries_the_account_type(self, db, org, admin_user, regular_user):
        request = Mock()
        admin_session = await get_user_session(request, db, admin_user)
        assert admin_session.platform_role == "admin"
        assert admin_session.can_manage_platform is True

        student_session = await get_user_session(request, db, regular_user)
        assert student_session.platform_role == "student"
        assert student_session.can_manage_platform is False

    def test_a_pre_upgrade_cached_session_still_loads_as_least_privileged(self):
        from src.db.users import UserSession

        cached = {
            "user": {
                "id": 1, "user_uuid": "u", "username": "a", "first_name": "", "last_name": "",
                "email": "a@test.com",
            },
            "roles": [],
        }
        session = UserSession(**cached)
        assert session.platform_role == "student"
        assert session.can_manage_platform is False
