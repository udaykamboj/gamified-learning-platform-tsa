
from fastapi import APIRouter, Depends, Request, UploadFile, HTTPException
from src.db.courses.assignments import (
    AssignmentRead,
    AssignmentTaskSubmissionUpdate,
)
from src.db.users import PublicUser
from src.core.events.database import get_db_session
from src.security.auth import get_current_user
from src.services.courses.activities.assignments import (
    create_assignment_submission,
    get_assignments_from_course,
    handle_assignment_task_submission,
    put_assignment_task_submission_file,
    read_assignment,
    read_assignment_from_activity_uuid,
    read_assignment_task,
    read_assignment_tasks,
    read_user_assignment_submissions_me,
    read_user_assignment_task_submissions_me,
    read_user_assignment_task_submissions_me_batch,
    retry_assignment_submission,
)


router = APIRouter()

## ASSIGNMENTS ##


@router.get(
    "/{assignment_uuid}",
    response_model=AssignmentRead,
    summary="Get assignment",
    description="Read an assignment by its UUID.",
    responses={
        200: {"description": "Assignment returned.", "model": AssignmentRead},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this assignment"},
        404: {"description": "Assignment not found"},
    },
)
async def api_read_assignment(
    request: Request,
    assignment_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> AssignmentRead:
    """
    Read an assignment
    """
    return await read_assignment(request, assignment_uuid, current_user, db_session)


@router.get(
    "/activity/{activity_uuid}",
    response_model=AssignmentRead,
    summary="Get assignment by activity",
    description="Read the assignment attached to a given activity UUID.",
    responses={
        200: {"description": "Assignment returned.", "model": AssignmentRead},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this assignment"},
        404: {"description": "Activity or assignment not found"},
    },
)
async def api_read_assignment_from_activity(
    request: Request,
    activity_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> AssignmentRead:
    """
    Read an assignment
    """
    return await read_assignment_from_activity_uuid(
        request, activity_uuid, current_user, db_session
    )


## ASSIGNMENTS Tasks ##


@router.get(
    "/{assignment_uuid}/tasks",
    summary="List assignment tasks",
    description="Read all tasks for the given assignment.",
    responses={
        200: {"description": "List of assignment tasks."},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this assignment"},
        404: {"description": "Assignment not found"},
    },
)
async def api_read_assignment_tasks(
    request: Request,
    assignment_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """
    Read tasks for an assignment
    """
    return await read_assignment_tasks(
        request, assignment_uuid, current_user, db_session
    )


@router.get(
    "/task/{assignment_task_uuid}",
    summary="Get assignment task",
    description="Read a single assignment task by its UUID.",
    responses={
        200: {"description": "Assignment task returned."},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this task"},
        404: {"description": "Assignment task not found"},
    },
)
async def api_read_assignment_task(
    request: Request,
    assignment_task_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """
    Read task for an assignment
    """
    return await read_assignment_task(
        request, assignment_task_uuid, current_user, db_session
    )


@router.post(
    "/{assignment_uuid}/tasks/{assignment_task_uuid}/sub_file",
    summary="Upload task submission file",
    description="Upload or replace the submission file for an assignment task on behalf of the current user.",
    responses={
        200: {"description": "Submission file stored."},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to submit to this task"},
        404: {"description": "Assignment task not found"},
    },
)
async def api_put_assignment_task_sub_file(
    request: Request,
    assignment_task_uuid: str,
    sub_file: UploadFile | None = None,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """
    Update tasks for an assignment
    """
    return await put_assignment_task_submission_file(
        request, db_session, assignment_task_uuid, current_user, sub_file
    )


## ASSIGNMENTS Tasks Submissions ##


@router.put(
    "/{assignment_uuid}/tasks/{assignment_task_uuid}/submissions",
    summary="Upsert assignment task submission",
    description="Create or update the current user's submission for an assignment task.",
    responses={
        200: {"description": "Task submission stored."},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to submit to this task"},
        404: {"description": "Assignment task not found"},
    },
)
async def api_handle_assignment_task_submissions(
    request: Request,
    assignment_task_submission_object: AssignmentTaskSubmissionUpdate,
    assignment_task_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """
    Create new task submissions for an assignment.
    """
    return await handle_assignment_task_submission(
        request,
        assignment_task_uuid,
        assignment_task_submission_object,
        current_user,
        db_session,
    )


@router.get(
    "/{assignment_uuid}/tasks/submissions/me",
    summary="Batch read current user's task submissions",
    description="Read all current-user task submissions for an assignment in one round trip. Returns a map keyed by assignment_task_uuid (value is null if no submission). Registered before the per-task variant so the literal submissions path segment isn't shadowed.",
    responses={
        200: {"description": "Map of task_uuid -> submission (or null)."},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this assignment"},
        404: {"description": "Assignment not found"},
    },
)
async def api_read_user_assignment_task_submissions_me_batch(
    request: Request,
    assignment_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """
    Read all current-user task submissions for an assignment in one round trip.
    Returns a map keyed by assignment_task_uuid (value is null if no submission).
    Registered before the per-task variant so the literal `submissions` path
    segment isn't shadowed by `{assignment_task_uuid}`.
    """
    return await read_user_assignment_task_submissions_me_batch(
        request, assignment_uuid, current_user, db_session
    )


@router.get(
    "/{assignment_uuid}/tasks/{assignment_task_uuid}/submissions/me",
    summary="Get current user's task submission",
    description="Read the current user's submission for a specific assignment task. Returns 404 if the user has no submission yet.",
    responses={
        200: {"description": "Current user's task submission."},
        401: {"description": "Authentication required"},
        404: {"description": "Assignment Task Submission not found"},
    },
)
async def api_read_user_assignment_task_submissions_me(
    request: Request,
    assignment_task_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """
    Read task submissions for an assignment from a user
    """
    result = await read_user_assignment_task_submissions_me(
        request, assignment_task_uuid, current_user, db_session
    )
    if result is None:
        # Return 404 if no submission exists (maintains current frontend behavior)
        raise HTTPException(
            status_code=404,
            detail="Assignment Task Submission not found",
        )
    return result


## ASSIGNMENTS Submissions ##


@router.post(
    "/{assignment_uuid}/submissions",
    summary="Create assignment submission",
    description="Create a new assignment-level submission for the current user on the given assignment.",
    responses={
        200: {"description": "Assignment submission created."},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to submit to this assignment"},
        404: {"description": "Assignment not found"},
    },
)
async def api_create_assignment_submissions(
    request: Request,
    assignment_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """
    Hand in the current student's work. Auto-grading scores it on submit.
    """
    return await create_assignment_submission(
        request, assignment_uuid, current_user, db_session,
    )


@router.get(
    "/{assignment_uuid}/submissions/me",
    summary="Get current user's assignment submission",
    description="Read the current user's assignment-level submission for the given assignment.",
    responses={
        200: {"description": "Current user's assignment submission."},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this assignment"},
        404: {"description": "Assignment or submission not found"},
    },
)
async def api_read_user_assignment_submission_me(
    request: Request,
    assignment_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """
    Read submissions for an assignment from the current user
    """
    return await read_user_assignment_submissions_me(
        request, assignment_uuid, current_user, db_session
    )


@router.post(
    "/{assignment_uuid}/submissions/me/retry",
    summary="Retry assignment for current user",
    description=(
        "Reset the current user's submission so they can attempt the "
        "assignment again. Only allowed when the assignment has "
        "allow_retries=true, the existing submission is in GRADED state, "
        "and the attempt counter is still below max_retries (0 means "
        "unlimited). Wipes per-task submissions, resets the trail step, "
        "and revokes any course certificate."
    ),
    responses={
        200: {"description": "Submission reset; returns the new attempt info."},
        400: {"description": "Submission is not in a retryable state"},
        401: {"description": "Authentication required"},
        403: {"description": "Retries disabled or attempt limit reached"},
        404: {"description": "Assignment or submission not found"},
    },
)
async def api_retry_assignment_submission(
    request: Request,
    assignment_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """
    Reset the current user's submission so they can re-attempt the
    assignment. Strictly self-service — instructors who want to force a
    retry should reject the submission via the existing delete endpoint.
    """
    return await retry_assignment_submission(
        request, assignment_uuid, current_user, db_session
    )


@router.get(
    "/course/{course_uuid}",
    summary="List course assignments",
    description="Get all assignments attached to activities within the given course.",
    responses={
        200: {"description": "List of assignments for the course."},
        401: {"description": "Authentication required"},
        403: {"description": "User lacks permission to view this course"},
        404: {"description": "Course not found"},
    },
)
async def api_get_assignments(
    request: Request,
    course_uuid: str,
    current_user: PublicUser = Depends(get_current_user),
    db_session=Depends(get_db_session),
):
    """
    Get assignments for a course
    """
    return await get_assignments_from_course(
        request, course_uuid, current_user, db_session
    )
