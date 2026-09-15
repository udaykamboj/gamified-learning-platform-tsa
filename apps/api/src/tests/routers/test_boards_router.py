"""Router tests for src/routers/boards/boards.py."""

from unittest.mock import AsyncMock, patch
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.core.events.database import get_db_session
from src.db.boards import (
    BoardRead,
    BoardMemberRead,
    BoardMemberRole,
)
from src.routers.boards.boards import router as boards_router
from src.security.auth import get_current_user


@pytest.fixture
def app(db, admin_user):
    app = FastAPI()
    app.include_router(boards_router, prefix="/api/v1/boards")
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


def _mock_board_read(**overrides) -> BoardRead:
    data = dict(
        id=1,
        name="Test Board",
        description="A test board",
        thumbnail_image="",
        org_id=1,
        board_uuid="board_test",
        created_by=1,
        creation_date="2024-01-01",
        update_date="2024-01-01",
    )
    data.update(overrides)
    return BoardRead(**data)


def _mock_board_member_read(**overrides) -> BoardMemberRead:
    data = dict(
        id=1,
        board_id=1,
        user_id=2,
        role=BoardMemberRole.EDITOR,
        creation_date="2024-01-01",
    )
    data.update(overrides)
    return BoardMemberRead(**data)


class TestBoardsRouter:
    async def test_create_board(self, client):
        mock_return = _mock_board_read()
        with patch(
            "src.routers.boards.boards.create_board",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.post(
                "/api/v1/boards/?org_id=1",
                json={"name": "My Board", "description": "Notes"},
            )

        assert response.status_code == 200
        assert response.json()["board_uuid"] == "board_test"

    async def test_list_org_boards(self, client):
        mock_return = [_mock_board_read()]
        with patch(
            "src.routers.boards.boards.get_boards_by_org",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.get("/api/v1/boards/org/1")

        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["board_uuid"] == "board_test"

    async def test_get_board(self, client):
        mock_return = _mock_board_read()
        with patch(
            "src.routers.boards.boards.get_board",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.get("/api/v1/boards/board_test")

        assert response.status_code == 200
        assert response.json()["name"] == "Test Board"

    async def test_update_board(self, client):
        mock_return = _mock_board_read(name="Updated Board")
        with patch(
            "src.routers.boards.boards.update_board",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.put(
                "/api/v1/boards/board_test",
                json={"name": "Updated Board"},
            )

        assert response.status_code == 200
        assert response.json()["name"] == "Updated Board"

    async def test_delete_board(self, client):
        with patch(
            "src.routers.boards.boards.delete_board",
            new_callable=AsyncMock,
            return_value={"detail": "Board deleted"},
        ):
            response = await client.delete("/api/v1/boards/board_test")

        assert response.status_code == 200
        assert response.json()["detail"] == "Board deleted"

    async def test_duplicate_board(self, client):
        mock_return = _mock_board_read(board_uuid="board_copy")
        with patch(
            "src.routers.boards.boards.duplicate_board",
            new_callable=AsyncMock,
            return_value=mock_return,
        ):
            response = await client.post("/api/v1/boards/board_test/duplicate")

        assert response.status_code == 200
        assert response.json()["board_uuid"] == "board_copy"

    async def test_members_crud(self, client):
        mock_member = _mock_board_member_read()
        with patch(
            "src.routers.boards.boards.get_board_members",
            new_callable=AsyncMock,
            return_value=[mock_member],
        ):
            response = await client.get("/api/v1/boards/board_test/members")
        assert response.status_code == 200
        assert len(response.json()) == 1

        with patch(
            "src.routers.boards.boards.add_board_member",
            new_callable=AsyncMock,
            return_value=mock_member,
        ):
            response = await client.post(
                "/api/v1/boards/board_test/members",
                json={"user_id": 2, "role": "editor"},
            )
        assert response.status_code == 200
        assert response.json()["user_id"] == 2

        with patch(
            "src.routers.boards.boards.remove_board_member",
            new_callable=AsyncMock,
            return_value={"detail": "Member removed"},
        ):
            response = await client.delete("/api/v1/boards/board_test/members/2")
        assert response.status_code == 200
        assert response.json()["detail"] == "Member removed"

