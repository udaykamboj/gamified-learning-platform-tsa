"""
A course's community is its Q&A space: reading it follows course read access,
not enrollment (docs/refactor/03-change-list.md, section A).
"""

from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.communities.communities import Community
from src.security.rbac import AccessAction, check_resource_access
from src.services.communities.communities import (get_community_by_course, get_community_user_rights)


@pytest.fixture
async def course_community(db, org, course):
    c = Community(
        name="Course Q&A",
        public=False,
        org_id=org.id,
        course_id=course.id,
        community_uuid="community_course",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


@pytest.mark.asyncio
async def test_student_reads_without_starting_course(db, mock_request, regular_user, course_community):
    # Public+published course, no TrailRun, community itself not public.
    await check_resource_access(
        mock_request, db, regular_user, course_community.community_uuid, AccessAction.READ
    )


@pytest.mark.asyncio
async def test_student_denied_when_course_not_readable(db, mock_request, course, regular_user, course_community):
    course.public = False
    course.published = False
    db.add(course)
    await db.commit()
    with pytest.raises(HTTPException) as exc:
        await check_resource_access(
            mock_request, db, regular_user, course_community.community_uuid, AccessAction.READ
        )
    assert exc.value.status_code in (401, 403)


@pytest.mark.asyncio
async def test_public_flag_does_not_bypass_course(db, mock_request, course, regular_user, course_community):
    course.public = False
    course.published = False
    course_community.public = True
    db.add(course)
    db.add(course_community)
    await db.commit()
    with pytest.raises(HTTPException):
        await check_resource_access(
            mock_request, db, regular_user, course_community.community_uuid, AccessAction.READ
        )


@pytest.mark.asyncio
async def test_student_cannot_update_community(db, mock_request, regular_user, course_community):
    with pytest.raises(HTTPException) as exc:
        await check_resource_access(
            mock_request, db, regular_user, course_community.community_uuid, AccessAction.UPDATE
        )
    assert exc.value.status_code in (401, 403)


@pytest.mark.asyncio
async def test_student_cannot_read_public_draft_course(db, mock_request, course, regular_user):
    course.published = False
    db.add(course)
    await db.commit()
    with pytest.raises(HTTPException):
        await check_resource_access(mock_request, db, regular_user, course.course_uuid, AccessAction.READ)


@pytest.mark.asyncio
async def test_reading_never_creates_a_community(db, mock_request, course, regular_user):
    assert await get_community_by_course(mock_request, course.course_uuid, regular_user, db) is None
    assert (await db.execute(select(Community))).first() is None


@pytest.mark.asyncio
async def test_student_rights_allow_posting(db, mock_request, regular_user, course_community):
    rights = await get_community_user_rights(
        mock_request, course_community.community_uuid, regular_user, db
    )
    assert rights["permissions"]["read"] is True
    assert rights["permissions"]["create_discussion"] is True
    assert rights["permissions"]["update"] is False
    assert rights["access"]["via_public"] is False


@pytest.mark.asyncio
async def test_admin_can_read(db, mock_request, admin_user, course, course_community):
    course.published = False
    db.add(course)
    await db.commit()
    await check_resource_access(
        mock_request, db, admin_user, course_community.community_uuid, AccessAction.READ
    )
