"""The platform organization.

StarLab runs exactly one organization. Courses, memberships, roles and config
all hang off it, and nothing in the product lets a user create, pick or switch
organizations. This module is the single answer to "which org is the
platform?" — signup, OAuth, login policy, the session payload, /instance/info
and the platform console all resolve it here instead of trusting an org id or
slug supplied by the client.

Resolution order:
  1. the org whose slug is STARLAB_INITIAL_ORG_SLUG (default "default"), which
     is the slug the installer seeds;
  2. otherwise the lowest-id organization.

Demo organizations (``is_demo``) are never the platform org.
"""

import os
from typing import Optional

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.organizations import Organization

PLATFORM_ORG_NOT_INSTALLED = (
    "The platform organization has not been installed yet. "
    "Run the install command first."
)


def configured_platform_org_slug() -> str:
    """The slug the installer seeds the platform org with."""
    return (os.environ.get("STARLAB_INITIAL_ORG_SLUG") or "default").strip().lower()


async def find_platform_org(db_session: AsyncSession) -> Optional[Organization]:
    """Return the platform organization, or None before install."""
    by_slug = (
        await db_session.execute(
            select(Organization)
            .where(Organization.slug == configured_platform_org_slug())
            .where(Organization.is_demo == False)  # noqa: E712
        )
    ).scalars().first()
    if by_slug is not None:
        return by_slug

    return (
        await db_session.execute(
            select(Organization)
            .where(Organization.is_demo == False)  # noqa: E712
            .order_by(Organization.id.asc())
            .limit(1)
        )
    ).scalars().first()


async def get_platform_org(db_session: AsyncSession) -> Organization:
    """Return the platform organization, or 503 if it has not been installed."""
    org = await find_platform_org(db_session)
    if org is None or org.id is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=PLATFORM_ORG_NOT_INSTALLED,
        )
    return org


async def get_platform_org_id(db_session: AsyncSession) -> int:
    return int((await get_platform_org(db_session)).id)


async def require_platform_org(org_id: int, db_session: AsyncSession) -> Organization:
    """Return the platform org if ``org_id`` names it, otherwise 404.

    For endpoints that still carry an org id in their path (kept for API
    compatibility). Any other id is treated as not existing, so a client can
    never act on — or even confirm the existence of — a second organization.
    """
    org = await get_platform_org(db_session)
    if int(org.id) != int(org_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    return org
