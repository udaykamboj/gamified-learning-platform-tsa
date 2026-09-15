"""Router tests for src/routers/playgrounds/playgrounds.py."""

from unittest.mock import AsyncMock, patch
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.core.events.database import get_db_session
from src.db.playgrounds import (
    PlaygroundAccessType,
    PlaygroundRead,
    PlaygroundShareRead,
    PlaygroundShareRole,
)
from src.routers.playgrounds.playgrounds import router as playgrounds_router
from src.security.auth import get_current_user


@pytest.fixture
def app(db, admin_user):
    app = FastAPI()
    app.include_router(playgrounds_router, prefix="/api/v1/playgrounds")
    app.dependency_overrides[get_db_session] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: admin_user
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


def _mock_playground_read(**overrides) -> PlaygroundRead:
    data = dict(
        id=1,
        name="Test Playground",
        description="A test playground",
        public=False,
        published=True,
        access_type=PlaygroundAccessType.RESTRICTED,
        allow_forking=True,
        tags="",
        thumbnail_image="",
        org_id=1,
        course_id=None,
        playground_uuid="playground_test",
        created_by=1,
        creation_date="2024-01-01",
        update_date="2024-01-01",
        role="owner",
    )
    data.update(overrides)
    return PlaygroundRead(**data)


def _mock_share_read(**overrides) -> PlaygroundShareRead:
    data = dict(
        id=1,
        playground_id=1,
        user_id=2,
        role=PlaygroundShareRole.VIEWER,
        username="student2",
        email="student2@test.com",
        first_name="Student",
        last_name="Two",
        creation_date="2024-01-01",
    )
    data.update(overrides)
    return PlaygroundShareRead(**data)


class TestPlaygroundsRouter:
    async def test_create_playground(self, client):
        mock_return = _mock_playground_read()
        with patch(
            "src.routers.playgrounds.playgrounds.create_playground",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.post(
                "/api/v1/playgrounds/?org_id=1",
                json={"name": "My Workspace", "description": "Notes"},
            )

        assert response.status_code == 200
        assert response.json()["playground_uuid"] == "playground_test"

    async def test_list_org_playgrounds(self, client):
        mock_return = [_mock_playground_read()]
        with patch(
            "src.routers.playgrounds.playgrounds.list_org_playgrounds",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.get("/api/v1/playgrounds/org/1")

        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["playground_uuid"] == "playground_test"

    async def test_get_playground(self, client):
        mock_return = _mock_playground_read()
        with patch(
            "src.routers.playgrounds.playgrounds.get_playground",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.get("/api/v1/playgrounds/playground_test")

        assert response.status_code == 200
        assert response.json()["name"] == "Test Playground"

    async def test_update_playground(self, client):
        mock_return = _mock_playground_read(name="Updated Workspace")
        with patch(
            "src.routers.playgrounds.playgrounds.update_playground",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.put(
                "/api/v1/playgrounds/playground_test",
                json={"name": "Updated Workspace"},
            )

        assert response.status_code == 200
        assert response.json()["name"] == "Updated Workspace"

    async def test_delete_playground(self, client):
        with patch(
            "src.routers.playgrounds.playgrounds.delete_playground",
            new_callable=AsyncMock,
            return_value={"detail": "Playground deleted"},
        ):
            response = await client.delete("/api/v1/playgrounds/playground_test")

        assert response.status_code == 200
        assert response.json()["detail"] == "Playground deleted"

    async def test_duplicate_playground(self, client):
        mock_return = _mock_playground_read(playground_uuid="playground_copy")
        with patch(
            "src.routers.playgrounds.playgrounds.duplicate_playground",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.post("/api/v1/playgrounds/playground_test/duplicate")

        assert response.status_code == 200
        assert response.json()["playground_uuid"] == "playground_copy"

    async def test_shares_crud(self, client):
        mock_share = _mock_share_read()
        with patch(
            "src.routers.playgrounds.playgrounds.list_playground_shares",
            new_callable=AsyncMock,
            return_value=[mock_share],
        ):
            response = await client.get("/api/v1/playgrounds/playground_test/shares")
        assert response.status_code == 200
        assert len(response.json()) == 1

        with patch(
            "src.routers.playgrounds.playgrounds.share_playground",
            new_callable=AsyncMock,
            return_value=mock_share,
        ):
            response = await client.post(
                "/api/v1/playgrounds/playground_test/shares",
                json={"identifier": "student2", "role": "viewer"},
            )
        assert response.status_code == 200
        assert response.json()["username"] == "student2"

        with patch(
            "src.routers.playgrounds.playgrounds.unshare_playground",
            new_callable=AsyncMock,
            return_value={"detail": "Share removed"},
        ):
            response = await client.delete(
                "/api/v1/playgrounds/playground_test/shares/2"
            )
        assert response.status_code == 200
        assert response.json()["detail"] == "Share removed"
