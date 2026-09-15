"""Tests for src/services/playgrounds/playgrounds.py."""

from datetime import datetime
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException, UploadFile
from sqlmodel import select

from src.db.courses.courses import Course
from src.db.playgrounds import Playground, PlaygroundAccessType, PlaygroundCreate, PlaygroundUpdate
from src.db.roles import Role, RoleTypeEnum
from src.services.playgrounds.playgrounds import (_check_read_access, create_playground, delete_playground, duplicate_playground, get_playground, list_org_playgrounds, update_playground, update_playground_thumbnail)


async def _make_playground(db, org, admin_user, **overrides):
    playground = Playground(
        id=overrides.pop("id", None),
        org_id=org.id,
        name=overrides.pop("name", "Playground"),
        description=overrides.pop("description", "Desc"),
        thumbnail_image=overrides.pop("thumbnail_image", ""),
        access_type=overrides.pop(
            "access_type", PlaygroundAccessType.AUTHENTICATED
        ),
        published=overrides.pop("published", False),
        course_uuid=overrides.pop("course_uuid", None),
        html_content=overrides.pop("html_content", "<div></div>"),
        playground_uuid=overrides.pop("playground_uuid", "playground_test"),
        course_id=overrides.pop("course_id", None),
        created_by=overrides.pop("created_by", admin_user.id),
        creation_date=overrides.pop("creation_date", "2024-01-01"),
        update_date=overrides.pop("update_date", "2024-01-01"),
    )
    db.add(playground)
    await db.commit()
    await db.refresh(playground)
    return playground


async def _make_role(db, org, **overrides):
    role = Role(
        id=overrides.pop("id", None),
        org_id=org.id,
        name=overrides.pop("name", "Role"),
        description=overrides.pop("description", "Desc"),
        role_type=overrides.pop("role_type", RoleTypeEnum.TYPE_ORGANIZATION),
        role_uuid=overrides.pop("role_uuid", f"role_{uuid4()}"),
        rights=overrides.pop("rights", {}),
        creation_date=overrides.pop("creation_date", str(datetime.now())),
        update_date=overrides.pop("update_date", str(datetime.now())),
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return role


class TestPlaygroundsService:


    async def test_check_read_access_public_and_restricted(self, db, org, admin_user, anonymous_user):
        public_pg = await _make_playground(
            db, org, admin_user, playground_uuid="pg_public", access_type=PlaygroundAccessType.PUBLIC
        )
        restricted_pg = await _make_playground(
            db,
            org,
            admin_user,
            playground_uuid="pg_restricted",
            access_type=PlaygroundAccessType.RESTRICTED,
            created_by=999,
        )

        await _check_read_access(public_pg, anonymous_user, db)

        with pytest.raises(HTTPException) as anon_exc:
            await _check_read_access(restricted_pg, anonymous_user, db)
        assert anon_exc.value.status_code == 401

        with pytest.raises(HTTPException) as restricted_exc:
            await _check_read_access(restricted_pg, admin_user.model_copy(update={"id": 99}), db)
        assert restricted_exc.value.status_code == 403


    @pytest.mark.asyncio
    async def test_create_get_list_update_delete_duplicate_playground(
        self, db, org, admin_user, anonymous_user, mock_request
    ):
        with patch(
            "src.services.playgrounds.playgrounds.dispatch_webhooks",
            new_callable=AsyncMock,
        ):
            created = await create_playground(
                mock_request,
                org.id,
                PlaygroundCreate(name="Playground", description="Desc"),
                admin_user,
                db,
            )

        public_pg = await _make_playground(
            db,
            org,
            admin_user,
            playground_uuid="pg_public",
            access_type=PlaygroundAccessType.PUBLIC,
            published=True,
        )
        await _make_playground(
            db,
            org,
            admin_user,
            playground_uuid="pg_private",
            access_type=PlaygroundAccessType.AUTHENTICATED,
            published=False,
            created_by=77,
        )

        fetched = await get_playground(mock_request, created.playground_uuid, admin_user, db)
        anon_list = await list_org_playgrounds(mock_request, org.id, anonymous_user, db)
        admin_list = await list_org_playgrounds(mock_request, org.id, admin_user, db)
        updated = await update_playground(
            mock_request,
            created.playground_uuid,
            PlaygroundUpdate(name="Updated", published=True),
            admin_user,
            db,
        )
        duplicated = await duplicate_playground(
            mock_request, created.playground_uuid, admin_user, db
        )
        deleted = await delete_playground(
            mock_request, created.playground_uuid, admin_user, db
        )

        assert fetched.playground_uuid == created.playground_uuid
        assert {pg.playground_uuid for pg in anon_list} == {public_pg.playground_uuid}
        assert len(admin_list) >= 2
        assert updated.name == "Updated"
        assert duplicated.name.endswith("(Copy)")
        assert deleted == {"detail": "Playground deleted"}

    @pytest.mark.asyncio
    async def test_create_and_update_course_uuid_resolution_and_rights_guards(
        self, db, org, other_org, admin_user, regular_user, mock_request
    ):
        course = Course(
            id=41,
            name="Course One",
            description="Desc",
            public=True,
            published=True,
            open_to_contributors=False,
            org_id=org.id,
            course_uuid="course_match",
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        foreign_course = Course(
            id=42,
            name="Course Foreign",
            description="Desc",
            public=True,
            published=True,
            open_to_contributors=False,
            org_id=other_org.id,
            course_uuid="course_foreign",
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db.add(course)
        db.add(foreign_course)
        await db.commit()

        with patch(
            "src.services.playgrounds.playgrounds.dispatch_webhooks",
            new_callable=AsyncMock,
        ):
            created = await create_playground(
                mock_request,
                org.id,
                PlaygroundCreate(
                    name="With Course",
                    description="Desc",
                    course_uuid=course.course_uuid,
                ),
                admin_user,
                db,
            )
            foreign_created = await create_playground(
                mock_request,
                org.id,
                PlaygroundCreate(
                    name="With Foreign Course",
                    description="Desc",
                    course_uuid=foreign_course.course_uuid,
                ),
                admin_user,
                db,
            )

        with pytest.raises(HTTPException) as denied_exc:
            await create_playground(
                mock_request,
                org.id,
                PlaygroundCreate(name="Denied", description="Desc"),
                regular_user,
                db,
            )
        assert denied_exc.value.status_code == 403

        with pytest.raises(HTTPException) as missing_org_exc:
            await create_playground(
                mock_request,
                9999,
                PlaygroundCreate(name="Missing", description="Desc"),
                admin_user,
                db,
            )
        assert missing_org_exc.value.status_code == 404

        updated_to_course = await update_playground(
            mock_request,
            created.playground_uuid,
            PlaygroundUpdate(course_uuid=course.course_uuid),
            admin_user,
            db,
        )
        updated_to_foreign = await update_playground(
            mock_request,
            created.playground_uuid,
            PlaygroundUpdate(course_uuid=foreign_course.course_uuid),
            admin_user,
            db,
        )
        cleared_course = await update_playground(
            mock_request,
            created.playground_uuid,
            PlaygroundUpdate(course_uuid=None),
            admin_user,
            db,
        )

        with pytest.raises(HTTPException) as duplicate_exc:
            await duplicate_playground(mock_request, created.playground_uuid, regular_user, db)
        assert duplicate_exc.value.status_code == 403

        with pytest.raises(HTTPException) as missing_update_exc:
            await update_playground(
                mock_request,
                "missing_pg",
                PlaygroundUpdate(name="Missing"),
                admin_user,
                db,
            )
        assert missing_update_exc.value.status_code == 404

        with pytest.raises(HTTPException) as missing_delete_exc:
            await delete_playground(mock_request, "missing_pg", admin_user, db)
        assert missing_delete_exc.value.status_code == 404

        with pytest.raises(HTTPException) as missing_duplicate_exc:
            await duplicate_playground(mock_request, "missing_pg", admin_user, db)
        assert missing_duplicate_exc.value.status_code == 404

        assert created.course_id == course.id
        assert foreign_created.course_id is None
        assert updated_to_course.course_id == course.id
        assert updated_to_foreign.course_id is None
        assert cleared_course.course_id is None


    @pytest.mark.asyncio
    async def test_get_playground_unpublished_hidden_from_anonymous(
        self, db, org, admin_user, anonymous_user, mock_request
    ):
        """Line 230: a draft (unpublished) PUBLIC playground passes the
        access_type read check for anonymous users but must still 404 because
        it is unpublished."""
        await _make_playground(
            db,
            org,
            admin_user,
            playground_uuid="pg_draft_public",
            access_type=PlaygroundAccessType.PUBLIC,
            published=False,
            created_by=admin_user.id,
        )
        with pytest.raises(HTTPException) as exc_info:
            await get_playground(mock_request, "pg_draft_public", anonymous_user, db)
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_playground_unpublished_hidden_from_non_owner_non_admin(
        self, db, org, admin_user, regular_user, mock_request
    ):
        """Line 235: a draft PUBLIC playground readable by access_type is still
        hidden (404) from an authenticated user who is neither the owner nor an
        org admin."""
        await _make_playground(
            db,
            org,
            admin_user,
            playground_uuid="pg_draft_public_other",
            access_type=PlaygroundAccessType.PUBLIC,
            published=False,
            created_by=admin_user.id,  # regular_user is not the owner
        )
        with pytest.raises(HTTPException) as exc_info:
            await get_playground(mock_request, "pg_draft_public_other", regular_user, db)
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_list_org_playgrounds_empty_returns_empty(
        self, db, org, admin_user, mock_request
    ):
        """Line 211: no playgrounds for the org → returns [] immediately."""
        result = await list_org_playgrounds(mock_request, org.id, admin_user, db)
        assert result == []

    @pytest.mark.asyncio
    async def test_list_org_playgrounds_no_allowed_returns_empty(
        self, db, org, admin_user, anonymous_user, mock_request
    ):
        """Line 272: playgrounds exist but none pass the filter for the user → returns []."""
        await _make_playground(
            db,
            org,
            admin_user,
            playground_uuid="pg_auth_only_anon",
            access_type=PlaygroundAccessType.AUTHENTICATED,
            published=True,
        )
        result = await list_org_playgrounds(mock_request, org.id, anonymous_user, db)
        assert result == []


    @pytest.mark.asyncio
    async def test_list_org_playgrounds_restricted_skips_anonymous_and_no_access(
        self, db, org, admin_user, regular_user, anonymous_user, mock_request
    ):
        restricted_pg = await _make_playground(
            db, org, admin_user,
            playground_uuid="pg_restricted_filter",
            access_type=PlaygroundAccessType.RESTRICTED,
            published=True,
            created_by=admin_user.id,
        )

        # Line 255: anonymous user → skip restricted playground
        anon_result = await list_org_playgrounds(mock_request, org.id, anonymous_user, db)
        assert all(pg.playground_uuid != restricted_pg.playground_uuid for pg in anon_result)

        # Line 261: non-admin, not owner, no group access → skip
        regular_result = await list_org_playgrounds(mock_request, org.id, regular_user, db)
        assert all(pg.playground_uuid != restricted_pg.playground_uuid for pg in regular_result)
