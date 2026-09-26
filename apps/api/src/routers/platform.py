"""Platform monitoring API for admins (read-only).

See ``services/platform/monitoring.py``. Every endpoint requires an admin
account; students get 403.
"""

from typing import List

from fastapi import APIRouter, Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.security.platform_roles import require_admin_account
from src.services.orgs.platform import get_platform_org
from src.services.platform.monitoring import (
    get_course_monitoring,
    get_platform_overview,
    get_recent_community_activity,
)

router = APIRouter(dependencies=[Depends(require_admin_account)])


@router.get(
    "/overview",
    summary="Platform overview",
    description="Users, learning, tool and community totals for the admin home page.",
)
async def api_platform_overview(db_session: AsyncSession = Depends(get_db_session)) -> dict:
    org = await get_platform_org(db_session)
    return await get_platform_overview(org, db_session)


@router.get(
    "/courses",
    summary="Course monitoring",
    description="Every platform course with enrollments, completions and average progress, most popular first.",
)
async def api_platform_courses(db_session: AsyncSession = Depends(get_db_session)) -> List[dict]:
    org = await get_platform_org(db_session)
    return await get_course_monitoring(org, db_session)


@router.get(
    "/community/recent",
    summary="Recent community activity",
    description="Newest discussions and comments across all communities, for moderation.",
)
async def api_platform_recent_community_activity(
    limit: int = Query(30, ge=1, le=100),
    db_session: AsyncSession = Depends(get_db_session),
) -> List[dict]:
    org = await get_platform_org(db_session)
    return await get_recent_community_activity(org, db_session, limit=limit)
