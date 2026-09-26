"""Playgrounds: the student's own AI workspaces.

Any signed-in member creates as many as they want, renames, edits and deletes
their own, keeps them private or shares them with specific people
(docs/refactor/progress/00-requirements.md, R12). Nobody provisions playgrounds
and admins have no special access to a student's playground.

Access:
- owner: everything
- shared editor: open, generate, rename and edit content
- shared viewer: open
- access_type AUTHENTICATED / PUBLIC: anyone signed in / anyone with the link can open it
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from fastapi import HTTPException, Request, UploadFile
from sqlmodel import func, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.db.playgrounds import (
    Playground,
    PlaygroundAccessType,
    PlaygroundCreate,
    PlaygroundRead,
    PlaygroundShare,
    PlaygroundShareCreate,
    PlaygroundShareRead,
    PlaygroundShareRole,
    PlaygroundUpdate,
)
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, APITokenUser, PublicUser, User
from src.security.auth import resolve_acting_user_id
from src.services.utils.upload_content import upload_file
from src.services.webhooks.dispatch import dispatch_webhooks

OWNER = "owner"


def _now() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


async def _get_playground_or_404(playground_uuid: str, db_session: AsyncSession) -> Playground:
    playground = (await db_session.execute(
        select(Playground).where(Playground.playground_uuid == playground_uuid)
    )).scalars().first()
    if not playground:
        raise HTTPException(status_code=404, detail="Playground not found")
    return playground


async def _require_member(user_id: int, org_id: int, db_session: AsyncSession) -> None:
    """The caller must belong to the platform; also applies its 2FA policy."""
    membership = (await db_session.execute(
        select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.org_id == org_id,
        )
    )).scalars().first()
    if membership is None:
        raise HTTPException(status_code=403, detail="You must be a member of this platform")
    from src.security.org_auth import enforce_org_mfa

    await enforce_org_mfa(user_id, org_id, db_session)


async def get_playground_role(
    playground: Playground,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> Optional[str]:
    """The caller's relation to the playground: owner, editor, viewer or None."""
    if isinstance(current_user, AnonymousUser):
        return None
    user_id = resolve_acting_user_id(current_user)
    if playground.created_by == user_id:
        return OWNER
    share = (await db_session.execute(
        select(PlaygroundShare).where(
            PlaygroundShare.playground_id == playground.id,
            PlaygroundShare.user_id == user_id,
        )
    )).scalars().first()
    return share.role if share else None


async def _check_read_access(
    playground: Playground,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> Optional[str]:
    """Raise unless the caller can open the playground. Returns their role."""
    role = await get_playground_role(playground, current_user, db_session)
    if role is not None:
        return role
    if playground.access_type == PlaygroundAccessType.PUBLIC:
        return None
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    if playground.access_type == PlaygroundAccessType.AUTHENTICATED:
        return None
    # Private playgrounds don't reveal they exist.
    raise HTTPException(status_code=404, detail="Playground not found")


async def require_playground_editor(
    playground: Playground,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> str:
    """Owner or shared editor. Used by edits and AI generation."""
    role = await get_playground_role(playground, current_user, db_session)
    if role in (OWNER, PlaygroundShareRole.EDITOR.value):
        return role
    if role is None:
        await _check_read_access(playground, current_user, db_session)
    raise HTTPException(status_code=403, detail="You can't edit this playground")


async def _require_owner(
    playground: Playground,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> None:
    role = await get_playground_role(playground, current_user, db_session)
    if role == OWNER:
        return
    if role is None:
        await _check_read_access(playground, current_user, db_session)
    raise HTTPException(status_code=403, detail="Only the owner can do this")


async def _to_read(
    playground: Playground,
    db_session: AsyncSession,
    my_role: Optional[str] = None,
    org: Optional[Organization] = None,
    author: Optional[User] = None,
) -> PlaygroundRead:
    read = PlaygroundRead.model_validate(playground)
    if org is None:
        org = (await db_session.execute(
            select(Organization).where(Organization.id == playground.org_id)
        )).scalars().first()
    if org:
        read.org_uuid = org.org_uuid
        read.org_slug = org.slug
    if author is None and playground.created_by:
        author = (await db_session.execute(
            select(User).where(User.id == playground.created_by)
        )).scalars().first()
    if author:
        read.author_username = author.username
        read.author_first_name = author.first_name
        read.author_last_name = author.last_name
        read.author_user_uuid = author.user_uuid
        read.author_avatar_image = author.avatar_image
    read.my_role = my_role
    return read


async def _resolve_course_id(course_uuid: Optional[str], org_id: int, db_session: AsyncSession) -> Optional[int]:
    if not course_uuid:
        return None
    course = (await db_session.execute(
        select(Course).where(Course.course_uuid == course_uuid)
    )).scalars().first()
    return course.id if course and course.org_id == org_id else None


async def create_playground(
    request: Request,
    org_id: int,
    playground_data: PlaygroundCreate,
    current_user: PublicUser,
    db_session: AsyncSession,
) -> PlaygroundRead:
    org = (await db_session.execute(select(Organization).where(Organization.id == org_id))).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if isinstance(current_user, (AnonymousUser, APITokenUser)):
        raise HTTPException(status_code=401, detail="Sign in to create a playground")

    acting_user_id = resolve_acting_user_id(current_user)
    await _require_member(acting_user_id, org_id, db_session)

    now = _now()
    playground = Playground(
        name=playground_data.name,
        description=playground_data.description,
        thumbnail_image=playground_data.thumbnail_image,
        access_type=playground_data.access_type,
        published=False,
        course_uuid=playground_data.course_uuid,
        html_content=playground_data.html_content,
        org_id=org_id,
        playground_uuid=str(uuid4()),
        course_id=await _resolve_course_id(playground_data.course_uuid, org_id, db_session),
        created_by=acting_user_id,
        creation_date=now,
        update_date=now,
    )
    db_session.add(playground)
    await db_session.commit()
    await db_session.refresh(playground)

    await dispatch_webhooks(
        event_name="playground_created",
        org_id=org_id,
        data={
            "playground_uuid": playground.playground_uuid,
            "name": playground.name,
            "created_by": acting_user_id,
        },
    )

    return await _to_read(playground, db_session, my_role=OWNER, org=org)


async def get_playground(
    request: Request,
    playground_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> PlaygroundRead:
    playground = await _get_playground_or_404(playground_uuid, db_session)
    role = await _check_read_access(playground, current_user, db_session)
    return await _to_read(playground, db_session, my_role=role)


async def list_org_playgrounds(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> List[PlaygroundRead]:
    """The caller's playgrounds: owned and shared with them, most recent first."""
    if isinstance(current_user, AnonymousUser):
        return []
    user_id = resolve_acting_user_id(current_user)
    await _require_member(user_id, org_id, db_session)

    rows = (await db_session.execute(
        select(Playground, PlaygroundShare.role)
        .outerjoin(
            PlaygroundShare,
            (PlaygroundShare.playground_id == Playground.id) & (PlaygroundShare.user_id == user_id),
        )
        .where(Playground.org_id == org_id)
        .where(or_(Playground.created_by == user_id, PlaygroundShare.user_id == user_id))
        .order_by(Playground.update_date.desc())  # type: ignore[attr-defined]
    )).all()
    if not rows:
        return []

    org = (await db_session.execute(select(Organization).where(Organization.id == org_id))).scalars().first()
    author_ids = {pg.created_by for pg, _ in rows if pg.created_by}
    authors = {
        u.id: u
        for u in (await db_session.execute(select(User).where(User.id.in_(author_ids)))).scalars().all()  # type: ignore[attr-defined]
    } if author_ids else {}

    return [
        await _to_read(
            pg,
            db_session,
            my_role=OWNER if pg.created_by == user_id else share_role,
            org=org,
            author=authors.get(pg.created_by),
        )
        for pg, share_role in rows
    ]


async def update_playground(
    request: Request,
    playground_uuid: str,
    playground_data: PlaygroundUpdate,
    current_user: PublicUser,
    db_session: AsyncSession,
) -> PlaygroundRead:
    playground = await _get_playground_or_404(playground_uuid, db_session)
    role = await require_playground_editor(playground, current_user, db_session)

    update_data = playground_data.model_dump(exclude_unset=True)
    # Who can open it is the owner's decision.
    if role != OWNER and ({"access_type", "published"} & update_data.keys()):
        raise HTTPException(status_code=403, detail="Only the owner can change who can open this playground")

    if "course_uuid" in update_data:
        playground.course_id = await _resolve_course_id(update_data.get("course_uuid"), playground.org_id, db_session)

    for key, value in update_data.items():
        setattr(playground, key, value)

    playground.update_date = _now()
    db_session.add(playground)
    await db_session.commit()
    await db_session.refresh(playground)
    return await _to_read(playground, db_session, my_role=role)


async def delete_playground(
    request: Request,
    playground_uuid: str,
    current_user: PublicUser,
    db_session: AsyncSession,
) -> dict:
    playground = await _get_playground_or_404(playground_uuid, db_session)
    await _require_owner(playground, current_user, db_session)

    await db_session.delete(playground)
    await db_session.commit()
    return {"detail": "Playground deleted"}


async def duplicate_playground(
    request: Request,
    playground_uuid: str,
    current_user: PublicUser,
    db_session: AsyncSession,
) -> PlaygroundRead:
    """Copy a playground the caller can open into a new private one they own."""
    playground = await _get_playground_or_404(playground_uuid, db_session)
    await _check_read_access(playground, current_user, db_session)
    if isinstance(current_user, (AnonymousUser, APITokenUser)):
        raise HTTPException(status_code=401, detail="Sign in to copy a playground")
    acting_user_id = resolve_acting_user_id(current_user)
    await _require_member(acting_user_id, playground.org_id, db_session)

    now = _now()
    new_playground = Playground(
        name=f"{playground.name} (Copy)",
        description=playground.description,
        thumbnail_image=None,
        access_type=PlaygroundAccessType.RESTRICTED,
        published=False,
        course_uuid=playground.course_uuid,
        html_content=playground.html_content,
        org_id=playground.org_id,
        playground_uuid=str(uuid4()),
        course_id=playground.course_id,
        created_by=acting_user_id,
        creation_date=now,
        update_date=now,
    )
    db_session.add(new_playground)
    await db_session.commit()
    await db_session.refresh(new_playground)
    return await _to_read(new_playground, db_session, my_role=OWNER)


async def update_playground_thumbnail(
    request: Request,
    playground_uuid: str,
    current_user: PublicUser,
    db_session: AsyncSession,
    thumbnail_file: UploadFile | None = None,
) -> PlaygroundRead:
    playground = await _get_playground_or_404(playground_uuid, db_session)
    role = await require_playground_editor(playground, current_user, db_session)

    org = (await db_session.execute(select(Organization).where(Organization.id == playground.org_id))).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if not thumbnail_file or not thumbnail_file.filename:
        raise HTTPException(status_code=400, detail="No thumbnail file provided")

    name_in_disk = await upload_file(
        file=thumbnail_file,
        directory=f"playgrounds/{playground.playground_uuid}/thumbnails",
        type_of_dir="orgs",
        uuid=org.org_uuid,
        allowed_types=["image"],
        filename_prefix="thumbnail",
    )

    playground.thumbnail_image = name_in_disk
    playground.update_date = _now()
    db_session.add(playground)
    await db_session.commit()
    await db_session.refresh(playground)
    return await _to_read(playground, db_session, my_role=role, org=org)


# ── Sharing ────────────────────────────────────────────────────────────────


async def list_playground_shares(
    request: Request,
    playground_uuid: str,
    current_user: PublicUser,
    db_session: AsyncSession,
) -> List[PlaygroundShareRead]:
    playground = await _get_playground_or_404(playground_uuid, db_session)
    await _check_read_access(playground, current_user, db_session)

    rows = (await db_session.execute(
        select(PlaygroundShare, User)
        .join(User, User.id == PlaygroundShare.user_id)
        .where(PlaygroundShare.playground_id == playground.id)
        .order_by(PlaygroundShare.id)
    )).all()
    return [_share_read(share, user) for share, user in rows]


async def share_playground(
    request: Request,
    playground_uuid: str,
    share_data: PlaygroundShareCreate,
    current_user: PublicUser,
    db_session: AsyncSession,
) -> PlaygroundShareRead:
    playground = await _get_playground_or_404(playground_uuid, db_session)
    await _require_owner(playground, current_user, db_session)

    identifier = share_data.identifier.strip()
    target = (await db_session.execute(
        select(User)
        .join(UserOrganization, UserOrganization.user_id == User.id)
        .where(UserOrganization.org_id == playground.org_id)
        .where(or_(
            func.lower(User.username) == identifier.lower(),
            func.lower(User.email) == identifier.lower(),
        ))
    )).scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="No one on the platform has that username or email")
    if target.id == playground.created_by:
        raise HTTPException(status_code=400, detail="You already own this playground")

    share = (await db_session.execute(
        select(PlaygroundShare).where(
            PlaygroundShare.playground_id == playground.id,
            PlaygroundShare.user_id == target.id,
        )
    )).scalars().first()
    if share is None:
        share = PlaygroundShare(
            playground_id=playground.id,
            user_id=target.id,
            creation_date=_now(),
        )
    share.role = share_data.role.value
    db_session.add(share)
    await db_session.commit()
    await db_session.refresh(share)
    return _share_read(share, target)


async def unshare_playground(
    request: Request,
    playground_uuid: str,
    user_id: int,
    current_user: PublicUser,
    db_session: AsyncSession,
) -> dict:
    """The owner removes someone, or a person removes themselves."""
    playground = await _get_playground_or_404(playground_uuid, db_session)
    acting_user_id = resolve_acting_user_id(current_user)
    if acting_user_id != user_id:
        await _require_owner(playground, current_user, db_session)

    share = (await db_session.execute(
        select(PlaygroundShare).where(
            PlaygroundShare.playground_id == playground.id,
            PlaygroundShare.user_id == user_id,
        )
    )).scalars().first()
    if not share:
        raise HTTPException(status_code=404, detail="This playground isn't shared with that person")
    await db_session.delete(share)
    await db_session.commit()
    return {"detail": "Share removed"}


def _share_read(share: PlaygroundShare, user: User) -> PlaygroundShareRead:
    return PlaygroundShareRead(
        user_id=share.user_id,
        role=share.role,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        avatar_image=user.avatar_image,
        user_uuid=user.user_uuid,
        creation_date=share.creation_date,
    )
