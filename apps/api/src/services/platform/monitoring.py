"""Platform monitoring for admins.

Admins observe and maintain the platform; they do not direct anyone's learning
(docs/refactor/progress/00-requirements.md, R18-R22). Everything here is
read-only and aggregate: how many people use the platform, how each platform
course is doing, and what is being posted in the community so it can be
moderated.
"""

from datetime import datetime, timedelta

from sqlalchemy import case
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.boards import Board
from src.db.communities.communities import Community
from src.db.communities.discussion_comments import DiscussionComment
from src.db.communities.discussions import Discussion
from src.db.courses.activities import Activity
from src.db.courses.assignments import Assignment, AssignmentUserSubmission
from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.db.playgrounds import Playground
from src.db.podcasts.podcasts import Podcast
from src.db.trail_runs import TrailRun, StatusEnum
from src.db.trail_steps import TrailStep
from src.db.user_organizations import UserOrganization
from src.db.users import User
from src.security.rbac.constants import ADMIN_ROLE_ID, USER_ROLE_ID


async def _count(db_session: AsyncSession, statement) -> int:
    return int((await db_session.execute(statement)).scalar() or 0)


async def get_platform_overview(org: Organization, db_session: AsyncSession) -> dict:
    """Headline numbers for the admin home page."""
    org_id = org.id
    since = str(datetime.now() - timedelta(days=30))

    members = select(func.count()).select_from(UserOrganization).where(UserOrganization.org_id == org_id)
    students = await _count(db_session, members.where(UserOrganization.role_id == USER_ROLE_ID))
    admins = await _count(db_session, members.where(UserOrganization.role_id == ADMIN_ROLE_ID))
    new_signups = await _count(db_session, members.where(UserOrganization.creation_date >= since))
    active_learners = await _count(
        db_session,
        select(func.count(func.distinct(TrailStep.user_id))).where(
            TrailStep.org_id == org_id, TrailStep.update_date >= since
        ),
    )

    return {
        "users": {
            "students": students,
            "admins": admins,
            "new_last_30_days": new_signups,
            "active_learners_last_30_days": active_learners,
        },
        "learning": {
            "courses": await _count(db_session, select(func.count()).select_from(Course).where(
                Course.org_id == org_id, Course.published == True  # noqa: E712
            )),
            "enrollments": await _count(db_session, select(func.count()).select_from(TrailRun).where(
                TrailRun.org_id == org_id
            )),
            "completions": await _count(db_session, select(func.count()).select_from(TrailRun).where(
                TrailRun.org_id == org_id, TrailRun.status == StatusEnum.STATUS_COMPLETED
            )),
            "submissions": await _count(
                db_session,
                select(func.count())
                .select_from(AssignmentUserSubmission)
                .join(Assignment, Assignment.id == AssignmentUserSubmission.assignment_id)
                .where(Assignment.org_id == org_id),
            ),
        },
        "tools": {
            "playgrounds": await _count(db_session, select(func.count()).select_from(Playground).where(Playground.org_id == org_id)),
            "boards": await _count(db_session, select(func.count()).select_from(Board).where(Board.org_id == org_id)),
            "podcasts": await _count(db_session, select(func.count()).select_from(Podcast).where(Podcast.org_id == org_id)),
        },
        "community": {
            "communities": await _count(db_session, select(func.count()).select_from(Community).where(Community.org_id == org_id)),
            "discussions": await _count(db_session, select(func.count()).select_from(Discussion).where(Discussion.org_id == org_id)),
            "discussions_last_30_days": await _count(db_session, select(func.count()).select_from(Discussion).where(
                Discussion.org_id == org_id, Discussion.creation_date >= since
            )),
        },
        "system": {
            "database": "ok",
            "generated_at": datetime.now().isoformat(),
        },
    }


async def get_course_monitoring(org: Organization, db_session: AsyncSession) -> list[dict]:
    """Every platform course with usage and completion, most popular first."""
    courses = (await db_session.execute(
        select(Course).where(Course.org_id == org.id).order_by(Course.name)
    )).scalars().all()
    if not courses:
        return []
    course_ids = [c.id for c in courses]

    run_rows = (await db_session.execute(
        select(
            TrailRun.course_id,
            func.count(TrailRun.id),
            func.sum(case((TrailRun.status == StatusEnum.STATUS_COMPLETED, 1), else_=0)),
        )
        .where(TrailRun.course_id.in_(course_ids))  # type: ignore[attr-defined]
        .group_by(TrailRun.course_id)
    )).all()
    runs = {row[0]: (int(row[1] or 0), int(row[2] or 0)) for row in run_rows}

    activity_rows = (await db_session.execute(
        select(Activity.course_id, func.count(Activity.id))
        .where(Activity.course_id.in_(course_ids), Activity.published == True)  # type: ignore[attr-defined]  # noqa: E712
        .group_by(Activity.course_id)
    )).all()
    activity_counts = {row[0]: int(row[1] or 0) for row in activity_rows}

    step_rows = (await db_session.execute(
        select(TrailStep.course_id, func.count(TrailStep.id))
        .where(TrailStep.course_id.in_(course_ids), TrailStep.complete == True)  # type: ignore[attr-defined]  # noqa: E712
        .group_by(TrailStep.course_id)
    )).all()
    completed_steps = {row[0]: int(row[1] or 0) for row in step_rows}

    result = []
    for course in courses:
        enrollments, completions = runs.get(course.id, (0, 0))
        total_activities = activity_counts.get(course.id, 0)
        possible = enrollments * total_activities
        result.append({
            "course_uuid": course.course_uuid,
            "name": course.name,
            "description": course.description,
            "published": course.published,
            "in_catalog": bool((course.extra_metadata or {}).get("catalog_slug")),
            "total_activities": total_activities,
            "enrollments": enrollments,
            "completions": completions,
            "in_progress": enrollments - completions,
            "completion_rate": round(completions / enrollments * 100, 1) if enrollments else 0.0,
            "average_progress": round(completed_steps.get(course.id, 0) / possible * 100, 1) if possible else 0.0,
        })
    result.sort(key=lambda c: (not c["published"], -c["enrollments"], c["name"]))
    return result


async def get_recent_community_activity(org: Organization, db_session: AsyncSession, limit: int = 30) -> list[dict]:
    """Newest discussions and comments across every community, for moderation."""
    discussions = (await db_session.execute(
        select(Discussion, Community, User)
        .join(Community, Community.id == Discussion.community_id)
        .join(User, User.id == Discussion.author_id)
        .where(Discussion.org_id == org.id)
        .order_by(Discussion.creation_date.desc())  # type: ignore[attr-defined]
        .limit(limit)
    )).all()
    comments = (await db_session.execute(
        select(DiscussionComment, Discussion, Community, User)
        .join(Discussion, Discussion.id == DiscussionComment.discussion_id)
        .join(Community, Community.id == Discussion.community_id)
        .join(User, User.id == DiscussionComment.author_id)
        .where(Discussion.org_id == org.id)
        .order_by(DiscussionComment.creation_date.desc())  # type: ignore[attr-defined]
        .limit(limit)
    )).all()

    def author(user: User) -> dict:
        return {"user_uuid": user.user_uuid, "username": user.username, "avatar_image": user.avatar_image}

    items = [
        {
            "type": "discussion",
            "uuid": d.discussion_uuid,
            "discussion_uuid": d.discussion_uuid,
            "title": d.title,
            "content": (d.content or "")[:500],
            "community_uuid": c.community_uuid,
            "community_name": c.name,
            "is_pinned": d.is_pinned,
            "is_locked": d.is_locked,
            "author": author(u),
            "creation_date": d.creation_date,
        }
        for d, c, u in discussions
    ] + [
        {
            "type": "comment",
            "uuid": cm.comment_uuid,
            "discussion_uuid": d.discussion_uuid,
            "title": d.title,
            "content": (cm.content or "")[:500],
            "community_uuid": c.community_uuid,
            "community_name": c.name,
            "is_pinned": False,
            "is_locked": d.is_locked,
            "author": author(u),
            "creation_date": cm.creation_date,
        }
        for cm, d, c, u in comments
    ]
    items.sort(key=lambda item: item["creation_date"] or "", reverse=True)
    return items[:limit]
