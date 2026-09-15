"""Communities: the platform-wide discussion spaces.

Communities are platform content, like courses (docs/refactor/progress/01-plan.md,
D8). The platform Community and each course's Q&A space are created by the
catalog sync (``src/content/catalog/sync.py``); nobody creates, deletes or
assigns communities from the dashboard. Every signed-in member reads and posts.
Admins moderate: they tune moderation settings here and pin, lock or remove
posts through the discussion and comment services.
"""

from datetime import datetime
from typing import List, Union
from uuid import uuid4

from fastapi import HTTPException, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.communities.communities import (
    Community,
    CommunityRead,
    CommunityUpdate,
)
from src.db.courses.courses import Course
from src.db.users import AnonymousUser, APITokenUser, PublicUser
from src.security.auth import resolve_acting_user_id
from src.security.org_auth import is_org_member
from src.security.rbac import (
    AccessAction,
    authorization_verify_based_on_org_admin_status,
    check_resource_access,
)


async def get_community(
    request: Request,
    community_uuid: str,
    current_user: Union[PublicUser, AnonymousUser, APITokenUser],
    db_session: AsyncSession,
) -> CommunityRead:
    """Get a community by UUID."""
    statement = select(Community).where(Community.community_uuid == community_uuid)
    community = (await db_session.execute(statement)).scalars().first()

    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    await check_resource_access(request, db_session, current_user, community_uuid, AccessAction.READ)

    course_uuid = None
    if community.course_id:
        course_uuid = (
            await db_session.execute(select(Course.course_uuid).where(Course.id == community.course_id))
        ).scalar_one_or_none()

    return CommunityRead.model_validate({**community.model_dump(), "course_uuid": course_uuid})


async def get_communities_by_org(
    request: Request,
    org_id: int,
    current_user: Union[PublicUser, AnonymousUser, APITokenUser],
    db_session: AsyncSession,
    page: int = 1,
    limit: int = 10,
) -> List[CommunityRead]:
    """
    List the platform's communities: the platform Community first, then course Q&A.

    Signed-in members see all of them. Anonymous visitors see public ones.
    SECURITY: Maximum limit enforced to prevent data dumping.
    """
    limit = min(limit, 50)
    page = max(page, 1)
    offset = (page - 1) * limit

    acting_user_id = resolve_acting_user_id(current_user)
    query = select(Community).where(Community.org_id == org_id)
    if isinstance(current_user, AnonymousUser) or acting_user_id == 0:
        query = query.where(Community.public == True)  # noqa: E712
    elif not getattr(current_user, "is_superadmin", False) and not await is_org_member(
        acting_user_id, org_id, db_session
    ):
        raise HTTPException(status_code=403, detail="You must be a member of this platform")

    # Course-less (platform) communities first, newest course Q&A after.
    query = (
        query.order_by(Community.course_id.is_not(None), Community.creation_date.desc())  # type: ignore
        .offset(offset)
        .limit(limit)
    )
    communities = (await db_session.execute(query)).scalars().all()

    course_ids = [c.course_id for c in communities if c.course_id]
    course_uuids: dict[int, str] = {}
    if course_ids:
        rows = (
            await db_session.execute(
                select(Course.id, Course.course_uuid).where(Course.id.in_(course_ids))  # type: ignore
            )
        ).all()
        course_uuids = {row[0]: row[1] for row in rows}

    return [
        CommunityRead.model_validate(
            {**c.model_dump(), "course_uuid": course_uuids.get(c.course_id) if c.course_id else None}
        )
        for c in communities
    ]


async def get_community_by_course(
    request: Request,
    course_uuid: str,
    current_user: Union[PublicUser, AnonymousUser, APITokenUser],
    db_session: AsyncSession,
) -> CommunityRead | None:
    """Get the course's Q&A community, or None if the catalog hasn't synced one."""
    course_statement = select(Course).where(Course.course_uuid == course_uuid)
    course = (await db_session.execute(course_statement)).scalars().first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    community_statement = select(Community).where(Community.course_id == course.id)
    community = (await db_session.execute(community_statement)).scalars().first()

    if not community:
        return None

    await check_resource_access(
        request, db_session, current_user, community.community_uuid, AccessAction.READ
    )

    return CommunityRead.model_validate({**community.model_dump(), "course_uuid": course.course_uuid})


async def update_community(
    request: Request,
    community_uuid: str,
    community_object: CommunityUpdate,
    current_user: Union[PublicUser, AnonymousUser, APITokenUser],
    db_session: AsyncSession,
) -> CommunityRead:
    """
    Update a community's moderation rules (banned words, posting limits).

    Admins only. The community's name, description and visibility are platform
    content owned by the catalog, so they are not editable here.
    """
    statement = select(Community).where(Community.community_uuid == community_uuid)
    community = (await db_session.execute(statement)).scalars().first()

    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    await require_community_moderator(request, community, current_user, db_session)

    if community_object.moderation_words is not None:
        community.moderation_words = community_object.moderation_words
    if community_object.moderation_settings is not None:
        community.moderation_settings = community_object.moderation_settings

    community.update_date = str(datetime.now())

    db_session.add(community)
    await db_session.commit()
    await db_session.refresh(community)

    return CommunityRead.model_validate(community.model_dump())


async def is_community_moderator(
    request: Request,
    community: Community,
    current_user: Union[PublicUser, AnonymousUser, APITokenUser],
    db_session: AsyncSession,
) -> bool:
    """Moderators are the platform's admins (spec: "moderators should just be admins")."""
    if isinstance(current_user, (AnonymousUser, APITokenUser)):
        return False
    if getattr(current_user, "is_superadmin", False):
        return True
    return await authorization_verify_based_on_org_admin_status(
        request, current_user.id, "update", community.community_uuid, db_session
    )


async def require_community_moderator(
    request: Request,
    community: Community,
    current_user: Union[PublicUser, AnonymousUser, APITokenUser],
    db_session: AsyncSession,
) -> None:
    if not await is_community_moderator(request, community, current_user, db_session):
        raise HTTPException(status_code=403, detail="Only moderators can do this")


async def get_community_user_rights(
    request: Request,
    community_uuid: str,
    current_user: Union[PublicUser, AnonymousUser, APITokenUser],
    db_session: AsyncSession,
) -> dict:
    """Rights for UI feature toggling: members read and post, admins moderate."""
    statement = select(Community).where(Community.community_uuid == community_uuid)
    community = (await db_session.execute(statement)).scalars().first()

    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    acting_user_id = resolve_acting_user_id(current_user)

    rights = {
        "community_uuid": community_uuid,
        "user_id": acting_user_id,
        "is_anonymous": acting_user_id == 0,
        "permissions": {
            "read": False,
            "create_discussion": False,
            "moderate": False,
        },
        "ownership": {
            "is_moderator": False,
        },
    }

    try:
        await check_resource_access(request, db_session, current_user, community_uuid, AccessAction.READ)
        rights["permissions"]["read"] = True
    except HTTPException:
        return rights

    if acting_user_id == 0:
        return rights

    rights["permissions"]["create_discussion"] = True
    if await is_community_moderator(request, community, current_user, db_session):
        rights["permissions"]["moderate"] = True
        rights["ownership"]["is_moderator"] = True

    return rights


async def ensure_community(
    db_session: AsyncSession,
    *,
    org_id: int,
    community_uuid: str,
    name: str,
    description: str,
    course_id: int | None = None,
) -> Community:
    """Create or refresh a platform community. Used by the catalog sync only."""
    community = (
        await db_session.execute(select(Community).where(Community.community_uuid == community_uuid))
    ).scalars().first()
    now = str(datetime.now())
    if community is None:
        # A course Q&A created before the catalog existed keeps its posts.
        if course_id is not None:
            community = (
                await db_session.execute(select(Community).where(Community.course_id == course_id))
            ).scalars().first()
        if community is None:
            community = Community(
                community_uuid=community_uuid or f"community_{uuid4()}",
                org_id=org_id,
                creation_date=now,
                name=name,
            )
    changed = False
    for field, value in (
        ("name", name),
        ("description", description),
        ("public", True),
        ("org_id", org_id),
        ("course_id", course_id),
    ):
        if getattr(community, field) != value:
            setattr(community, field, value)
            changed = True
    if changed or community.id is None:
        community.update_date = now
        db_session.add(community)
        await db_session.flush()
    return community
