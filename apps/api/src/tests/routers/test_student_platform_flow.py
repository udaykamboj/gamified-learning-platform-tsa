"""End-to-end checks for the student-centred platform model.

Runs the real v1 router against an in-memory database seeded the way a real
deployment is: the platform roles (install_default_elements) and the course
catalog (sync_platform_content). See docs/refactor/progress/00-requirements.md.
"""

from datetime import datetime

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlmodel import select

from src.content.catalog.sync import load_catalog, stable_uuid, sync_platform_content
from src.core.events.database import get_db_session
from src.db.courses.assignments import Assignment, AssignmentTask
from src.db.courses.courses import Course
from src.db.organizations import OrganizationCreate
from src.db.roles import DashboardPermission, Role, RoleTypeEnum
from src.db.user_organizations import UserOrganization
from src.db.users import PublicUser, User
from src.router import v1_router
from src.security.api_token_utils import (
    get_authenticated_non_api_token_user,
    require_authenticated_user_or_api_token,
)
from src.security.auth import get_current_user
from src.security.platform_roles import _get_current_user_lazy
from src.security.rbac.constants import ADMIN_ROLE_ID, USER_ROLE_ID
from src.services.setup.setup import (
    install_create_organization,
    install_default_elements,
    retire_teacher_roles,
)


class _Actor:
    def __init__(self):
        self.user = None


@pytest.fixture
async def platform(db):
    await install_default_elements(db)
    org = await install_create_organization(
        OrganizationCreate(
            name="StarLab",
            description="StarLab",
            slug="default",
            email="",
            logo_image="",
            thumbnail_image="",
            about="",
            label="",
        ),
        db,
    )

    async def make_user(user_id: int, username: str, role_id: int) -> PublicUser:
        user = User(
            id=user_id,
            username=username,
            first_name=username.title(),
            last_name="Test",
            email=f"{username}@example.com",
            password="x",
            user_uuid=f"user_{username}",
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db.add(user)
        await db.commit()
        db.add(
            UserOrganization(
                user_id=user_id,
                org_id=org.id,
                role_id=role_id,
                creation_date=str(datetime.now()),
                update_date=str(datetime.now()),
            )
        )
        await db.commit()
        return PublicUser(**user.model_dump())

    stats = await sync_platform_content(db)
    return {
        "org": org,
        "stats": stats,
        "student": await make_user(10, "student", USER_ROLE_ID),
        "friend": await make_user(11, "friend", USER_ROLE_ID),
        "admin": await make_user(12, "admin", ADMIN_ROLE_ID),
    }


@pytest.fixture
async def client(db, platform):
    actor = _Actor()
    app = FastAPI()
    app.include_router(v1_router)
    app.dependency_overrides[get_db_session] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: actor.user
    app.dependency_overrides[get_authenticated_non_api_token_user] = lambda: actor.user
    app.dependency_overrides[require_authenticated_user_or_api_token] = lambda: actor.user
    app.dependency_overrides[_get_current_user_lazy] = lambda: actor.user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        c.actor = actor  # type: ignore[attr-defined]
        yield c


def act_as(client, user):
    client.actor.user = user


async def test_catalog_sync_is_idempotent(db, platform):
    catalog = load_catalog()
    courses = (await db.execute(select(Course).where(Course.published == True))).scalars().all()  # noqa: E712
    assert {c.course_uuid for c in courses} == {stable_uuid("course", c["slug"]) for c in catalog}

    again = await sync_platform_content(db)
    assert (again.created, again.updated, again.removed) == (0, 0, 0)


async def test_only_admin_and_student_roles_exist(db, platform):
    roles = (await db.execute(select(Role))).scalars().all()
    assert {r.id for r in roles} == {ADMIN_ROLE_ID, USER_ROLE_ID}

    # A leftover instructor membership becomes an admin; a custom non-staff role becomes a student.
    instructor = Role(
        id=3, name="Instructor", role_type=RoleTypeEnum.TYPE_GLOBAL, role_uuid="role_global_instructor",
        rights={"dashboard": DashboardPermission(action_access=True).model_dump()},
        creation_date="", update_date="",
    )
    db.add(instructor)
    await db.commit()
    membership = (await db.execute(
        select(UserOrganization).where(UserOrganization.user_id == platform["friend"].id)
    )).scalars().first()
    membership.role_id = 3
    db.add(membership)
    await db.commit()

    retired = await retire_teacher_roles(db)
    assert retired and "Instructor" in retired[0]
    await db.refresh(membership)
    assert membership.role_id == ADMIN_ROLE_ID
    assert await db.get(Role, 3) is None


async def test_student_enrolls_then_learns_and_passes(client, db, platform):
    student = platform["student"]
    act_as(client, student)

    listed = await client.get("/api/v1/courses/org_slug/default/page/1/limit/20")
    assert listed.status_code == 200
    assert len(listed.json()) == len(load_catalog())

    course_uuid = stable_uuid("course", "ai-foundations")
    meta = (await client.get(f"/api/v1/courses/{course_uuid}/meta")).json()
    activities = [a for ch in meta["chapters"] for a in ch["activities"]]
    assert activities and all(a["is_locked"] for a in activities)
    assert all(a["content"] == {} for a in activities)

    rights = (await client.get(f"/api/v1/courses/{course_uuid}/rights")).json()
    assert rights["permissions"]["enroll"] is True
    assert rights["permissions"]["work_on_content"] is False

    # Not enrolled: can't hand in work.
    assignment = (await db.execute(
        select(Assignment).where(Assignment.assignment_uuid == stable_uuid(
            "assignment", stable_uuid("activity", "aif-practice-learning")
        ))
    )).scalars().first()
    blocked = await client.post(f"/api/v1/assignments/{assignment.assignment_uuid}/submissions")
    assert blocked.status_code == 403

    enrolled = await client.post(f"/api/v1/trail/add_course/{course_uuid}")
    assert enrolled.status_code == 200, enrolled.text

    meta = (await client.get(f"/api/v1/courses/{course_uuid}/meta")).json()
    activities = [a for ch in meta["chapters"] for a in ch["activities"]]
    assert not any(a["is_locked"] for a in activities)

    # Answer every question correctly, hand in, get auto-graded.
    task = (await db.execute(
        select(AssignmentTask).where(AssignmentTask.assignment_id == assignment.id)
    )).scalars().first()
    submissions = [
        {"questionUUID": q["questionUUID"], "optionUUID": o["optionUUID"], "answer": o["assigned_right_answer"]}
        for q in task.contents["questions"]
        for o in q["options"]
    ]
    saved = await client.put(
        f"/api/v1/assignments/{assignment.assignment_uuid}/tasks/{task.assignment_task_uuid}/submissions",
        json={"task_submission": {"submissions": submissions}},
    )
    assert saved.status_code == 200, saved.text

    handed_in = await client.post(f"/api/v1/assignments/{assignment.assignment_uuid}/submissions")
    assert handed_in.status_code == 200, handed_in.text

    mine = (await client.get(f"/api/v1/assignments/{assignment.assignment_uuid}/submissions/me")).json()
    assert mine[0]["submission_status"] == "GRADED"


async def test_course_authoring_and_teacher_endpoints_are_gone(client, platform):
    act_as(client, platform["admin"])
    course_uuid = stable_uuid("course", "ai-foundations")
    assert (await client.post("/api/v1/courses/?org_id=1", json={})).status_code in (404, 405)
    assert (await client.put(f"/api/v1/courses/{course_uuid}", json={"name": "x"})).status_code in (404, 405)
    assert (await client.delete(f"/api/v1/courses/{course_uuid}")).status_code in (404, 405)
    assert (await client.post("/api/v1/chapters/", json={})).status_code in (404, 405)
    assert (await client.post("/api/v1/activities/", json={})).status_code in (404, 405)
    assert (await client.post("/api/v1/assignments/", json={})).status_code in (404, 405)
    assert (await client.get("/api/v1/usergroups/org/1")).status_code == 404
    assert (await client.post("/api/v1/roles/org/1", json={})).status_code in (404, 405)


async def test_playgrounds_are_private_until_shared(client, platform):
    student, friend, admin = platform["student"], platform["friend"], platform["admin"]

    act_as(client, student)
    created = await client.post("/api/v1/playgrounds/?org_id=1", json={"name": "My lab"})
    assert created.status_code == 200, created.text
    pg = created.json()
    assert pg["access_type"] == "restricted" and pg["my_role"] == "owner"
    second = await client.post("/api/v1/playgrounds/?org_id=1", json={"name": "Another"})
    assert second.status_code == 200
    assert len((await client.get("/api/v1/playgrounds/org/1")).json()) == 2

    for outsider in (friend, admin):
        act_as(client, outsider)
        assert (await client.get(f"/api/v1/playgrounds/{pg['playground_uuid']}")).status_code == 404
        assert (await client.get("/api/v1/playgrounds/org/1")).json() == []

    act_as(client, student)
    shared = await client.post(
        f"/api/v1/playgrounds/{pg['playground_uuid']}/shares",
        json={"identifier": "friend", "role": "viewer"},
    )
    assert shared.status_code == 200, shared.text

    act_as(client, friend)
    listed = (await client.get("/api/v1/playgrounds/org/1")).json()
    assert [p["my_role"] for p in listed] == ["viewer"]
    assert (await client.put(f"/api/v1/playgrounds/{pg['playground_uuid']}", json={"name": "mine now"})).status_code == 403
    assert (await client.delete(f"/api/v1/playgrounds/{pg['playground_uuid']}")).status_code == 403

    act_as(client, student)
    renamed = await client.put(f"/api/v1/playgrounds/{pg['playground_uuid']}", json={"name": "Renamed"})
    assert renamed.json()["name"] == "Renamed"
    assert (await client.delete(f"/api/v1/playgrounds/{pg['playground_uuid']}")).status_code == 200


async def test_boards_shared_directly_or_through_a_discussion(client, db, platform):
    student, friend, admin = platform["student"], platform["friend"], platform["admin"]

    act_as(client, student)
    created = await client.post("/api/v1/boards/?org_id=1", json={"name": "Study board"})
    assert created.status_code == 200, created.text
    board_uuid = created.json()["board_uuid"]
    assert [b["board_uuid"] for b in (await client.get("/api/v1/boards/org/1")).json()] == [board_uuid]

    for outsider in (friend, admin):
        act_as(client, outsider)
        assert (await client.get(f"/api/v1/boards/{board_uuid}")).status_code == 403
        assert (await client.get("/api/v1/boards/org/1")).json() == []

    # Linking the board into a community discussion lets its readers work on it.
    act_as(client, student)
    communities = (await client.get("/api/v1/communities/org/1/page/1/limit/50")).json()
    assert communities[0]["name"] == "Community"
    assert len(communities) == 1 + len(load_catalog())
    posted = await client.post(
        f"/api/v1/communities/{communities[0]['community_uuid']}/discussions",
        json={"title": "Help with my study board", "content": "Join in", "board_uuid": board_uuid},
    )
    assert posted.status_code == 200, posted.text
    assert posted.json()["board_uuid"] == board_uuid

    act_as(client, friend)
    assert (await client.get(f"/api/v1/boards/{board_uuid}")).status_code == 200
    membership = (await client.get(f"/api/v1/boards/{board_uuid}/membership")).json()
    assert membership["role"] == "editor"
    assert (await client.delete(f"/api/v1/boards/{board_uuid}")).status_code == 403


async def test_admins_moderate_communities_students_post(client, platform):
    student, admin = platform["student"], platform["admin"]
    act_as(client, student)
    community = (await client.get("/api/v1/communities/org/1/page/1/limit/1")).json()[0]
    rights = (await client.get(f"/api/v1/communities/{community['community_uuid']}/rights")).json()
    assert rights["permissions"]["create_discussion"] is True
    assert rights["permissions"]["moderate"] is False
    assert (await client.put(
        f"/api/v1/communities/{community['community_uuid']}", json={"moderation_words": ["spam"]}
    )).status_code == 403

    posted = (await client.post(
        f"/api/v1/communities/{community['community_uuid']}/discussions",
        json={"title": "Question", "content": "How do I start?"},
    )).json()

    act_as(client, admin)
    assert (await client.put(
        f"/api/v1/communities/{community['community_uuid']}", json={"moderation_words": ["spam"]}
    )).status_code == 200
    assert (await client.delete(f"/api/v1/discussions/{posted['discussion_uuid']}")).status_code == 200


async def test_admin_monitors_without_controlling(client, platform):
    student, admin = platform["student"], platform["admin"]
    course_uuid = stable_uuid("course", "prompt-engineering")

    act_as(client, student)
    assert (await client.get("/api/v1/platform/overview")).status_code == 403
    assert (await client.post(f"/api/v1/trail/add_course/{course_uuid}")).status_code == 200

    act_as(client, admin)
    overview = (await client.get("/api/v1/platform/overview")).json()
    assert overview["users"]["students"] == 2
    assert overview["users"]["admins"] == 1
    assert overview["learning"]["courses"] == len(load_catalog())
    assert overview["learning"]["enrollments"] == 1

    courses = (await client.get("/api/v1/platform/courses")).json()
    assert courses[0]["course_uuid"] == course_uuid
    assert courses[0]["enrollments"] == 1

    # Admins see course content (monitoring) but can't enroll anyone else.
    meta = (await client.get(f"/api/v1/courses/{course_uuid}/meta")).json()
    assert not any(a["is_locked"] for ch in meta["chapters"] for a in ch["activities"])
    assert (await client.post(f"/api/v1/admin/default/enrollments/{student.id}/{course_uuid}")).status_code == 404
