import logging
from datetime import datetime
import json
from uuid import uuid4
from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.organization_config import (
    OrganizationConfig,
    OrganizationConfigV2Base,
)
from src.db.organizations import Organization, OrganizationCreate
from src.db.roles import DashboardPermission, Permission, PermissionsWithOwn, Rights, Role, RoleTypeEnum
from src.db.user_organizations import UserOrganization
from src.db.users import User, UserCreate, UserRead
from src.security.security import security_hash_password
from src.security.rbac.constants import ADMIN_ROLE_ID, PLATFORM_ROLE_IDS, USER_ROLE_ID


def _perm(create=False, read=True, update=False, delete=False) -> Permission:
    return Permission(
        action_create=create, action_read=read, action_update=update, action_delete=delete
    )


def _own(create=False, read=True, update=False, delete=False, own=False) -> PermissionsWithOwn:
    """``own`` grants read/update/delete on the caller's own resources."""
    return PermissionsWithOwn(
        action_create=create,
        action_read=read,
        action_read_own=True,
        action_update=update,
        action_update_own=own,
        action_delete=delete,
        action_delete_own=own,
    )


# Student tools (boards, playgrounds) and community posts belong to whoever
# creates them. Nobody grants them, so both roles hold the same "own" rights and
# neither can edit another user's tools (docs/refactor/progress/01-plan.md, D1).
_OWN_TOOL = dict(create=True, read=True, own=True)


# Install Default roles
async def install_default_elements(db_session: AsyncSession):
    """Upsert the two platform roles and retire every teacher-era role.

    Existing roles are updated in place to preserve FK references from
    userorganization."""

    logger = logging.getLogger(__name__)

    # Admin: platform administration, monitoring and community moderation.
    # Courses, chapters, activities and assignments are platform-authored
    # content (src/content/catalog.py), so admins only read them.
    role_global_admin = Role(
        name="Admin",
        description="Platform administration, monitoring and community moderation",
        id=ADMIN_ROLE_ID,
        role_type=RoleTypeEnum.TYPE_GLOBAL,
        role_uuid="role_global_admin",
        rights=Rights(
            courses=_own(),
            users=_perm(read=True, update=True, delete=True),
            folders=_perm(create=True, update=True, delete=True),
            media=_perm(create=True, update=True, delete=True),
            organizations=_perm(update=True),
            coursechapters=_perm(),
            activities=_perm(),
            assignments=_perm(),
            roles=_perm(),
            dashboard=DashboardPermission(action_access=True),
            communities=_perm(update=True),
            discussions=_own(create=True, update=True, delete=True, own=True),
            podcasts=_own(create=True, update=True, delete=True, own=True),
            boards=_own(**_OWN_TOOL),
            playgrounds=_own(**_OWN_TOOL),
        ),
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    # Student: every public signup. Learns at their own pace and owns their tools.
    role_global_user = Role(
        name="User",
        description="Student",
        role_type=RoleTypeEnum.TYPE_GLOBAL,
        role_uuid="role_global_user",
        id=USER_ROLE_ID,
        rights=Rights(
            courses=_own(),
            users=_perm(read=False),
            folders=_perm(),
            media=_perm(),
            organizations=_perm(read=False),
            coursechapters=_perm(),
            activities=_perm(),
            assignments=_perm(),
            roles=_perm(read=False),
            dashboard=DashboardPermission(action_access=False),
            communities=_perm(),
            discussions=_own(create=True, own=True),
            podcasts=_own(),
            boards=_own(**_OWN_TOOL),
            playgrounds=_own(**_OWN_TOOL),
        ),
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    # Serialize rights to JSON
    desired_roles = [role_global_admin, role_global_user]
    for role in desired_roles:
        role.rights = role.rights.model_dump()  # type: ignore

    # Upsert: update existing roles in place, create missing ones
    for desired in desired_roles:
        existing = await db_session.get(Role, desired.id)
        if existing:
            existing.name = desired.name
            existing.description = desired.description
            existing.role_type = desired.role_type
            existing.role_uuid = desired.role_uuid
            existing.rights = desired.rights
            existing.update_date = str(datetime.now())
            db_session.add(existing)
            logger.info(f"Updated existing global role: {desired.name} (id={desired.id})")
        else:
            db_session.add(desired)
            logger.info(f"Created new global role: {desired.name} (id={desired.id})")

    await db_session.commit()

    retired = await retire_teacher_roles(db_session)
    if retired:
        logger.info(f"Retired teacher-era roles: {retired}")

    return True


async def retire_teacher_roles(db_session: AsyncSession) -> list[str]:
    """Remove every role that isn't Admin or Student.

    Maintainer, Instructor and custom organization roles were the teacher layer
    (R1, R2). Their members become Admins when the role granted dashboard
    access (staff) and Students otherwise; then the role rows are deleted.
    API-token roles are untouched: tokens carry their own rights. Idempotent.
    """
    from src.security.platform_roles import role_grants_dashboard_access

    roles = (
        await db_session.execute(
            select(Role).where(
                Role.id.not_in(PLATFORM_ROLE_IDS),
                Role.role_type != RoleTypeEnum.TYPE_ORGANIZATION_API_TOKEN,
            )
        )
    ).scalars().all()
    retired: list[str] = []
    for role in roles:
        target = ADMIN_ROLE_ID if role_grants_dashboard_access(role) else USER_ROLE_ID
        memberships = (
            await db_session.execute(
                select(UserOrganization).where(UserOrganization.role_id == role.id)
            )
        ).scalars().all()
        for membership in memberships:
            membership.role_id = target
            membership.update_date = str(datetime.now())
            db_session.add(membership)
        retired.append(f"{role.name} (id={role.id}, {len(memberships)} members -> {target})")
        await db_session.flush()
        await db_session.delete(role)
    await db_session.commit()
    return retired


# Organization creation
async def install_create_organization(org_object: OrganizationCreate, db_session: AsyncSession):
    # Make installation idempotent by returning early if the org exists
    from sqlmodel import select
    existing_org = (
        await db_session.execute(select(Organization).where(Organization.slug == org_object.slug))
    ).scalars().first()
    if existing_org:
        return existing_org

    org = Organization.model_validate(org_object)

    # Complete the org object
    org.org_uuid = f"org_{uuid4()}"
    org.creation_date = str(datetime.now())
    org.update_date = str(datetime.now())

    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    # Org Config (v2 format)
    org_config = OrganizationConfigV2Base(
        config_version="2.0",
        plan="free",
    )

    org_config = json.loads(org_config.model_dump_json())

    # OrgSettings
    org_settings = OrganizationConfig(
        org_id=int(org.id if org.id else 0),
        config=org_config,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    db_session.add(org_settings)
    await db_session.commit()
    await db_session.refresh(org_settings)

    return org


async def install_create_organization_user(
    user_object: UserCreate,
    org_slug: str,
    db_session: AsyncSession,
    is_superadmin: bool = False,
):
    user = User.model_validate(user_object)

    # Complete the user object
    user.user_uuid = f"user_{uuid4()}"
    user.password = security_hash_password(user_object.password)
    user.email_verified = False
    user.is_superadmin = is_superadmin
    user.creation_date = str(datetime.now())
    user.update_date = str(datetime.now())

    # Verifications

    # Check if Organization exists
    statement = select(Organization).where(Organization.slug == org_slug)
    org = (await db_session.execute(statement)).scalars().first()

    if not org:
        raise HTTPException(
            status_code=409,
            detail="Organization does not exist",
        )

    # Username
    statement = select(User).where(User.username == user.username)
    existing_user = (await db_session.execute(statement)).scalars().first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Username already exists",
        )

    # Email
    statement = select(User).where(User.email == user.email)
    existing_email = (await db_session.execute(statement)).scalars().first()

    if existing_email:
        raise HTTPException(
            status_code=409,
            detail="Email already exists",
        )

    # Exclude unset values
    user_data = user.model_dump(exclude_unset=True)
    for key, value in user_data.items():
        setattr(user, key, value)

    # Add user to database
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # get org id
    statement = select(Organization).where(Organization.slug == org_slug)
    org = (await db_session.execute(statement)).scalars().first()
    org_id = org.id if org else 0

    # Link user and organization
    user_organization = UserOrganization(
        user_id=user.id if user.id else 0,
        org_id=org_id or 0,
        role_id=ADMIN_ROLE_ID,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    db_session.add(user_organization)
    await db_session.commit()
    await db_session.refresh(user_organization)

    # This install/seed user is an org ADMIN — add them to the Loops marketing
    # audience. Best-effort, SaaS-gated (no-op on OSS/self-hosted), never fails
    # the install.
    try:
        from src.services.marketing.loops import record_org_admin_in_loops
        record_org_admin_in_loops(
            email=getattr(user, "email", None),
            org_slug=org_slug,
            first_name=getattr(user, "first_name", None),
            last_name=getattr(user, "last_name", None),
        )
    except Exception:
        pass

    user = UserRead.model_validate(user)

    return user

