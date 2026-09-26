"""Router tests for src/routers/courses/courses.py."""

import os
import tempfile
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from src.core.events.database import get_db_session
from src.db.courses.course_updates import CourseUpdateRead
from src.db.courses.courses import CourseRead, FullCourseRead, ThumbnailType
from src.routers.courses.courses import router as courses_router
from src.security.auth import get_current_user
from src.security.features_utils.dependencies import require_courses_feature


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def app(db, admin_user):
    app = FastAPI()
    app.include_router(courses_router, prefix="/api/v1/courses")
    app.dependency_overrides[get_db_session] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[require_courses_feature] = lambda: True
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


def _mock_course_read(**overrides) -> CourseRead:
    """Build a minimal CourseRead for mocked service returns."""
    data = dict(
        id=1,
        name="Test Course",
        description="A test course",
        public=True,
        published=True,
        open_to_contributors=False,
        org_id=1,
        course_uuid="course_test",
        creation_date="2024-01-01",
        update_date="2024-01-01",
        authors=[],
    )
    data.update(overrides)
    return CourseRead(**data)


def _mock_full_course_read(**overrides) -> FullCourseRead:
    data = dict(
        id=1,
        name="Test Course",
        description="A test course",
        about="About",
        learnings="Things",
        tags="python",
        public=True,
        published=True,
        open_to_contributors=False,
        org_id=1,
        org_uuid="org_test",
        course_uuid="course_test",
        creation_date="2024-01-01",
        update_date="2024-01-01",
        authors=[],
        chapters=[],
        thumbnail_type=ThumbnailType.IMAGE,
        thumbnail_image="",
        thumbnail_video="",
    )
    data.update(overrides)
    return FullCourseRead(**data)


def _mock_course_update_read(**overrides) -> CourseUpdateRead:
    data = dict(
        id=1,
        title="Update",
        content="Update body",
        course_id=1,
        courseupdate_uuid="courseupdate_test",
        linked_activity_uuids=None,
        org_id=1,
        creation_date="2024-01-01",
        update_date="2024-01-01",
    )
    data.update(overrides)
    return CourseUpdateRead(**data)


def _temp_zip_file() -> str:
    handle = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    handle.write(b"zip-bytes")
    handle.close()
    return handle.name


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestGetCourse:
    async def test_get_course(self, client):
        mock_return = _mock_course_read()
        with patch(
            "src.routers.courses.courses.get_course",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.get("/api/v1/courses/course_test")

        assert response.status_code == 200
        body = response.json()
        assert body["course_uuid"] == "course_test"
        assert body["name"] == "Test Course"

    async def test_get_course_not_found(self, client):
        with patch(
            "src.routers.courses.courses.get_course",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=404, detail="Course not found"),
        ):
            response = await client.get("/api/v1/courses/fake")

        assert response.status_code == 404


class TestGetCoursesByOrgSlug:
    async def test_get_courses_by_orgslug(self, client):
        mock_return = [_mock_course_read()]
        with patch(
            "src.routers.courses.courses.get_courses_orgslug",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.get(
                "/api/v1/courses/org_slug/test-org/page/1/limit/10"
            )

        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)
        assert len(body) == 1
        assert body[0]["course_uuid"] == "course_test"


class TestGetCoursesCount:
    async def test_get_courses_count(self, client):
        with patch(
            "src.routers.courses.courses.get_courses_count_orgslug",
            new_callable=AsyncMock,
            return_value=5,
        ):
            response = await client.get(
                "/api/v1/courses/org_slug/test-org/count"
            )

        assert response.status_code == 200
        assert response.json() == 5


class TestGetCourseById:
    async def test_get_course_by_id(self, client):
        mock_return = _mock_course_read()
        with patch(
            "src.routers.courses.courses.get_course_by_id",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.get("/api/v1/courses/id/1")

        assert response.status_code == 200
        assert response.json()["id"] == 1

    async def test_get_course_by_id_not_found(self, client):
        with patch(
            "src.routers.courses.courses.get_course_by_id",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=404, detail="Course not found"),
        ):
            response = await client.get("/api/v1/courses/id/999")

        assert response.status_code == 404


class TestGetCourseMeta:
    async def test_get_course_meta(self, client):
        mock_return = _mock_full_course_read()
        with patch(
            "src.routers.courses.courses.get_course_meta",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.get("/api/v1/courses/course_test/meta")

        assert response.status_code == 200
        assert response.json()["course_uuid"] == "course_test"


class TestSearchCourses:
    async def test_search_courses(self, client):
        mock_return = [_mock_course_read()]
        with patch(
            "src.routers.courses.courses.search_courses",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.get("/api/v1/courses/org_slug/test-org/search?query=test")

        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["course_uuid"] == "course_test"


class TestGetCourseUpdates:
    async def test_get_course_updates(self, client):
        mock_return = [_mock_course_update_read()]
        with patch(
            "src.routers.courses.courses.check_resource_access",
            new_callable=AsyncMock,
        ), patch(
            "src.routers.courses.courses.get_updates_by_course_uuid",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.get("/api/v1/courses/course_test/updates")

        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["title"] == "Update"


class TestGetCourseRights:
    async def test_get_course_rights(self, client):
        mock_rights = {
            "course_uuid": "course_test",
            "user_id": 1,
            "is_anonymous": False,
            "permissions": {"read": True, "enroll": True, "work_on_content": True, "monitor": False},
            "enrollment": {"is_enrolled": True},
            "roles": {"is_admin": False, "is_student": True},
        }
        with patch(
            "src.routers.courses.courses.get_course_user_rights",
            new_callable=AsyncMock,
            return_value=mock_rights,
        ):
            response = await client.get("/api/v1/courses/course_test/rights")

        assert response.status_code == 200
        body = response.json()
        assert body["course_uuid"] == "course_test"
        assert body["permissions"]["read"] is True
        assert body["enrollment"]["is_enrolled"] is True

