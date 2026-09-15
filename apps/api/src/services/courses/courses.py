from typing import List
import logging
from sqlmodel import select, or_, func
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.organizations import Organization
from src.db.roles import Role
from src.db.user_organizations import UserOrganization
from src.db.resource_authors import ResourceAuthor, ResourceAuthorshipStatusEnum
from src.db.users import PublicUser, AnonymousUser, User, UserRead, APITokenUser
from src.db.courses.courses import (
    Course,
    CourseRead,
    FullCourseRead,
    AuthorWithRole,
)
from src.security.auth import resolve_acting_user_id
from src.security.rbac.rbac import (
    authorization_verify_if_user_is_anon,
)
from src.security.rbac import (
    AccessAction,
    AccessContext,
    check_resource_access,
)
from src.security.rbac.constants import ADMIN_ROLE_IDS
from src.security.superadmin import is_user_superadmin
from src.services.search.normalization import LIKE_ESCAPE_CHAR, build_like_pattern
from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)


async def get_course(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
):
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = (await db_session.execute(statement)).scalars().first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # DASHBOARD context lets admins see unpublished courses; students fall
    # back to the platform-content rules (published courses only).
    await check_resource_access(
        request,
        db_session,
        current_user,
        course.course_uuid,
        AccessAction.READ,
        context=AccessContext.DASHBOARD,
    )

    # Get course authors with their roles
    authors_statement = (
        select(ResourceAuthor, User)
        .join(User, ResourceAuthor.user_id == User.id) # type: ignore
        .where(ResourceAuthor.resource_uuid == course.course_uuid)
        .order_by(
            ResourceAuthor.id.asc() # type: ignore
        )
    )
    author_results = (await db_session.execute(authors_statement)).all()

    # Convert to AuthorWithRole objects
    authors = [
        AuthorWithRole(
            user=UserRead.model_validate(user),
            authorship=resource_author.authorship,
            authorship_status=resource_author.authorship_status,
            creation_date=resource_author.creation_date,
            update_date=resource_author.update_date
        )
        for resource_author, user in author_results
    ]

    course = CourseRead(**course.model_dump(), authors=authors)

    return course


async def get_course_by_id(
    request: Request,
    course_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
):
    statement = select(Course).where(Course.id == course_id)
    course = (await db_session.execute(statement)).scalars().first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    await check_resource_access(request, db_session, current_user, course.course_uuid, AccessAction.READ)

    # Get course authors with their roles
    authors_statement = (
        select(ResourceAuthor, User)
        .join(User, ResourceAuthor.user_id == User.id) # type: ignore
        .where(ResourceAuthor.resource_uuid == course.course_uuid)
        .order_by(
            ResourceAuthor.id.asc() # type: ignore
        )
    )
    author_results = (await db_session.execute(authors_statement)).all()

    # Convert to AuthorWithRole objects
    authors = [
        AuthorWithRole(
            user=UserRead.model_validate(user),
            authorship=resource_author.authorship,
            authorship_status=resource_author.authorship_status,
            creation_date=resource_author.creation_date,
            update_date=resource_author.update_date
        )
        for resource_author, user in author_results
    ]

    course = CourseRead(**course.model_dump(), authors=authors)

    return course


async def get_course_meta(
    request: Request,
    course_uuid: str,
    with_unpublished_activities: bool,
    current_user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
    slim: bool = False,
) -> FullCourseRead:
    # Avoid circular import
    from src.services.courses.chapters import get_course_chapters

    # Get course with authors and organization in a single query using joins
    course_statement = (
        select(Course, ResourceAuthor, User, Organization)
        .outerjoin(ResourceAuthor, ResourceAuthor.resource_uuid == Course.course_uuid)  # type: ignore
        .outerjoin(User, ResourceAuthor.user_id == User.id)  # type: ignore
        .join(Organization, Organization.id == Course.org_id)  # type: ignore
        .where(Course.course_uuid == course_uuid)
        .order_by(ResourceAuthor.id.asc())  # type: ignore
    )
    results = (await db_session.execute(course_statement)).all()

    if not results:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # Extract course, authors, and organization from results
    course = results[0][0]  # First result's Course
    org = results[0][3]  # First result's Organization
    author_results = [(ra, u) for _, ra, u, _ in results if ra is not None and u is not None]

    # DASHBOARD context lets admins see unpublished courses; students fall
    # back to the platform-content rules (published courses only).
    await check_resource_access(
        request,
        db_session,
        current_user,
        course.course_uuid,
        AccessAction.READ,
        context=AccessContext.DASHBOARD,
    )

    # Permission check passed — try Redis cache for the heavy data.
    # SECURITY: chapter/activity content is lock-stripped PER USER in
    # _apply_locks_to_chapters (content is blanked until the student enrolls,
    # while admins see everything). The meta cache
    # is keyed only by course_uuid+slim and shared across users, so caching an
    # authenticated user's view would leak restricted content to others (or
    # hide it from those who should see it). Only the anonymous view is uniform
    # (always the public, fully-stripped projection), so restrict the shared
    # cache to anonymous readers.
    is_anonymous = isinstance(current_user, AnonymousUser)
    if is_anonymous and course.published and not with_unpublished_activities:
        from src.services.courses.cache import get_cached_course_meta
        cached = get_cached_course_meta(course_uuid, slim)
        if cached is not None:
            return FullCourseRead.model_validate(cached)

    # Get course chapters — pass the already-loaded course to skip the
    # duplicate SELECT inside get_course_chapters.
    chapters = []
    if course.id is not None:
        chapters = await get_course_chapters(
            request,
            course.id,
            db_session,
            current_user,
            with_unpublished_activities,
            slim=slim,
            course=course,
        )

    # Convert to AuthorWithRole objects
    authors = [
        AuthorWithRole(
            user=UserRead.model_validate(user),
            authorship=resource_author.authorship,
            authorship_status=resource_author.authorship_status,
            creation_date=resource_author.creation_date,
            update_date=resource_author.update_date
        )
        for resource_author, user in author_results
    ]

    # Create course read model with chapters and org_uuid
    course_read = FullCourseRead(
        **course.model_dump(),
        org_uuid=org.org_uuid,
        authors=authors,
        chapters=chapters
    )

    # Cache only the anonymous (public, uniformly-stripped) view. See the read
    # path above for why per-user views must not populate this shared key.
    if is_anonymous and course.published and not with_unpublished_activities:
        from src.services.courses.cache import set_cached_course_meta
        set_cached_course_meta(course_uuid, slim, course_read.model_dump())

    return course_read


async def get_courses_orgslug(
    request: Request,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_slug: str,
    db_session: AsyncSession,
    page: int = 1,
    limit: int = 10,
    include_unpublished: bool = False,
) -> List[CourseRead]:
    # Cap limit to prevent excessive DB reads
    limit = min(limit, 100)

    # Resolve API tokens to their creator so membership / ResourceAuthor
    # filters run against a real user_id rather than the token id (0).
    acting_user_id = resolve_acting_user_id(current_user)

    # For anonymous users viewing public courses, try Redis cache first
    is_anon = isinstance(current_user, AnonymousUser)
    if is_anon and not include_unpublished:
        from src.services.courses.cache import get_cached_courses_list
        cached = get_cached_courses_list(org_slug, page, limit)
        if cached is not None:
            return [CourseRead.model_validate(c) for c in cached]

    offset = (page - 1) * limit

    # Get organization
    org_statement = select(Organization).where(Organization.slug == org_slug)
    org = (await db_session.execute(org_statement)).scalars().first()
    if not org:
        return []

    # Check if user can view unpublished courses (must be admin/editor in org)
    can_view_unpublished = False
    if include_unpublished and not isinstance(current_user, AnonymousUser):
        # Superadmins can always view unpublished courses
        if await is_user_superadmin(acting_user_id, db_session):
            can_view_unpublished = True
        else:
            # Check if user has admin/editor role in this organization
            role_statement = (
                select(Role)
                .join(UserOrganization)
                .where(UserOrganization.org_id == org.id)
                .where(UserOrganization.user_id == acting_user_id)
            )
            user_roles = (await db_session.execute(role_statement)).scalars().all()
            for role in user_roles:
                if role.id in ADMIN_ROLE_IDS:  # Admin role IDs
                    can_view_unpublished = True
                    break

    # Base query
    needs_distinct = False
    query = (
        select(Course)
        .join(Organization)
        .where(Organization.slug == org_slug)
    )

    if isinstance(current_user, AnonymousUser):
        # For anonymous users, only show public AND published courses
        query = query.where(Course.public == True, Course.published == True)
    else:
        # For authenticated users with admin access viewing dashboard, show all courses
        if can_view_unpublished:
            # Admins see all courses in the organization (no additional filter)
            pass
        else:
            # Signed-in students see every published platform course. Nobody
            # grants a course to a student (docs/refactor/progress/00-requirements.md, R8).
            query = query.where(Course.published == True)

    # Apply ordering and pagination — only use DISTINCT when outerjoins may produce duplicates
    query = query.order_by(Course.creation_date.desc()).offset(offset).limit(limit)
    if needs_distinct:
        query = query.distinct()

    courses = (await db_session.execute(query)).scalars().all()

    if not courses:
        return []

    # Get all course UUIDs
    course_uuids = [course.course_uuid for course in courses]
    
    # Fetch all authors for all courses in a single query
    authors_query = (
        select(ResourceAuthor, User)
        .join(User, ResourceAuthor.user_id == User.id)  # type: ignore
        .where(ResourceAuthor.resource_uuid.in_(course_uuids))  # type: ignore
        .order_by(
            ResourceAuthor.id.asc() # type: ignore
        )
    )
    
    author_results = (await db_session.execute(authors_query)).all()
    
    # Create a dictionary mapping course_uuid to list of authors
    course_authors = {}
    for resource_author, user in author_results:
        if resource_author.resource_uuid not in course_authors:
            course_authors[resource_author.resource_uuid] = []
        course_authors[resource_author.resource_uuid].append(
            AuthorWithRole(
                user=UserRead.model_validate(user),
                authorship=resource_author.authorship,
                authorship_status=resource_author.authorship_status,
                creation_date=resource_author.creation_date,
                update_date=resource_author.update_date
            )
        )
    
    # Create CourseRead objects with authors
    course_reads = []
    for course in courses:
        course_read = CourseRead.model_validate({
            **course.model_dump(),
            "id": course.id or 0,  # Ensure id is never None
            "authors": course_authors.get(course.course_uuid, []),
        })
        course_reads.append(course_read)

    # Cache the result for anonymous public views
    if is_anon and not include_unpublished and course_reads:
        from src.services.courses.cache import set_cached_courses_list
        set_cached_courses_list(
            org_slug, page, limit,
            [cr.model_dump() for cr in course_reads]
        )

    return course_reads


async def get_courses_count_orgslug(
    request: Request,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_slug: str,
    db_session: AsyncSession,
) -> int:
    """
    Get total count of courses for an organization (respecting visibility rules)
    """
    acting_user_id = resolve_acting_user_id(current_user)

    # Base query
    query = (
        select(func.count(Course.id.distinct()))
        .join(Organization)
        .where(Organization.slug == org_slug)
    )

    if isinstance(current_user, AnonymousUser):
        # For anonymous users, only count public AND published courses
        query = query.where(Course.public == True, Course.published == True)
    elif not isinstance(current_user, AnonymousUser) and await is_user_superadmin(acting_user_id, db_session):
        # Superadmins see all courses (no additional filter)
        pass
    else:
        # Signed-in students count every published platform course.
        query = query.where(Course.published == True)

    count = (await db_session.execute(query)).scalar_one()
    return count


async def search_courses(
    request: Request,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    org_slug: str,
    search_query: str,
    db_session: AsyncSession,
    page: int = 1,
    limit: int = 10,
) -> List[CourseRead]:
    """
    Search courses within an organization.

    SECURITY FIX: Uses parameterized queries to prevent SQL injection.
    Previously used f-string interpolation which was vulnerable.
    """
    # SECURITY: Enforce maximum limit to prevent data dumping
    limit = min(limit, 100)
    offset = (page - 1) * limit

    pattern = build_like_pattern(search_query)

    needs_distinct = False
    query = (
        select(Course)
        .join(Organization)
        .where(Organization.slug == org_slug)
        .where(
            or_(
                Course.name.ilike(pattern, escape=LIKE_ESCAPE_CHAR),  # type: ignore[attr-defined]
                Course.description.ilike(pattern, escape=LIKE_ESCAPE_CHAR),  # type: ignore[attr-defined]
                Course.about.ilike(pattern, escape=LIKE_ESCAPE_CHAR),  # type: ignore[attr-defined]
                Course.learnings.ilike(pattern, escape=LIKE_ESCAPE_CHAR),  # type: ignore[attr-defined]
                Course.tags.ilike(pattern, escape=LIKE_ESCAPE_CHAR),  # type: ignore[attr-defined]
            )
        )
    )

    search_acting_user_id = resolve_acting_user_id(current_user)

    if isinstance(current_user, AnonymousUser):
        # For anonymous users, only show public AND published courses
        query = query.where(Course.public == True, Course.published == True)
    elif await is_user_superadmin(search_acting_user_id, db_session):
        # Superadmins see all courses (no additional filter)
        pass
    else:
        # Signed-in students search every published platform course.
        query = query.where(Course.published == True)

    # Apply ordering and pagination — only use DISTINCT when outerjoins may produce duplicates
    query = query.order_by(Course.creation_date.desc()).offset(offset).limit(limit)
    if needs_distinct:
        query = query.distinct()

    courses = (await db_session.execute(query)).scalars().all()

    if not courses:
        return []

    # Fetch all authors for all courses in a single query
    course_uuids = [course.course_uuid for course in courses]
    authors_query = (
        select(ResourceAuthor, User)
        .join(User, ResourceAuthor.user_id == User.id)  # type: ignore
        .where(ResourceAuthor.resource_uuid.in_(course_uuids))  # type: ignore
        .order_by(ResourceAuthor.id.asc())  # type: ignore
    )
    author_results = (await db_session.execute(authors_query)).all()

    # Group authors by course_uuid
    course_authors: dict[str, list[AuthorWithRole]] = {}
    for resource_author, user in author_results:
        course_authors.setdefault(resource_author.resource_uuid, []).append(
            AuthorWithRole(
                user=UserRead.model_validate(user),
                authorship=resource_author.authorship,
                authorship_status=resource_author.authorship_status,
                creation_date=resource_author.creation_date,
                update_date=resource_author.update_date
            )
        )

    course_reads = []
    for course in courses:
        course_read = CourseRead.model_validate({
            **course.model_dump(),
            "id": course.id or 0,
            "authors": course_authors.get(course.course_uuid, []),
        })
        course_reads.append(course_read)

    return course_reads


async def get_user_courses(
    request: Request,
    current_user: PublicUser | AnonymousUser,
    user_id: int,
    db_session: AsyncSession,
    page: int = 1,
    limit: int = 10,
) -> List[CourseRead]:
    # Verify user is not anonymous
    await authorization_verify_if_user_is_anon(current_user.id)

    # SECURITY: This endpoint takes an arbitrary target user_id. Without a
    # visibility filter, any logged-in user could enumerate another user's
    # UNPUBLISHED / private courses just by passing their id (IDOR / content
    # disclosure). A caller may only see another user's unpublished courses if
    # they are that user or a superadmin; everyone else is limited to the
    # published + public courses that user authored.
    can_see_unpublished = (
        int(current_user.id) == int(user_id)
        or await is_user_superadmin(int(current_user.id), db_session)
    )

    # Fetch courses the user has authored using a single JOIN query with pagination
    statement = (
        select(Course)
        .join(ResourceAuthor, ResourceAuthor.resource_uuid == Course.course_uuid)  # type: ignore
        .where(
            ResourceAuthor.user_id == user_id,
            ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
        )
    )
    if not can_see_unpublished:
        statement = statement.where(Course.published == True, Course.public == True)
    statement = (
        statement
        .offset((page - 1) * limit)
        .limit(limit)
    )
    
    courses = (await db_session.execute(statement)).scalars().all()
    
    if not courses:
        return []

    # Fetch all authors for all courses in a single query
    course_uuids = [course.course_uuid for course in courses]
    authors_query = (
        select(ResourceAuthor, User)
        .join(User, ResourceAuthor.user_id == User.id)  # type: ignore
        .where(ResourceAuthor.resource_uuid.in_(course_uuids))  # type: ignore
        .order_by(ResourceAuthor.id.asc())  # type: ignore
    )
    author_results = (await db_session.execute(authors_query)).all()

    # Group authors by course_uuid
    course_authors: dict[str, list[AuthorWithRole]] = {}
    for resource_author, user in author_results:
        course_authors.setdefault(resource_author.resource_uuid, []).append(
            AuthorWithRole(
                user=UserRead.model_validate(user),
                authorship=resource_author.authorship,
                authorship_status=resource_author.authorship_status,
                creation_date=resource_author.creation_date,
                update_date=resource_author.update_date,
            )
        )

    result = []
    for course in courses:
        course_read = CourseRead.model_validate({
            **course.model_dump(),
            "id": course.id or 0,
            "authors": course_authors.get(course.course_uuid, []),
        })
        result.append(course_read)

    return result


async def get_course_user_rights(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser | APITokenUser,
    db_session: AsyncSession,
) -> dict:
    """
    What the caller can do with a platform course, for UI feature toggling.

    Nobody authors, grades or manages a course (docs/refactor/progress/00-requirements.md,
    R6). Students read the outline, enroll themselves and then work on the content;
    admins monitor.
    """
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = (await db_session.execute(statement)).scalars().first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    acting_user_id = resolve_acting_user_id(current_user)
    rights = {
        "course_uuid": course_uuid,
        "user_id": acting_user_id,
        "is_anonymous": acting_user_id == 0,
        "permissions": {
            "read": False,
            "enroll": False,
            "work_on_content": False,
            "monitor": False,
        },
        "enrollment": {
            "is_enrolled": False,
        },
        "roles": {
            "is_admin": False,
            "is_student": False,
        },
    }

    try:
        await check_resource_access(request, db_session, current_user, course_uuid, AccessAction.READ)
        rights["permissions"]["read"] = True
    except HTTPException:
        return rights

    if acting_user_id == 0:
        return rights

    from src.security.rbac.rbac import authorization_verify_based_on_org_admin_status
    from src.services.trail.enrollment import is_user_enrolled_in_course

    is_admin = await authorization_verify_based_on_org_admin_status(
        request, acting_user_id, "read", course_uuid, db_session
    )
    is_enrolled = await is_user_enrolled_in_course(db_session, acting_user_id, course.id)

    rights["roles"]["is_admin"] = is_admin
    rights["roles"]["is_student"] = not is_admin
    rights["enrollment"]["is_enrolled"] = is_enrolled
    rights["permissions"]["monitor"] = is_admin
    rights["permissions"]["enroll"] = not is_enrolled
    rights["permissions"]["work_on_content"] = is_enrolled

    return rights
