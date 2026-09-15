"""
Tests for src/services/courses/courses.py

Covers: get_course, get_course_by_id, get_courses_orgslug,
        get_courses_count_orgslug, delete_course, search_courses.
"""

from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.courses.courses import (Course, CourseRead, CourseUpdate, FullCourseRead, ThumbnailType)
from src.db.courses.activities import Activity, ActivityTypeEnum, ActivitySubTypeEnum
from src.db.courses.blocks import Block, BlockTypeEnum
from src.db.courses.chapters import Chapter
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.course_chapters import CourseChapter
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.users import APITokenUser, AnonymousUser
from src.security.rbac import AccessAction, AccessContext
from src.services.courses.courses import (get_course, get_course_by_id, get_course_meta, get_course_user_rights, get_courses_count_orgslug, get_courses_orgslug, get_user_courses, search_courses)


async def _make_course(db, org, *, id, name="Extra Course", course_uuid=None,
                       public=True, published=True):
    """Helper to insert an additional course for multi-course tests."""
    c = Course(
        id=id,
        name=name,
        description=f"Description for {name}",
        public=public,
        published=published,
        open_to_contributors=False,
        org_id=org.id,
        course_uuid=course_uuid or f"course_{id}",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


def _make_course_read_payload(**overrides):
    payload = dict(
        id=1,
        name="Cached Course",
        description="Cached course description",
        public=True,
        published=True,
        open_to_contributors=False,
        org_id=1,
        course_uuid="course_cached",
        creation_date="2024-01-01",
        update_date="2024-01-01",
        authors=[],
    )
    payload.update(overrides)
    return payload


class TestGetCourse:
    """Tests for get_course()."""

    @pytest.mark.asyncio
    async def test_get_course_found(
        self, db, org, course, admin_user, mock_request, bypass_rbac
    ):
        result = await get_course(mock_request, "course_test", admin_user, db)

        assert isinstance(result, CourseRead)
        assert result.course_uuid == "course_test"
        assert result.name == "Test Course"
        assert result.authors == []

    @pytest.mark.asyncio
    async def test_get_course_not_found(
        self, db, org, admin_user, mock_request, bypass_rbac
    ):
        with pytest.raises(HTTPException) as exc_info:
            await get_course(mock_request, "nonexistent_uuid", admin_user, db)

        assert exc_info.value.status_code == 404
        assert "Course not found" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_get_course_uses_dashboard_context_for_access_check(
        self, db, org, course, admin_user, mock_request
    ):
        with patch(
            "src.services.courses.courses.check_resource_access",
            new_callable=AsyncMock,
        ) as mock_access:
            await get_course(mock_request, "course_test", admin_user, db)

        mock_access.assert_awaited_once_with(
            mock_request,
            db,
            admin_user,
            "course_test",
            AccessAction.READ,
            context=AccessContext.DASHBOARD,
        )


class TestGetCourseMeta:
    """Tests for get_course_meta()."""

    @pytest.mark.asyncio
    async def test_get_course_meta_returns_cached_payload(
        self, db, org, course, admin_user, mock_request
    ):
        cached = FullCourseRead(
            id=course.id,
            name=course.name,
            description=course.description,
            public=course.public,
            published=course.published,
            open_to_contributors=course.open_to_contributors,
            org_id=course.org_id,
            course_uuid=course.course_uuid,
            creation_date=course.creation_date,
            update_date=course.update_date,
            org_uuid=org.org_uuid,
            authors=[],
            chapters=[],
        ).model_dump(mode="json")

        with patch(
            "src.services.courses.courses.check_resource_access",
            new_callable=AsyncMock,
        ), patch(
            "src.services.courses.cache.get_cached_course_meta",
            return_value=cached,
        ), patch(
            "src.services.courses.chapters.get_course_chapters",
            new_callable=AsyncMock,
        ) as mock_chapters:
            # The shared meta cache is only served to anonymous viewers (per-user
            # lock-stripping means authenticated views must not be cached).
            result = await get_course_meta(
                mock_request,
                "course_test",
                False,
                AnonymousUser(),
                db,
                slim=True,
            )

        assert isinstance(result, FullCourseRead)
        assert result.course_uuid == "course_test"
        mock_chapters.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_course_meta_passes_prefetched_course_and_caches_result(
        self, db, org, course, admin_user, mock_request
    ):
        with patch(
            "src.services.courses.courses.check_resource_access",
            new_callable=AsyncMock,
        ), patch(
            "src.services.courses.cache.get_cached_course_meta",
            return_value=None,
        ), patch(
            "src.services.courses.cache.set_cached_course_meta",
        ) as mock_set_cache, patch(
            "src.services.courses.chapters.get_course_chapters",
            new_callable=AsyncMock,
            return_value=[],
        ) as mock_chapters:
            anon = AnonymousUser()
            result = await get_course_meta(
                mock_request,
                "course_test",
                False,
                anon,
                db,
                slim=True,
            )

        assert result.org_uuid == "org_test"
        mock_chapters.assert_awaited_once()
        call = mock_chapters.await_args
        assert call.args[:5] == (mock_request, course.id, db, anon, False)
        assert call.kwargs["slim"] is True
        assert call.kwargs["course"].id == course.id
        mock_set_cache.assert_called_once_with("course_test", True, result.model_dump())

    @pytest.mark.asyncio
    async def test_get_course_meta_skips_chapters_when_course_id_missing(
        self, org, mock_request, admin_user
    ):
        from unittest.mock import AsyncMock as _AsyncMock, MagicMock

        course = Course(
            id=None,
            name="Detached Course",
            description="Detached course description",
            public=True,
            published=False,
            open_to_contributors=False,
            org_id=org.id,
            course_uuid="course_detached",
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        fake_rows = [(course, None, None, org)]
        execute_result = MagicMock()
        execute_result.all.return_value = fake_rows
        fake_db = MagicMock()
        fake_db.execute = _AsyncMock(return_value=execute_result)

        with patch(
            "src.services.courses.courses.check_resource_access",
            new_callable=AsyncMock,
        ), patch(
            "src.services.courses.courses.FullCourseRead",
            side_effect=lambda **kwargs: kwargs,
        ), patch(
            "src.services.courses.chapters.get_course_chapters",
            new_callable=AsyncMock,
        ) as mock_chapters:
            result = await get_course_meta(
                mock_request,
                "course_detached",
                True,
                admin_user,
                fake_db,
            )

        assert result["course_uuid"] == "course_detached"
        mock_chapters.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_course_meta_not_found_raises(self, mock_request, admin_user):
        from unittest.mock import AsyncMock as _AsyncMock, MagicMock

        execute_result = MagicMock()
        execute_result.all.return_value = []
        fake_db = MagicMock()
        fake_db.execute = _AsyncMock(return_value=execute_result)

        with patch(
            "src.services.courses.courses.check_resource_access",
            new_callable=AsyncMock,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await get_course_meta(
                    mock_request,
                    "missing-course",
                    False,
                    admin_user,
                    fake_db,
                )

        assert exc_info.value.status_code == 404


class TestGetCourseById:
    """Tests for get_course_by_id()."""

    @pytest.mark.asyncio
    async def test_get_course_by_id_found(
        self, db, org, course, admin_user, mock_request, bypass_rbac
    ):
        result = await get_course_by_id(mock_request, course.id, admin_user, db)

        assert isinstance(result, CourseRead)
        assert result.id == course.id
        assert result.course_uuid == "course_test"

    @pytest.mark.asyncio
    async def test_get_course_by_id_not_found(
        self, db, org, admin_user, mock_request, bypass_rbac
    ):
        with pytest.raises(HTTPException) as exc_info:
            await get_course_by_id(mock_request, 9999, admin_user, db)

        assert exc_info.value.status_code == 404


class TestGetCoursesOrgslug:
    """Tests for get_courses_orgslug()."""

    @pytest.mark.asyncio
    async def test_get_courses_orgslug_anonymous_uses_cache(
        self, anonymous_user, mock_request
    ):
        cached = [_make_course_read_payload()]

        with patch(
            "src.services.courses.cache.get_cached_courses_list",
            return_value=cached,
        ) as mock_cache:
            result = await get_courses_orgslug(
                mock_request, anonymous_user, "test-org", Mock()
            )

        mock_cache.assert_called_once_with("test-org", 1, 10)
        assert len(result) == 1
        assert result[0].course_uuid == "course_cached"

    @pytest.mark.asyncio
    async def test_get_courses_orgslug_returns_courses(
        self, db, org, course, admin_user, mock_request, bypass_rbac
    ):
        with patch(
            "src.services.courses.courses.is_user_superadmin", return_value=False
        ):
            result = await get_courses_orgslug(
                mock_request, admin_user, "test-org", db
            )

        assert len(result) == 1
        assert result[0].course_uuid == "course_test"

    @pytest.mark.asyncio
    async def test_get_courses_orgslug_empty_org(
        self, db, org, admin_user, mock_request, bypass_rbac
    ):
        result = await get_courses_orgslug(
            mock_request, admin_user, "unknown-org-slug", db
        )

        assert result == []

    @pytest.mark.asyncio
    async def test_get_courses_orgslug_existing_org_without_courses(
        self, db, other_org, admin_user, mock_request
    ):
        with patch(
            "src.services.courses.courses.is_user_superadmin", return_value=False
        ):
            result = await get_courses_orgslug(
                mock_request, admin_user, other_org.slug, db
            )

        assert result == []

    @pytest.mark.asyncio
    async def test_get_courses_orgslug_anonymous_only_public_published(
        self, db, org, course, anonymous_user, mock_request, bypass_rbac
    ):
        # Add a private course that anonymous users should NOT see
        await _make_course(db, org, id=10, name="Private Course",
                           course_uuid="course_private", public=False, published=True)

        # Add an unpublished course that anonymous users should NOT see
        await _make_course(db, org, id=11, name="Unpublished Course",
                           course_uuid="course_unpub", public=True, published=False)

        with patch(
            "src.services.courses.cache.get_cached_courses_list", return_value=None
        ):
            result = await get_courses_orgslug(
                mock_request, anonymous_user, "test-org", db
            )

        # Only the original public+published course should appear
        uuids = [c.course_uuid for c in result]
        assert "course_test" in uuids
        assert "course_private" not in uuids
        assert "course_unpub" not in uuids

    @pytest.mark.asyncio
    async def test_get_courses_orgslug_pagination(
        self, db, org, course, admin_user, mock_request, bypass_rbac
    ):
        await _make_course(db, org, id=2, name="Course Two", course_uuid="course_2")
        await _make_course(db, org, id=3, name="Course Three", course_uuid="course_3")

        with patch(
            "src.services.courses.courses.is_user_superadmin", return_value=False
        ):
            result = await get_courses_orgslug(
                mock_request, admin_user, "test-org", db, page=1, limit=2
            )

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_get_courses_orgslug_include_unpublished_for_admin(
        self, db, org, course, admin_user, mock_request, bypass_rbac
    ):
        await _make_course(
            db,
            org,
            id=12,
            name="Draft Course",
            course_uuid="course_draft",
            public=False,
            published=False,
        )

        with patch(
            "src.services.courses.courses.is_user_superadmin", return_value=False
        ):
            result = await get_courses_orgslug(
                mock_request,
                admin_user,
                "test-org",
                db,
                include_unpublished=True,
            )

        uuids = [c.course_uuid for c in result]
        assert "course_test" in uuids
        assert "course_draft" in uuids

    @pytest.mark.asyncio
    async def test_get_courses_orgslug_include_unpublished_for_superadmin(
        self, db, org, course, admin_user, mock_request, bypass_rbac
    ):
        await _make_course(
            db,
            org,
            id=13,
            name="Superadmin Draft",
            course_uuid="course_superadmin_draft",
            public=False,
            published=False,
        )

        with patch(
            "src.services.courses.courses.is_user_superadmin", return_value=True
        ):
            result = await get_courses_orgslug(
                mock_request,
                admin_user,
                "test-org",
                db,
                include_unpublished=True,
            )

        uuids = [c.course_uuid for c in result]
        assert "course_superadmin_draft" in uuids

    @pytest.mark.asyncio
    async def test_get_courses_orgslug_groups_multiple_authors(
        self, db, org, course, regular_user, admin_user, mock_request, bypass_rbac
    ):
        db.add(
            ResourceAuthor(
                resource_uuid=course.course_uuid,
                user_id=admin_user.id,
                authorship=ResourceAuthorshipEnum.CREATOR,
                authorship_status=ResourceAuthorshipStatusEnum.ACTIVE,
                creation_date=str(datetime.now()),
                update_date=str(datetime.now()),
            )
        )
        db.add(
            ResourceAuthor(
                resource_uuid=course.course_uuid,
                user_id=regular_user.id,
                authorship=ResourceAuthorshipEnum.CONTRIBUTOR,
                authorship_status=ResourceAuthorshipStatusEnum.ACTIVE,
                creation_date=str(datetime.now()),
                update_date=str(datetime.now()),
            )
        )
        await db.commit()

        with patch(
            "src.services.courses.courses.is_user_superadmin", return_value=False
        ):
            result = await get_courses_orgslug(
                mock_request, admin_user, "test-org", db
            )

        assert len(result) == 1
        assert len(result[0].authors) >= 2


class TestGetCoursesCountOrgslug:
    """Tests for get_courses_count_orgslug()."""

    @pytest.mark.asyncio
    async def test_get_courses_count_orgslug(
        self, db, org, course, anonymous_user, mock_request
    ):
        count = await get_courses_count_orgslug(
            mock_request, anonymous_user, "test-org", db
        )

        assert count == 1

    @pytest.mark.asyncio
    async def test_get_courses_count_orgslug_excludes_private_for_anon(
        self, db, org, course, anonymous_user, mock_request
    ):
        await _make_course(db, org, id=20, name="Private", course_uuid="course_priv",
                           public=False, published=True)

        count = await get_courses_count_orgslug(
            mock_request, anonymous_user, "test-org", db
        )

        # Only the public+published fixture course counts
        assert count == 1

    @pytest.mark.asyncio
    async def test_get_courses_count_orgslug_superadmin_counts_all(
        self, db, org, course, admin_user, mock_request, bypass_rbac
    ):
        await _make_course(db, org, id=21, name="Hidden", course_uuid="course_hidden", public=False, published=False)

        with patch(
            "src.services.courses.courses.is_user_superadmin", return_value=True
        ):
            count = await get_courses_count_orgslug(
                mock_request, admin_user, "test-org", db
            )

        assert count == 2

    @pytest.mark.asyncio
    async def test_get_courses_count_orgslug_authenticated_user_branch(
        self, db, org, course, regular_user, mock_request
    ):
        count = await get_courses_count_orgslug(
            mock_request, regular_user, "test-org", db
        )

        assert count == 1


class TestCourseMutationsAndRights:


    @pytest.mark.asyncio
    async def test_create_course_and_get_user_courses_empty_after_lookup(
        self, db, org, admin_user, mock_request, bypass_webhooks
    ):
        db.add(
            ResourceAuthor(
                resource_uuid="course_missing_lookup",
                user_id=999,
                authorship=ResourceAuthorshipEnum.CONTRIBUTOR,
                authorship_status=ResourceAuthorshipStatusEnum.ACTIVE,
                creation_date=str(datetime.now()),
                update_date=str(datetime.now()),
            )
        )
        await db.commit()

        with patch(
            "src.services.courses.courses.authorization_verify_if_user_is_anon",
            new_callable=AsyncMock,
        ):
            result = await get_user_courses(
                mock_request, admin_user, 999, db
            )

        assert result == []


    @pytest.mark.asyncio
    async def test_get_course_user_rights_variants(
        self, db, org, course, admin_user, regular_user, anonymous_user, mock_request
    ):
        db.add(
            ResourceAuthor(
                resource_uuid=course.course_uuid,
                user_id=admin_user.id,
                authorship=ResourceAuthorshipEnum.CREATOR,
                authorship_status=ResourceAuthorshipStatusEnum.ACTIVE,
                creation_date=str(datetime.now()),
                update_date=str(datetime.now()),
            )
        )
        await db.commit()

        with patch(
            "src.security.rbac.rbac.authorization_verify_based_on_org_admin_status",
            new_callable=AsyncMock,
            return_value=True,
        ), patch(
            "src.security.rbac.rbac.authorization_verify_based_on_roles",
            new_callable=AsyncMock,
            side_effect=[True, True],
        ):
            admin_rights = await get_course_user_rights(
                mock_request, course.course_uuid, admin_user, db
            )

        anon_rights = await get_course_user_rights(
            mock_request, course.course_uuid, anonymous_user, db
        )

        assert admin_rights["ownership"]["is_creator"] is True
        assert admin_rights["permissions"]["manage_access"] is True
        assert admin_rights["permissions"]["create"] is True
        assert anon_rights["permissions"]["read"] is True
        assert anon_rights["permissions"]["update"] is False


class TestSearchCourses:
    """Tests for search_courses()."""

    @pytest.mark.asyncio
    async def test_search_courses_finds_by_name(
        self, db, org, course, anonymous_user, mock_request
    ):
        result = await search_courses(
            mock_request, anonymous_user, "test-org", "Test", db
        )

        assert len(result) >= 1
        uuids = [c.course_uuid for c in result]
        assert "course_test" in uuids

    @pytest.mark.asyncio
    async def test_search_courses_no_results(
        self, db, org, course, anonymous_user, mock_request
    ):
        result = await search_courses(
            mock_request, anonymous_user, "test-org", "nonexistent_xyz", db
        )

        assert result == []

    @pytest.mark.asyncio
    async def test_search_courses_anonymous_excludes_private(
        self, db, org, course, anonymous_user, mock_request
    ):
        await _make_course(db, org, id=30, name="Secret Stuff",
                           course_uuid="course_secret", public=False, published=True)

        result = await search_courses(
            mock_request, anonymous_user, "test-org", "Secret", db
        )

        uuids = [c.course_uuid for c in result]
        assert "course_secret" not in uuids

    @pytest.mark.asyncio
    async def test_search_courses_authenticated_author_sees_unpublished(
        self, db, org, regular_user, mock_request
    ):
        authored = await _make_course(
            db,
            org,
            id=31,
            name="Draft Searchable",
            course_uuid="course_draft_search",
            public=False,
            published=False,
        )
        db.add(
            ResourceAuthor(
                resource_uuid=authored.course_uuid,
                user_id=regular_user.id,
                authorship=ResourceAuthorshipEnum.CONTRIBUTOR,
                authorship_status=ResourceAuthorshipStatusEnum.ACTIVE,
                creation_date=str(datetime.now()),
                update_date=str(datetime.now()),
            )
        )
        await db.commit()

        with patch(
            "src.services.courses.courses.is_user_superadmin", return_value=False
        ):
            result = await search_courses(
                mock_request, regular_user, "test-org", "Draft Searchable", db
            )

        uuids = [c.course_uuid for c in result]
        assert "course_draft_search" in uuids

    @pytest.mark.asyncio
    async def test_search_courses_superadmin_uses_unbounded_branch(
        self, db, org, course, admin_user, mock_request
    ):
        with patch(
            "src.services.courses.courses.is_user_superadmin", return_value=True
        ):
            result = await search_courses(
                mock_request, admin_user, "test-org", "Test", db, limit=500
            )

        assert any(c.course_uuid == "course_test" for c in result)

    @pytest.mark.asyncio
    async def test_search_courses_finds_emoji_in_name(
        self, db, org, anonymous_user, mock_request
    ):
        await _make_course(
            db, org, id=40,
            name="Rocket Course \U0001f680",
            course_uuid="course_emoji",
            public=True, published=True,
        )

        result = await search_courses(
            mock_request, anonymous_user, "test-org", "\U0001f680", db
        )

        uuids = [c.course_uuid for c in result]
        assert "course_emoji" in uuids

    @pytest.mark.asyncio
    async def test_search_courses_matches_nfd_query_to_nfc_stored(
        self, db, org, anonymous_user, mock_request
    ):
        # Stored name is NFC; query is NFD ("cafe" + combining acute).
        await _make_course(
            db, org, id=41,
            name="café Brewing",
            course_uuid="course_cafe",
            public=True, published=True,
        )

        result = await search_courses(
            mock_request, anonymous_user, "test-org", "café", db
        )

        uuids = [c.course_uuid for c in result]
        assert "course_cafe" in uuids

    @pytest.mark.asyncio
    async def test_search_courses_escapes_percent_wildcard(
        self, db, org, anonymous_user, mock_request
    ):
        # A literal "%" in the query must not act as a wildcard. Only the row
        # whose name actually contains "%" should match.
        await _make_course(
            db, org, id=42,
            name="100% Practical",
            course_uuid="course_percent",
            public=True, published=True,
        )
        await _make_course(
            db, org, id=43,
            name="Theoretical Course",
            course_uuid="course_theory",
            public=True, published=True,
        )

        result = await search_courses(
            mock_request, anonymous_user, "test-org", "100%", db
        )

        uuids = [c.course_uuid for c in result]
        assert "course_percent" in uuids
        assert "course_theory" not in uuids

    @pytest.mark.asyncio
    async def test_search_courses_escapes_underscore_wildcard(
        self, db, org, anonymous_user, mock_request
    ):
        # `_` in LIKE matches a single character. The escape must make it
        # literal so "a_b" only matches names that actually contain "a_b",
        # not "aXb".
        await _make_course(
            db, org, id=44,
            name="snake_case Module",
            course_uuid="course_snake",
            public=True, published=True,
        )
        await _make_course(
            db, org, id=45,
            name="snakeXcase Module",
            course_uuid="course_snakeX",
            public=True, published=True,
        )

        result = await search_courses(
            mock_request, anonymous_user, "test-org", "snake_case", db
        )

        uuids = [c.course_uuid for c in result]
        assert "course_snake" in uuids
        assert "course_snakeX" not in uuids

    @pytest.mark.asyncio
    async def test_search_courses_handles_backslash_in_query(
        self, db, org, anonymous_user, mock_request
    ):
        # User typing a backslash should not break the query or trigger
        # SQL errors. The course with a backslash in its name should match.
        await _make_course(
            db, org, id=46,
            name="C:\\path course",
            course_uuid="course_backslash",
            public=True, published=True,
        )

        result = await search_courses(
            mock_request, anonymous_user, "test-org", "C:\\path", db
        )

        uuids = [c.course_uuid for c in result]
        assert "course_backslash" in uuids

    @pytest.mark.asyncio
    async def test_search_courses_finds_zwj_family_emoji(
        self, db, org, anonymous_user, mock_request
    ):
        # ZWJ family sequence: 👨‍👩‍👧  (U+1F468 U+200D U+1F469 U+200D U+1F467).
        family = "\U0001f468‍\U0001f469‍\U0001f467"
        await _make_course(
            db, org, id=47,
            name=f"Parenting {family} 101",
            course_uuid="course_zwj_family",
            public=True, published=True,
        )

        result = await search_courses(
            mock_request, anonymous_user, "test-org", family, db
        )

        uuids = [c.course_uuid for c in result]
        assert "course_zwj_family" in uuids

    @pytest.mark.asyncio
    async def test_search_courses_finds_emoji_with_skin_tone_modifier(
        self, db, org, anonymous_user, mock_request
    ):
        # Waving hand + medium-light skin tone modifier.
        waving = "\U0001f44b\U0001f3fb"
        await _make_course(
            db, org, id=48,
            name=f"Welcome {waving} aboard",
            course_uuid="course_skin_tone",
            public=True, published=True,
        )

        result = await search_courses(
            mock_request, anonymous_user, "test-org", waving, db
        )

        uuids = [c.course_uuid for c in result]
        assert "course_skin_tone" in uuids


class TestGetUserCoursesAndRights:
    """Additional tests for get_user_courses() and get_course_user_rights()."""

    @pytest.mark.asyncio
    async def test_get_user_courses_empty_when_no_authors(
        self, db, org, admin_user, mock_request
    ):
        with patch(
            "src.services.courses.courses.authorization_verify_if_user_is_anon",
            new_callable=AsyncMock,
        ):
            result = await get_user_courses(
                mock_request, admin_user, 999, db
            )

        assert result == []

    @pytest.mark.asyncio
    async def test_get_course_user_rights_for_maintainer_and_contributor(
        self, db, org, course, admin_user, regular_user, mock_request
    ):
        db.add(
            ResourceAuthor(
                resource_uuid=course.course_uuid,
                user_id=admin_user.id,
                authorship=ResourceAuthorshipEnum.MAINTAINER,
                authorship_status=ResourceAuthorshipStatusEnum.ACTIVE,
                creation_date=str(datetime.now()),
                update_date=str(datetime.now()),
            )
        )
        db.add(
            ResourceAuthor(
                resource_uuid=course.course_uuid,
                user_id=regular_user.id,
                authorship=ResourceAuthorshipEnum.CONTRIBUTOR,
                authorship_status=ResourceAuthorshipStatusEnum.ACTIVE,
                creation_date=str(datetime.now()),
                update_date=str(datetime.now()),
            )
        )
        await db.commit()

        with patch(
            "src.security.rbac.rbac.authorization_verify_based_on_org_admin_status",
            new_callable=AsyncMock,
            return_value=False,
        ), patch(
            "src.security.rbac.rbac.authorization_verify_based_on_roles",
            new_callable=AsyncMock,
            return_value=False,
        ):
            maintainer_rights = await get_course_user_rights(
                mock_request, course.course_uuid, admin_user, db
            )
            contributor_rights = await get_course_user_rights(
                mock_request, course.course_uuid, regular_user, db
            )

        assert maintainer_rights["ownership"]["is_maintainer"] is True
        assert maintainer_rights["permissions"]["manage_access"] is True
        assert contributor_rights["ownership"]["is_contributor"] is True
        assert contributor_rights["permissions"]["update"] is True

    @pytest.mark.asyncio
    async def test_get_course_user_rights_not_found(
        self, db, mock_request, admin_user
    ):
        with pytest.raises(HTTPException) as exc_info:
            await get_course_user_rights(
                mock_request, "missing-course", admin_user, db
            )

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_storage_helper_branches_cover_local_and_s3_paths(self):
        with patch(
            "src.services.courses.transfer.storage_utils.is_s3_enabled",
            return_value=False,
        ), patch(
            "os.makedirs"
        ) as mock_makedirs, patch(
            "shutil.copy2"
        ) as mock_copy2:
            from src.services.courses.courses import _copy_storage_file

            _copy_storage_file("src.txt", "dst/child.txt")

        mock_makedirs.assert_called_once()
        mock_copy2.assert_called_once_with("src.txt", "dst/child.txt")

        with patch(
            "src.services.courses.transfer.storage_utils.delete_storage_file"
        ) as mock_delete:
            from src.services.courses.courses import _delete_storage_file

            _delete_storage_file("file.txt")

        mock_delete.assert_called_once_with("file.txt")

        with patch(
            "src.services.courses.transfer.storage_utils.is_s3_enabled",
            return_value=False,
        ), patch(
            "os.path.exists",
            return_value=True,
        ), patch(
            "shutil.copytree"
        ) as mock_copytree:
            from src.services.courses.courses import _copy_storage_directory

            _copy_storage_directory("srcdir", "dstdir")

        mock_copytree.assert_called_once_with("srcdir", "dstdir", dirs_exist_ok=True)

        class _FakePaginator:
            def paginate(self, Bucket, Prefix):  # noqa: N803
                return [{"Contents": [{"Key": "srcdir/file.txt"}]}]

        class _FakeS3Client:
            def __init__(self, raise_on_copy: bool = False):
                self.raise_on_copy = raise_on_copy
                self.copied = []

            def get_paginator(self, name):
                return _FakePaginator()

            def copy_object(self, **kwargs):
                if self.raise_on_copy:
                    raise RuntimeError("copy failed")
                self.copied.append(kwargs)

        with patch(
            "src.services.courses.transfer.storage_utils.is_s3_enabled",
            return_value=True,
        ), patch(
            "src.services.courses.transfer.storage_utils.read_file_content",
            return_value=b"payload",
        ), patch(
            "src.services.courses.transfer.storage_utils.upload_to_s3"
        ) as mock_upload:
            from src.services.courses.courses import _copy_storage_file

            _copy_storage_file("src.txt", "dst.txt")

        mock_upload.assert_called_once_with("dst.txt", b"payload")

        fake_client = _FakeS3Client()
        with patch(
            "src.services.courses.transfer.storage_utils.is_s3_enabled",
            return_value=True,
        ), patch(
            "src.services.courses.transfer.storage_utils.get_storage_client",
            return_value=fake_client,
        ), patch(
            "src.services.courses.transfer.storage_utils.get_s3_bucket_name",
            return_value="bucket",
        ):
            from src.services.courses.courses import _copy_storage_directory

            _copy_storage_directory("srcdir", "dstdir")

        assert fake_client.copied[0]["Key"] == "dstdir/file.txt"

        with patch(
            "src.services.courses.transfer.storage_utils.is_s3_enabled",
            return_value=True,
        ), patch(
            "src.services.courses.transfer.storage_utils.get_storage_client",
            return_value=None,
        ):
            from src.services.courses.courses import _copy_storage_directory

            _copy_storage_directory("srcdir", "dstdir")

        fake_client_error = _FakeS3Client(raise_on_copy=True)
        with patch(
            "src.services.courses.transfer.storage_utils.is_s3_enabled",
            return_value=True,
        ), patch(
            "src.services.courses.transfer.storage_utils.get_storage_client",
            return_value=fake_client_error,
        ), patch(
            "src.services.courses.transfer.storage_utils.get_s3_bucket_name",
            return_value="bucket",
        ), patch(
            "src.services.courses.courses.logger.error"
        ) as mock_logger_error:
            from src.services.courses.courses import _copy_storage_directory

            _copy_storage_directory("srcdir", "dstdir")

        mock_logger_error.assert_called_once()


    def test_replace_uuids_in_content_handles_list(self):
        """Cover line 1064: list branch in _replace_uuids_in_content."""
        from src.services.courses.courses import _replace_uuids_in_content

        uuid_map = {"old-uuid": "new-uuid", "another-old": "another-new"}

        # List at top level — exercises the list branch (line 1064)
        result = _replace_uuids_in_content(["old-uuid", "keep-me", "another-old"], uuid_map)
        assert result == ["new-uuid", "keep-me", "another-new"]

        # Nested list inside dict
        result2 = _replace_uuids_in_content(
            {"blocks": ["old-uuid", "keep-me"]}, uuid_map
        )
        assert result2 == {"blocks": ["new-uuid", "keep-me"]}
