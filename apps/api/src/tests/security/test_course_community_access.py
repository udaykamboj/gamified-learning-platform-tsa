"""
Course-linked communities are gated by enrollment (docs/refactor/02-discussions.md).
"""

from datetime import datetime

import pytest
from fastapi import HTTPException

from src.db.communities.communities import Community
from src.db.trail_runs import TrailRun
from src.db.trails import Trail
from src.security.rbac import AccessAction, check_resource_access


@pytest.fixture
async def course_community(db, org, course):
    c = Community(
        name="Course discussions",
        public=True,
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


async def _enroll(db, org, course, user):
    trail = Trail(org_id=org.id, user_id=user.id, trail_uuid="trail_x")
    db.add(trail)
    await db.commit()
    await db.refresh(trail)
    db.add(
        TrailRun(
            trail_id=trail.id,
            course_id=course.id,
            org_id=org.id,
            user_id=user.id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
    )
    await db.commit()


@pytest.mark.asyncio
async def test_non_enrolled_student_denied_even_if_public(db, mock_request, regular_user, course_community):
    with pytest.raises(HTTPException) as exc:
        await check_resource_access(
            mock_request, db, regular_user, course_community.community_uuid, AccessAction.READ
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_anonymous_denied(db, mock_request, anonymous_user, course_community):
    with pytest.raises(HTTPException) as exc:
        await check_resource_access(
            mock_request, db, anonymous_user, course_community.community_uuid, AccessAction.READ
        )
    assert exc.value.status_code in (401, 403)


@pytest.mark.asyncio
async def test_enrolled_student_can_read(db, mock_request, org, course, regular_user, course_community):
    await _enroll(db, org, course, regular_user)
    await check_resource_access(
        mock_request, db, regular_user, course_community.community_uuid, AccessAction.READ
    )


@pytest.mark.asyncio
async def test_admin_can_read_without_enrollment(db, mock_request, admin_user, course_community):
    await check_resource_access(
        mock_request, db, admin_user, course_community.community_uuid, AccessAction.READ
    )
