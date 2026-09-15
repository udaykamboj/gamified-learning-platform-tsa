from typing import List
from fastapi import APIRouter, Depends, Request

from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.events.database import get_db_session
from src.db.courses.certifications import (
    CertificationRead,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user, get_authenticated_user
from src.services.courses.certifications import (
    get_certification,
    get_certifications_by_course,
    get_user_certificates_for_course,
    get_certificate_by_user_certification_uuid,
    get_all_user_certificates,
)

router = APIRouter()


@router.get(
    "/{certification_uuid}",
    response_model=CertificationRead,
    summary="Get certification",
    description="Get a single certification template by its UUID.",
    responses={
        200: {"description": "Certification details.", "model": CertificationRead},
        404: {"description": "Certification not found"},
    },
)
async def api_get_certification(
    request: Request,
    certification_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CertificationRead:
    """
    Get single certification by certification_id
    """
    return await get_certification(
        request, certification_uuid, current_user, db_session
    )


@router.get(
    "/course/{course_uuid}",
    response_model=List[CertificationRead],
    summary="List course certifications",
    description="Get all certification templates attached to a course.",
    responses={
        200: {"description": "List of certifications for the course."},
        404: {"description": "Course not found"},
    },
)
async def api_get_certifications_by_course(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> List[CertificationRead]:
    """
    Get all certifications for a specific course
    """
    return await get_certifications_by_course(
        request, course_uuid, current_user, db_session
    )


@router.get(
    "/user/course/{course_uuid}",
    summary="List my certificates for course",
    description="Get all certificates awarded to the current user for a specific course, including certification details.",
    responses={
        200: {"description": "List of the user's certificates for the course."},
        404: {"description": "Course not found"},
    },
)
async def api_get_user_certificates_for_course(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_authenticated_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> List[dict]:
    """
    Get all certificates for the current user in a specific course with certification details
    """
    return await get_user_certificates_for_course(
        request, course_uuid, current_user, db_session
    )


@router.get(
    "/certificate/{user_certification_uuid}",
    summary="Get awarded certificate",
    description="Get an awarded certificate by its user_certification UUID, with linked certification and course details.",
    responses={
        200: {"description": "Awarded certificate with linked certification and course."},
        404: {"description": "Certificate not found"},
    },
)
async def api_get_certificate_by_user_certification_uuid(
    request: Request,
    user_certification_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict:
    """
    Get a certificate by user_certification_uuid with certification and course details
    """
    return await get_certificate_by_user_certification_uuid(
        request, user_certification_uuid, current_user, db_session
    )


@router.get(
    "/user/all",
    summary="List my certificates",
    description="Get every certificate awarded to the current user across all courses, with complete linked information.",
    responses={
        200: {"description": "All certificates awarded to the current user."},
    },
)
async def api_get_all_user_certificates(
    request: Request,
    current_user: PublicUser = Depends(get_authenticated_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> List[dict]:
    """
    Get all certificates obtained by the current user with complete linked information
    """
    return await get_all_user_certificates(
        request, current_user, db_session
    ) 