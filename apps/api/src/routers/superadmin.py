import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Request
from sqlmodel import select, func, or_
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.events.database import get_db_session
from src.security.superadmin import require_superadmin
from src.db.users import User

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get(
    "/users",
    summary="List all users",
    dependencies=[Depends(require_superadmin)]
)
async def api_superadmin_users(
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    sort: Optional[str] = "id",
    superadmin: Optional[str] = "all"
):
    """
    Get all users across the platform.
    """
    query = select(User)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                User.username.ilike(search_pattern),
                User.email.ilike(search_pattern),
                User.first_name.ilike(search_pattern),
                User.last_name.ilike(search_pattern)
            )
        )
        
    if superadmin == "yes":
        query = query.where(User.is_superadmin == True)
    elif superadmin == "no":
        query = query.where(User.is_superadmin == False)
        
    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db_session.execute(count_query)).scalar() or 0
    
    # Sorting
    if sort == "id":
        query = query.order_by(User.id.desc())
    elif sort == "creation_date":
        query = query.order_by(User.creation_date.desc())
    elif sort == "username":
        query = query.order_by(User.username.asc())
        
    # Pagination
    query = query.offset((page - 1) * limit).limit(limit)
    
    users = (await db_session.execute(query)).scalars().all()
    
    items = []
    for u in users:
        items.append({
            "id": u.id,
            "user_uuid": u.user_uuid,
            "username": u.username,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "avatar_image": getattr(u, "avatar_image", None) or "",
            "is_superadmin": u.is_superadmin,
            "org_count": 1,
            "creation_date": getattr(u, "creation_date", ""),
            "update_date": getattr(u, "update_date", "")
        })
        
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit
    }


@router.get(
    "/analytics/global",
    summary="Get global analytics",
    dependencies=[Depends(require_superadmin)]
)
async def api_superadmin_analytics_global(
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
    days: int = 30
):
    """
    Get mock global analytics for OSS.
    """
    from src.db.courses.courses import Course
    
    users_count = (await db_session.execute(select(func.count()).select_from(User))).scalar() or 0
    courses_count = (await db_session.execute(select(func.count()).select_from(Course))).scalar() or 0
    
    return {
        "Total_Users": {
            "data": [{"users": users_count}]
        },
        "Total_Courses": {
            "data": [{"courses": courses_count}]
        }
    }
