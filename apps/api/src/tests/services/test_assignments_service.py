"""Tests for src/services/courses/activities/assignments.py (CRUD operations).

Covers the newly-async CRUD functions that were migrated from sync SQLModel
Session to AsyncSession in this PR:
  create_assignment, read_assignment, read_assignment_from_activity_uuid,
  update_assignment, delete_assignment, delete_assignment_from_activity_uuid,
  create_assignment_task, read_assignment_tasks, read_assignment_task,
  update_assignment_task, delete_assignment_task,
  handle_assignment_task_submission, read_assignment_submissions,
  read_user_assignment_submissions, read_user_assignment_submissions_me,
  update_assignment_submission, delete_assignment_submission,
  grade_assignment_submission, get_grade_assignment_submission,
  mark_activity_as_done_for_user, get_assignments_from_course,
  _block_api_tokens.
"""

from datetime import datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.courses.assignments import (Assignment, AssignmentRead, AssignmentTask, AssignmentTaskRead, AssignmentTaskSubmission, AssignmentTaskSubmissionRead, AssignmentTaskSubmissionUpdate, AssignmentTaskTypeEnum, AssignmentUserSubmission, AssignmentUserSubmissionRead, AssignmentUserSubmissionStatus, GradingTypeEnum)
from src.db.courses.certifications import CertificateUser, Certifications
from src.db.trail_runs import TrailRun
from src.db.trail_steps import TrailStep
from src.db.trails import Trail
from src.db.users import APITokenUser
from src.services.courses.activities.assignments import (_block_api_tokens, _check_number_answer, _is_assignment_past_due, create_assignment_submission, get_assignments_from_course, handle_assignment_task_submission, put_assignment_task_submission_file, read_assignment, read_assignment_from_activity_uuid, read_assignment_task, read_assignment_tasks, read_user_assignment_submissions, read_user_assignment_submissions_me, read_user_assignment_task_submissions_me, read_user_assignment_task_submissions_me_batch, retry_assignment_submission)

# ---------------------------------------------------------------------------
# Module-level patches applied to all tests
# ---------------------------------------------------------------------------

_PATCH_RBAC = "src.services.courses.activities.assignments.check_resource_access"
_PATCH_LIMITS = "src.services.courses.activities.assignments.check_limits_with_usage"
_PATCH_INCREASE = "src.services.courses.activities.assignments.increase_feature_usage"
_PATCH_DECREASE = "src.services.courses.activities.assignments.decrease_feature_usage"
_PATCH_AUTH_ROLES = (
    "src.services.courses.activities.assignments.authorization_verify_based_on_roles"
)
_PATCH_DISPATCH = "src.services.courses.activities.assignments.dispatch_webhooks"
_PATCH_TRACK = "src.services.courses.activities.assignments.track"
_PATCH_CERT = (
    "src.services.courses.activities.assignments."
    "check_course_completion_and_create_certificate"
)


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------


async def _make_trail(db, org_id, course_id, activity_id, user_id):
    trail = Trail(
        org_id=org_id,
        user_id=user_id,
        trail_uuid="trail_assign_test",
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(trail)
    await db.commit()
    await db.refresh(trail)
    run = TrailRun(
        trail_id=trail.id,
        course_id=course_id,
        org_id=org_id,
        user_id=user_id,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    step = TrailStep(
        complete=False,
        teacher_verified=False,
        grade="",
        trailrun_id=run.id,
        trail_id=trail.id,
        activity_id=activity_id,
        course_id=course_id,
        org_id=org_id,
        user_id=user_id,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )
    db.add(step)
    await db.commit()
    await db.refresh(step)
    return trail, run, step


# ---------------------------------------------------------------------------
# _block_api_tokens
# ---------------------------------------------------------------------------


class TestBlockApiTokens:
    def test_raises_403_for_api_token_user(self):
        token_user = APITokenUser(id=1, org_id=1)
        with pytest.raises(HTTPException) as exc:
            _block_api_tokens(token_user)
        assert exc.value.status_code == 403

    def test_passes_for_public_user(self, regular_user):
        _block_api_tokens(regular_user)  # should not raise


# ---------------------------------------------------------------------------
# create_assignment
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# read_assignment
# ---------------------------------------------------------------------------


class TestReadAssignment:
    async def test_raises_404_when_not_found(
        self, mock_request, db, admin_user
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock):
            with pytest.raises(HTTPException) as exc:
                await read_assignment(mock_request, "nonexistent", admin_user, db)
        assert exc.value.status_code == 404

    async def test_returns_assignment_read(
        self, mock_request, db, assignment, admin_user
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock):
            result = await read_assignment(
                mock_request, assignment.assignment_uuid, admin_user, db
            )
        assert isinstance(result, AssignmentRead)
        assert result.assignment_uuid == assignment.assignment_uuid


# ---------------------------------------------------------------------------
# read_assignment_from_activity_uuid
# ---------------------------------------------------------------------------


class TestReadAssignmentFromActivityUuid:
    async def test_raises_404_when_not_found(
        self, mock_request, db, admin_user
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock):
            with pytest.raises(HTTPException) as exc:
                await read_assignment_from_activity_uuid(
                    mock_request, "bad-uuid", admin_user, db
                )
        assert exc.value.status_code == 404

    async def test_returns_assignment_for_activity(
        self, mock_request, db, assignment, activity, admin_user
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock):
            result = await read_assignment_from_activity_uuid(
                mock_request, activity.activity_uuid, admin_user, db
            )
        assert isinstance(result, AssignmentRead)
        assert result.activity_uuid == activity.activity_uuid


# ---------------------------------------------------------------------------
# update_assignment
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# delete_assignment
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# delete_assignment_from_activity_uuid
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# create_assignment_task
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# read_assignment_tasks
# ---------------------------------------------------------------------------


class TestReadAssignmentTasks:
    async def test_raises_404_when_assignment_not_found(
        self, mock_request, db, admin_user
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock):
            with pytest.raises(HTTPException) as exc:
                await read_assignment_tasks(mock_request, "nonexistent", admin_user, db)
        assert exc.value.status_code == 404

    async def test_returns_task_list(
        self, mock_request, db, assignment, assignment_task, admin_user
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock):
            result = await read_assignment_tasks(
                mock_request, assignment.assignment_uuid, admin_user, db
            )
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0].assignment_task_uuid == assignment_task.assignment_task_uuid


# ---------------------------------------------------------------------------
# read_assignment_task
# ---------------------------------------------------------------------------


class TestReadAssignmentTask:
    async def test_raises_404_when_task_not_found(
        self, mock_request, db, admin_user
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock):
            with pytest.raises(HTTPException) as exc:
                await read_assignment_task(mock_request, "nonexistent", admin_user, db)
        assert exc.value.status_code == 404

    async def test_returns_task(
        self, mock_request, db, assignment_task, admin_user
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock):
            result = await read_assignment_task(
                mock_request, assignment_task.assignment_task_uuid, admin_user, db
            )
        assert isinstance(result, AssignmentTaskRead)
        assert result.assignment_task_uuid == assignment_task.assignment_task_uuid


# ---------------------------------------------------------------------------
# update_assignment_task
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# delete_assignment_task
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# handle_assignment_task_submission
# ---------------------------------------------------------------------------


class TestHandleAssignmentTaskSubmission:
    async def test_raises_404_when_task_not_found(
        self, mock_request, db, regular_user
    ):
        obj = AssignmentTaskSubmissionUpdate(
            task_submission={"answer": "x"},
        )
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=True):
            with pytest.raises(HTTPException) as exc:
                await handle_assignment_task_submission(
                    mock_request, "nonexistent", obj, regular_user, db
                )
        assert exc.value.status_code == 404

    async def test_creates_new_submission(
        self, mock_request, db, assignment_task, regular_user
    ):
        obj = AssignmentTaskSubmissionUpdate(
            task_submission={"answer": "hello"},
        )
        # First call: is_instructor check → False
        # Second call: enrollment check → True (user is enrolled)
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, side_effect=[False, True]):
            result = await handle_assignment_task_submission(
                mock_request, assignment_task.assignment_task_uuid, obj, regular_user, db
            )
        assert isinstance(result, AssignmentTaskSubmissionRead)

    async def test_updates_existing_submission(
        self, mock_request, db, assignment_task, task_submission, regular_user
    ):
        obj = AssignmentTaskSubmissionUpdate(
            task_submission={"answer": "updated"},
        )
        # is_instructor → False, enrollment → True
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, side_effect=[False, True]):
            result = await handle_assignment_task_submission(
                mock_request, assignment_task.assignment_task_uuid, obj, regular_user, db
            )
        assert isinstance(result, AssignmentTaskSubmissionRead)

    async def test_regular_user_cannot_self_assign_grade(
        self, mock_request, db, assignment_task, regular_user
    ):
        # SECURITY: a non-instructor submitting with a non-zero grade is
        # rejected — students cannot grade their own work.
        obj = AssignmentTaskSubmissionUpdate(
            task_submission={"answer": "x"},
            grade=50,
        )
        # is_instructor → False, enrollment → True
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, side_effect=[False, True]):
            with pytest.raises(HTTPException) as exc:
                await handle_assignment_task_submission(
                    mock_request, assignment_task.assignment_task_uuid, obj, regular_user, db
                )
        assert exc.value.status_code == 403
        assert "grade" in exc.value.detail.lower()

    async def test_instructor_autosave_with_zero_grade_saves_progress(
        self, mock_request, db, assignment_task, regular_user
    ):
        # An instructor taking their own course autosaves quiz answers through
        # this path with no target uuid. The quiz autosave sends grade=0 and
        # feedback="" — a placeholder, not a grade — and it must save, not raise
        # "the learner has no submission for it".
        obj = AssignmentTaskSubmissionUpdate(
            task_submission={"answer": "hello"},
            grade=0,
            task_submission_grade_feedback="",
        )
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=True):
            result = await handle_assignment_task_submission(
                mock_request, assignment_task.assignment_task_uuid, obj, regular_user, db
            )
        assert isinstance(result, AssignmentTaskSubmissionRead)

    async def test_instructor_real_grade_without_target_still_rejected(
        self, mock_request, db, assignment_task, regular_user
    ):
        # The integrity guard stays: a real grade with no target submission uuid
        # would otherwise write a phantom instructor-owned row while the learner's
        # grade never moves, so it must fail loudly.
        obj = AssignmentTaskSubmissionUpdate(
            task_submission={"answer": "x"},
            grade=80,
        )
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=True):
            with pytest.raises(HTTPException) as exc:
                await handle_assignment_task_submission(
                    mock_request, assignment_task.assignment_task_uuid, obj, regular_user, db
                )
        assert exc.value.status_code == 400
        assert "no submission" in exc.value.detail.lower()


# ---------------------------------------------------------------------------
# read_assignment_submissions
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# read_user_assignment_submissions
# ---------------------------------------------------------------------------


class TestReadUserAssignmentSubmissions:
    async def test_raises_404_when_assignment_not_found(
        self, mock_request, db, admin_user
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=True):
            with pytest.raises(HTTPException) as exc:
                await read_user_assignment_submissions(
                    mock_request, "nonexistent", 1, admin_user, db
                )
        assert exc.value.status_code == 404

    async def test_returns_user_submissions(
        self, mock_request, db, assignment, user_submission, admin_user, regular_user
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=True):
            result = await read_user_assignment_submissions(
                mock_request, assignment.assignment_uuid, regular_user.id, admin_user, db
            )
        assert isinstance(result, list)
        assert len(result) == 1


# ---------------------------------------------------------------------------
# read_user_assignment_submissions_me
# ---------------------------------------------------------------------------


class TestReadUserAssignmentSubmissionsMe:
    async def test_delegates_to_read_user_submissions(
        self, mock_request, db, assignment, user_submission, regular_user
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=False):
            result = await read_user_assignment_submissions_me(
                mock_request, assignment.assignment_uuid, regular_user, db
            )
        assert isinstance(result, list)


# ---------------------------------------------------------------------------
# update_assignment_submission
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# delete_assignment_submission
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# grade_assignment_submission
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# _apply_grade_and_finalize: manually_graded skip
# ---------------------------------------------------------------------------


class TestManuallyGradedSkipsVerification:
    """Regression guard for the per-task manual grading override.

    The aggregate grading pass runs server-side re-verification on
    SERVER_VERIFIED_TASK_TYPES (SHORT_ANSWER, NUMBER_ANSWER, QUIZ, FORM,
    CODE). When a teacher has manually graded a task, that verification
    must be skipped so the override survives.
    """

    async def _make_task_submission(
        self, db, assignment_task, regular_user, *, ts_id, uuid_suffix,
        grade, feedback, manually_graded, answer,
    ):
        ts = AssignmentTaskSubmission(
            id=ts_id,
            assignment_task_submission_uuid=f"ats_{uuid_suffix}",
            task_submission={"answer": answer},
            grade=grade,
            task_submission_grade_feedback=feedback,
            manually_graded=manually_graded,
            assignment_type=AssignmentTaskTypeEnum.SHORT_ANSWER,
            user_id=regular_user.id,
            activity_id=assignment_task.activity_id,
            course_id=assignment_task.course_id,
            chapter_id=assignment_task.chapter_id,
            assignment_task_id=assignment_task.id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db.add(ts)
        await db.commit()
        await db.refresh(ts)
        return ts


# ---------------------------------------------------------------------------
# get_grade_assignment_submission
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# mark_activity_as_done_for_user
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# get_assignments_from_course
# ---------------------------------------------------------------------------


class TestGetAssignmentsFromCourse:
    async def test_raises_404_when_course_not_found(
        self, mock_request, db, admin_user
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock):
            with pytest.raises(HTTPException) as exc:
                await get_assignments_from_course(mock_request, "nonexistent", admin_user, db)
        assert exc.value.status_code == 404

    async def test_returns_assignments_for_course(
        self, mock_request, db, course, assignment, admin_user
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock):
            result = await get_assignments_from_course(
                mock_request, course.course_uuid, admin_user, db
            )
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0].assignment_uuid == assignment.assignment_uuid


# ---------------------------------------------------------------------------
# put_assignment_task_reference_file
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# put_assignment_task_submission_file
# ---------------------------------------------------------------------------


class TestPutAssignmentTaskSubmissionFile:
    async def test_raises_404_when_task_not_found(self, mock_request, db, admin_user):
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=True):
            with pytest.raises(HTTPException) as exc:
                await put_assignment_task_submission_file(
                    mock_request, db, "nonexistent_task", admin_user, None
                )
        assert exc.value.status_code == 404

    async def test_returns_none_when_no_file(
        self, mock_request, db, admin_user, assignment_task
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=True):
            result = await put_assignment_task_submission_file(
                mock_request,
                db,
                assignment_task.assignment_task_uuid,
                admin_user,
                None,
            )
        assert result is None


# ---------------------------------------------------------------------------
# handle_assignment_task_submission — UUID fallback branch (line 1342)
# ---------------------------------------------------------------------------


class TestHandleAssignmentTaskSubmissionUuidBranch:
    async def test_finds_submission_by_uuid_when_user_task_not_found(
        self, mock_request, db, admin_user, assignment_task, task_submission
    ):
        """Covers the UUID-specific lookup branch.

        `task_submission` belongs to `regular_user` (id=2). Calling as `admin_user`
        (id=1) still updates the submission identified by UUID."""
        payload = AssignmentTaskSubmissionUpdate(
            assignment_task_submission_uuid=task_submission.assignment_task_submission_uuid,
            task_submission={"answer": "updated"},
        )
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=True):
            result = await handle_assignment_task_submission(
                mock_request,
                assignment_task.assignment_task_uuid,
                payload,
                admin_user,
                db,
            )
        assert result is not None

    async def test_explicit_uuid_updates_target_submission_when_submitter_has_own_row(
        self, mock_request, db, admin_user, assignment_task, task_submission
    ):
        admin_submission = AssignmentTaskSubmission(
            id=41,
            assignment_task_submission_uuid="ats_admin_same_task",
            task_submission={"answer": "admin original"},
            grade=0,
            task_submission_grade_feedback="",
            assignment_type=AssignmentTaskTypeEnum.SHORT_ANSWER,
            user_id=admin_user.id,
            activity_id=assignment_task.activity_id,
            course_id=assignment_task.course_id,
            chapter_id=assignment_task.chapter_id,
            assignment_task_id=assignment_task.id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db.add(admin_submission)
        await db.commit()

        payload = AssignmentTaskSubmissionUpdate(
            assignment_task_submission_uuid=task_submission.assignment_task_submission_uuid,
            task_submission={"answer": "teacher update for learner"},
        )
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=True):
            result = await handle_assignment_task_submission(
                mock_request,
                assignment_task.assignment_task_uuid,
                payload,
                admin_user,
                db,
            )

        await db.refresh(task_submission)
        await db.refresh(admin_submission)
        assert result.assignment_task_submission_uuid == task_submission.assignment_task_submission_uuid
        assert task_submission.task_submission == {"answer": "teacher update for learner"}
        assert admin_submission.task_submission == {"answer": "admin original"}

    async def test_uuid_lookup_is_scoped_to_route_task(
        self, mock_request, db, admin_user, assignment, assignment_task, task_submission
    ):
        other_task = AssignmentTask(
            id=21,
            title="Other task",
            description="A second task for scoping checks",
            hint="",
            reference_file=None,
            assignment_type=AssignmentTaskTypeEnum.SHORT_ANSWER,
            contents={"prompt": "What is 3+3?"},
            max_grade_value=100,
            assignment_id=assignment.id,
            org_id=assignment_task.org_id,
            course_id=assignment_task.course_id,
            chapter_id=assignment_task.chapter_id,
            activity_id=assignment_task.activity_id,
            assignment_task_uuid="assignmenttask_other",
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db.add(other_task)
        await db.commit()

        payload = AssignmentTaskSubmissionUpdate(
            assignment_task_submission_uuid=task_submission.assignment_task_submission_uuid,
            task_submission={"answer": "wrong task update"},
        )
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=True):
            with pytest.raises(HTTPException) as exc:
                await handle_assignment_task_submission(
                    mock_request,
                    other_task.assignment_task_uuid,
                    payload,
                    admin_user,
                    db,
                )

        await db.refresh(task_submission)
        assert exc.value.status_code == 404
        assert task_submission.task_submission == {"answer": "4"}


# ---------------------------------------------------------------------------
# read_user_assignment_task_submissions
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# read_user_assignment_task_submissions_me_batch
# ---------------------------------------------------------------------------


class TestReadUserAssignmentTaskSubmissionsMeBatch:
    async def test_raises_404_when_assignment_not_found(
        self, mock_request, db, admin_user
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock):
            with pytest.raises(HTTPException) as exc:
                await read_user_assignment_task_submissions_me_batch(
                    mock_request, "nonexistent", admin_user, db
                )
        assert exc.value.status_code == 404

    async def test_returns_batch_map(
        self, mock_request, db, admin_user, assignment, assignment_task
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock):
            result = await read_user_assignment_task_submissions_me_batch(
                mock_request, assignment.assignment_uuid, admin_user, db
            )
        assert isinstance(result, dict)
        assert assignment_task.assignment_task_uuid in result


# ---------------------------------------------------------------------------
# read_user_assignment_task_submissions_me
# ---------------------------------------------------------------------------


class TestReadUserAssignmentTaskSubmissionsMe:
    async def test_raises_404_when_task_not_found(self, mock_request, db, admin_user):
        with patch(_PATCH_RBAC, new_callable=AsyncMock):
            with pytest.raises(HTTPException) as exc:
                await read_user_assignment_task_submissions_me(
                    mock_request, "nonexistent", admin_user, db
                )
        assert exc.value.status_code == 404

    async def test_returns_none_when_no_submission(
        self, mock_request, db, admin_user, assignment_task
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock):
            result = await read_user_assignment_task_submissions_me(
                mock_request, assignment_task.assignment_task_uuid, admin_user, db
            )
        assert result is None

    async def test_returns_submission(
        self, mock_request, db, admin_user, regular_user, assignment_task, task_submission
    ):
        with patch(_PATCH_RBAC, new_callable=AsyncMock):
            result = await read_user_assignment_task_submissions_me(
                mock_request, assignment_task.assignment_task_uuid, regular_user, db
            )
        assert result is not None
        assert result.assignment_task_submission_uuid == task_submission.assignment_task_submission_uuid


# ---------------------------------------------------------------------------
# read_assignment_task_submissions
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# update_assignment_task_submission
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# delete_assignment_task_submission
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# create_assignment_submission — new TrailRun / TrailStep branches + auto_grading
# ---------------------------------------------------------------------------

_PATCH_TRAIL_PRESENCE = "src.services.courses.activities.assignments.check_trail_presence"
_PATCH_CERT_CHECK = (
    "src.services.courses.activities.assignments."
    "check_course_completion_and_create_certificate"
)
_PATCH_GRADE_FINALIZE = (
    "src.services.courses.activities.assignments._apply_grade_and_finalize"
)


class TestCreateAssignmentSubmission:
    async def test_creates_trailrun_and_trailstep_when_missing(
        self, mock_request, db, admin_user, assignment, course, activity
    ):
        """Covers lines 1915-1916 (new TrailRun) and 1940-1941 (new TrailStep)."""
        trail = Trail(
            org_id=course.org_id,
            user_id=admin_user.id,
            trail_uuid="trail_submit_test",
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db.add(trail)
        await db.commit()
        await db.refresh(trail)

        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_TRAIL_PRESENCE, new_callable=AsyncMock, return_value=trail), \
             patch(_PATCH_CERT, new_callable=AsyncMock), \
             patch(_PATCH_CERT_CHECK, new_callable=AsyncMock), \
             patch(_PATCH_TRACK, new_callable=AsyncMock), \
             patch(_PATCH_DISPATCH, new_callable=AsyncMock):
            result = await create_assignment_submission(
                mock_request,
                assignment.assignment_uuid,
                admin_user,
                db,
            )
        assert result.submission_status == AssignmentUserSubmissionStatus.SUBMITTED

    async def test_auto_grading_path(
        self, mock_request, db, admin_user, assignment, course, activity, assignment_task
    ):
        """Covers the auto_grading branch (lines 1967-1989)."""
        assignment.auto_grading = True
        db.add(assignment)
        await db.commit()

        trail = Trail(
            org_id=course.org_id,
            user_id=admin_user.id,
            trail_uuid="trail_autograding",
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db.add(trail)
        await db.commit()
        await db.refresh(trail)

        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_TRAIL_PRESENCE, new_callable=AsyncMock, return_value=trail), \
             patch(_PATCH_CERT, new_callable=AsyncMock), \
             patch(_PATCH_CERT_CHECK, new_callable=AsyncMock), \
             patch(_PATCH_TRACK, new_callable=AsyncMock), \
             patch(_PATCH_DISPATCH, new_callable=AsyncMock), \
             patch(_PATCH_GRADE_FINALIZE, new_callable=AsyncMock):
            result = await create_assignment_submission(
                mock_request,
                assignment.assignment_uuid,
                admin_user,
                db,
            )
        assert result.submission_status == AssignmentUserSubmissionStatus.SUBMITTED


# ---------------------------------------------------------------------------
# delete_assignment_submission — certification revocation branch (lines 2292-2297)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# _is_assignment_past_due (lines 85-93)
# ---------------------------------------------------------------------------


class TestIsAssignmentPastDue:
    def test_past_iso_date_returns_true(self):
        a = SimpleNamespace(due_date="2000-01-01")
        assert _is_assignment_past_due(a) is True

    def test_past_iso_datetime_returns_true(self):
        a = SimpleNamespace(due_date="2000-01-01T12:00:00")
        assert _is_assignment_past_due(a) is True

    def test_future_iso_date_returns_false(self):
        a = SimpleNamespace(due_date="2999-01-01")
        assert _is_assignment_past_due(a) is False

    def test_empty_string_returns_false(self):
        assert _is_assignment_past_due(SimpleNamespace(due_date="")) is False

    def test_whitespace_only_returns_false(self):
        assert _is_assignment_past_due(SimpleNamespace(due_date="   ")) is False

    def test_none_returns_false(self):
        assert _is_assignment_past_due(SimpleNamespace(due_date=None)) is False

    def test_missing_attribute_returns_false(self):
        assert _is_assignment_past_due(SimpleNamespace()) is False

    def test_garbage_string_returns_false(self):
        assert _is_assignment_past_due(SimpleNamespace(due_date="not-a-date")) is False

    def test_tz_aware_past_date_returns_true(self):
        # tz-aware ISO string in the distant past -> stripped to naive -> past
        a = SimpleNamespace(due_date="2000-01-01T00:00:00+00:00")
        assert _is_assignment_past_due(a) is True

    def test_due_today_date_only_returns_false(self):
        # A date-only deadline of "today" must remain submittable for the whole
        # day (date inputs have no time component) -> not past due.
        today = datetime.now().date().isoformat()
        a = SimpleNamespace(due_date=today)
        assert _is_assignment_past_due(a) is False

    def test_due_yesterday_date_only_returns_true(self):
        yesterday = (datetime.now() - timedelta(days=1)).date().isoformat()
        a = SimpleNamespace(due_date=yesterday)
        assert _is_assignment_past_due(a) is True

    def test_due_today_earlier_time_returns_true(self):
        # When an explicit past time-of-day is given for today, it IS past due.
        earlier = (datetime.now() - timedelta(hours=1)).replace(microsecond=0).isoformat()
        a = SimpleNamespace(due_date=earlier)
        assert _is_assignment_past_due(a) is True


# ---------------------------------------------------------------------------
# Due-date enforcement (lines 1338-1342 + 1857-1861)
# ---------------------------------------------------------------------------


class TestDueDateEnforcement:
    async def _set_due(self, db, assignment, due_date):
        assignment.due_date = due_date
        db.add(assignment)
        await db.commit()
        await db.refresh(assignment)

    async def test_handle_task_submission_non_instructor_past_due_raises_403(
        self, mock_request, db, assignment, assignment_task, regular_user
    ):
        await self._set_due(db, assignment, "2000-01-01")
        obj = AssignmentTaskSubmissionUpdate(task_submission={"answer": "x"})
        # is_instructor -> False, enrollment read -> True
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, side_effect=[False, True]):
            with pytest.raises(HTTPException) as exc:
                await handle_assignment_task_submission(
                    mock_request, assignment_task.assignment_task_uuid, obj, regular_user, db
                )
        assert exc.value.status_code == 403
        assert "deadline has passed" in exc.value.detail

    async def test_handle_task_submission_instructor_past_due_allowed(
        self, mock_request, db, assignment, assignment_task, admin_user
    ):
        await self._set_due(db, assignment, "2000-01-01")
        obj = AssignmentTaskSubmissionUpdate(task_submission={"answer": "x"})
        # is_instructor -> True bypasses the due-date check entirely
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=True):
            result = await handle_assignment_task_submission(
                mock_request, assignment_task.assignment_task_uuid, obj, admin_user, db
            )
        assert isinstance(result, AssignmentTaskSubmissionRead)

    async def test_create_submission_non_instructor_past_due_raises_403(
        self, mock_request, db, assignment, course, activity, regular_user
    ):
        await self._set_due(db, assignment, "2000-01-01")
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=False), \
             patch(_PATCH_TRACK, new_callable=AsyncMock), \
             patch(_PATCH_DISPATCH, new_callable=AsyncMock):
            with pytest.raises(HTTPException) as exc:
                await create_assignment_submission(
                    mock_request, assignment.assignment_uuid, regular_user, db
                )
        assert exc.value.status_code == 403
        assert "deadline has passed" in exc.value.detail

    async def test_create_submission_instructor_past_due_allowed(
        self, mock_request, db, assignment, course, activity, admin_user
    ):
        await self._set_due(db, assignment, "2000-01-01")
        trail = Trail(
            org_id=course.org_id,
            user_id=admin_user.id,
            trail_uuid="trail_pastdue_instructor",
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db.add(trail)
        await db.commit()
        await db.refresh(trail)
        # is_instructor -> True; due-date check skipped, submission proceeds
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_TRAIL_PRESENCE, new_callable=AsyncMock, return_value=trail), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=True), \
             patch(_PATCH_CERT, new_callable=AsyncMock), \
             patch(_PATCH_CERT_CHECK, new_callable=AsyncMock), \
             patch(_PATCH_TRACK, new_callable=AsyncMock), \
             patch(_PATCH_DISPATCH, new_callable=AsyncMock):
            result = await create_assignment_submission(
                mock_request, assignment.assignment_uuid, admin_user, db
            )
        assert result.submission_status == AssignmentUserSubmissionStatus.SUBMITTED

    async def test_create_submission_non_instructor_no_due_date_allowed(
        self, mock_request, db, assignment, course, activity, regular_user
    ):
        await self._set_due(db, assignment, "")
        trail = Trail(
            org_id=course.org_id,
            user_id=regular_user.id,
            trail_uuid="trail_nodue",
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db.add(trail)
        await db.commit()
        await db.refresh(trail)
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_TRAIL_PRESENCE, new_callable=AsyncMock, return_value=trail), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=False), \
             patch(_PATCH_CERT, new_callable=AsyncMock), \
             patch(_PATCH_CERT_CHECK, new_callable=AsyncMock), \
             patch(_PATCH_TRACK, new_callable=AsyncMock), \
             patch(_PATCH_DISPATCH, new_callable=AsyncMock):
            result = await create_assignment_submission(
                mock_request, assignment.assignment_uuid, regular_user, db
            )
        assert result.submission_status == AssignmentUserSubmissionStatus.SUBMITTED


# ---------------------------------------------------------------------------
# update_assignment_submission — protected-field stripping (lines 2252-2254)
# ---------------------------------------------------------------------------


class TestAssignmentIntegrityGuards:
    """Guards added after an audit found several ways to corrupt graded work."""

    async def _set_due(self, db, assignment, due_date):
        assignment.due_date = due_date
        db.add(assignment)
        await db.commit()
        await db.refresh(assignment)

    async def _user_submission(self, db, assignment, user, status):
        sub = AssignmentUserSubmission(
            assignment_id=assignment.id,
            user_id=user.id,
            assignmentusersubmission_uuid=f"assignmentusersubmission_{uuid4()}",
            submission_status=status,
            grade=0,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
        return sub

    async def test_learner_cannot_edit_answers_after_submitting(
        self, mock_request, db, assignment, assignment_task, regular_user
    ):
        """Answers freeze at hand-in.

        Otherwise a learner who has been shown the answer key (show_correct_answers
        reveals it post-grade) could replay the correct answers, and the next
        re-grade — which re-derives from the CURRENT stored answers — would score
        the tampered version.
        """
        await self._user_submission(
            db, assignment, regular_user, AssignmentUserSubmissionStatus.GRADED
        )
        obj = AssignmentTaskSubmissionUpdate(task_submission={"answer": "tampered"})
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, side_effect=[False, True]):
            with pytest.raises(HTTPException) as exc:
                await handle_assignment_task_submission(
                    mock_request, assignment_task.assignment_task_uuid, obj, regular_user, db
                )
        assert exc.value.status_code == 403
        assert "already been handed in" in exc.value.detail

    async def test_learner_can_still_edit_answers_while_pending(
        self, mock_request, db, assignment, assignment_task, regular_user
    ):
        """A PENDING row is an attempt in progress — saving must keep working."""
        await self._user_submission(
            db, assignment, regular_user, AssignmentUserSubmissionStatus.PENDING
        )
        obj = AssignmentTaskSubmissionUpdate(task_submission={"answer": "draft"})
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, side_effect=[False, True]):
            result = await handle_assignment_task_submission(
                mock_request, assignment_task.assignment_task_uuid, obj, regular_user, db
            )
        assert isinstance(result, AssignmentTaskSubmissionRead)

    async def test_instructor_grade_without_target_submission_is_rejected(
        self, mock_request, db, assignment_task, admin_user
    ):
        """Grading a task the learner never submitted used to write the grade to
        the INSTRUCTOR's own row, force it to 0, and report success."""
        obj = AssignmentTaskSubmissionUpdate(grade=8)
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=True):
            with pytest.raises(HTTPException) as exc:
                await handle_assignment_task_submission(
                    mock_request, assignment_task.assignment_task_uuid, obj, admin_user, db
                )
        assert exc.value.status_code == 400
        assert "no submission" in exc.value.detail

    async def test_instructor_answer_without_target_submission_still_allowed(
        self, mock_request, db, assignment_task, admin_user
    ):
        """An instructor taking their own course saves ANSWERS through the same
        path with no target uuid — the grade guard must not catch that."""
        obj = AssignmentTaskSubmissionUpdate(task_submission={"answer": "x"})
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=True):
            result = await handle_assignment_task_submission(
                mock_request, assignment_task.assignment_task_uuid, obj, admin_user, db
            )
        assert isinstance(result, AssignmentTaskSubmissionRead)

    async def test_retry_past_due_is_rejected(
        self, mock_request, db, assignment, course, regular_user
    ):
        """Retry wipes answers, grade, trail step and certificate. Past the
        deadline the learner can never resubmit, so this destroyed graded work."""
        assignment.allow_retries = True
        await self._set_due(db, assignment, "2000-01-01")
        await self._user_submission(
            db, assignment, regular_user, AssignmentUserSubmissionStatus.GRADED
        )
        with patch(_PATCH_RBAC, new_callable=AsyncMock), \
             patch(_PATCH_AUTH_ROLES, new_callable=AsyncMock, return_value=False):
            with pytest.raises(HTTPException) as exc:
                await retry_assignment_submission(
                    mock_request, assignment.assignment_uuid, regular_user, db
                )
        assert exc.value.status_code == 403
        assert "deadline has passed" in exc.value.detail


class TestNumberAnswerSignedThousands:
    """Signed thousands-grouped numbers were parsed as decimals."""

    def test_negative_grouped_integer_matches(self):
        assert _check_number_answer("-1,000", -1000, 0) is True

    def test_plus_signed_grouped_integer_matches(self):
        assert _check_number_answer("+1,000", 1000, 0) is True

    def test_negative_multi_group_matches(self):
        assert _check_number_answer("-1,234,567", -1234567, 0) is True

    def test_negative_grouped_decimal_matches(self):
        assert _check_number_answer("-1,000.50", -1000.5, 0) is True

    def test_european_decimal_still_parsed_as_decimal(self):
        """The disambiguation this regex feeds must not regress: a bare
        "3,14" is still a European decimal, not three-thousand-fourteen."""
        assert _check_number_answer("3,14", 3.14, 0) is True
