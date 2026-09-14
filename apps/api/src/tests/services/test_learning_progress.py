"""
Learning roles and score-based completion (docs/refactor/02-target-architecture.md).

A practice set or unit test completes when an attempt passes, keeps the best
score, and stays complete through later retries.
"""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlmodel import select

from src.db.courses.activities import ActivityTypeEnum, ActivitySubTypeEnum
from src.db.courses.assignments import (
    Assignment,
    AssignmentCreate,
    AssignmentTask,
    AssignmentTaskSubmission,
    AssignmentTaskTypeEnum,
    GradingTypeEnum,
    SolutionRevealEnum,
)
from src.db.trail_steps import TrailStep
from src.services.courses.activities.assignments import (
    _apply_grade_and_finalize,
    create_assignment,
    create_assignment_submission,
    retry_assignment_submission,
)
from src.services.courses.activities.learning import (
    LearningRole,
    get_learning_role,
    validate_learning_role,
)
from src.services.trail.trail import add_activity_to_trail

_A = "src.services.courses.activities.assignments."


@pytest.fixture
async def assignment_activity(db, activity):
    activity.activity_type = ActivityTypeEnum.TYPE_ASSIGNMENT
    activity.activity_sub_type = ActivitySubTypeEnum.SUBTYPE_ASSIGNMENT_ANY
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return activity


async def _practice_set(db, org, course, chapter, activity, *, auto_grading=True):
    assignment = Assignment(
        title="Practice", description="x", published=True,
        grading_type=GradingTypeEnum.PERCENTAGE, auto_grading=auto_grading,
        allow_retries=True, max_retries=0, pass_threshold_percentage=70,
        org_id=org.id, course_id=course.id, chapter_id=chapter.id, activity_id=activity.id,
        assignment_uuid="assignment_practice",
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    task = AssignmentTask(
        title="Q1", description="2+2?", hint="", reference_file=None,
        assignment_type=AssignmentTaskTypeEnum.SHORT_ANSWER,
        contents={"correct_answers": ["4"], "match_mode": "exact"},
        max_grade_value=100, assignment_id=assignment.id, org_id=org.id,
        course_id=course.id, chapter_id=chapter.id, activity_id=activity.id,
        assignment_task_uuid="assignmenttask_practice",
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return assignment, task


async def _answer(db, task, user_id, answer, n):
    db.add(AssignmentTaskSubmission(
        assignment_task_submission_uuid=f"ats_practice_{n}",
        task_submission={"answer": answer}, grade=0, manually_graded=False,
        task_submission_grade_feedback="", assignment_type=task.assignment_type,
        user_id=user_id, activity_id=task.activity_id, course_id=task.course_id,
        chapter_id=task.chapter_id, assignment_task_id=task.id,
        creation_date=str(datetime.now()), update_date=str(datetime.now()),
    ))
    await db.commit()


async def _step(db, activity, user):
    step = (await db.execute(
        select(TrailStep).where(TrailStep.activity_id == activity.id, TrailStep.user_id == user.id)
    )).scalars().first()
    await db.refresh(step)
    return step


def _submit_patches():
    return (
        patch(_A + "check_resource_access", new_callable=AsyncMock),
        patch(_A + "authorization_verify_based_on_roles", new_callable=AsyncMock, return_value=False),
        patch(_A + "track", new_callable=AsyncMock),
        patch(_A + "dispatch_webhooks", new_callable=AsyncMock),
        patch(_A + "check_course_completion_and_create_certificate", new_callable=AsyncMock),
    )


class TestLearningRole:
    def test_defaults(self, activity):
        assert get_learning_role(activity) == LearningRole.LESSON
        activity.activity_type = ActivityTypeEnum.TYPE_ASSIGNMENT
        assert get_learning_role(activity) == LearningRole.PRACTICE
        activity.details = {"learning_role": "assessment"}
        assert get_learning_role(activity) == LearningRole.ASSESSMENT

    def test_validation(self):
        validate_learning_role(ActivityTypeEnum.TYPE_ASSIGNMENT, {"learning_role": "assessment"})
        validate_learning_role(ActivityTypeEnum.TYPE_VIDEO, {"learning_role": "lesson"})
        validate_learning_role(ActivityTypeEnum.TYPE_VIDEO, None)
        for activity_type, role in [
            (ActivityTypeEnum.TYPE_VIDEO, "practice"),
            (ActivityTypeEnum.TYPE_ASSIGNMENT, "lesson"),
            (ActivityTypeEnum.TYPE_ASSIGNMENT, "homework"),
        ]:
            with pytest.raises(HTTPException) as exc:
                validate_learning_role(activity_type, {"learning_role": role})
            assert exc.value.status_code == 400


class TestPresets:
    async def test_unit_test_preset_applied_on_create(
        self, db, mock_request, admin_user, org, course, chapter, assignment_activity
    ):
        assignment_activity.details = {"learning_role": "assessment"}
        db.add(assignment_activity)
        await db.commit()
        with patch(_A + "authorize_assignment_access", new_callable=AsyncMock), \
             patch(_A + "check_limits_with_usage"), \
             patch(_A + "increase_feature_usage", new_callable=AsyncMock):
            created = await create_assignment(
                mock_request,
                AssignmentCreate(
                    title="Unit 1 test", description="x", due_date="2030-01-01",
                    grading_type=GradingTypeEnum.ALPHABET, auto_grading=False,
                    pass_threshold_percentage=90,
                    org_id=org.id, course_id=course.id, chapter_id=chapter.id,
                    activity_id=assignment_activity.id,
                ),
                admin_user,
                db,
            )
        # Forced: instant score, unlimited tries, no deadline, no letter grades.
        assert created.auto_grading is True
        assert created.allow_retries is True
        assert created.due_date is None
        assert created.grading_type == GradingTypeEnum.PERCENTAGE
        # Soft: the author's explicit threshold wins, unset fields get defaults.
        assert created.pass_threshold_percentage == 90
        assert created.solution_reveal == SolutionRevealEnum.AFTER_GRADING
        assert created.show_correct_answers is True


class TestScoreBasedCompletion:
    async def test_fail_then_pass_then_retry_keeps_completion(
        self, db, mock_request, org, course, chapter, assignment_activity, regular_user
    ):
        assignment, task = await _practice_set(db, org, course, chapter, assignment_activity)
        rbac, roles, track, webhooks, cert = _submit_patches()

        # Attempt 1: wrong answer -> graded 0%, not complete.
        await _answer(db, task, regular_user.id, "5", 1)
        with rbac, roles, track, webhooks, cert:
            await create_assignment_submission(mock_request, assignment.assignment_uuid, regular_user, db)
        step = await _step(db, assignment_activity, regular_user)
        assert step.complete is False
        assert step.data["best_score"] == 0

        # Attempt 2: right answer -> passes, complete.
        rbac, roles, track, webhooks, cert = _submit_patches()
        with rbac:
            await retry_assignment_submission(mock_request, assignment.assignment_uuid, regular_user, db)
        await _answer(db, task, regular_user.id, "4", 2)
        with rbac, roles, track, webhooks, cert:
            await create_assignment_submission(mock_request, assignment.assignment_uuid, regular_user, db)
        step = await _step(db, assignment_activity, regular_user)
        assert step.complete is True
        assert step.data["best_score"] == 100
        assert step.data["passed"] is True

        # Retrying after passing keeps completion and the certificate.
        rbac, roles, track, webhooks, cert = _submit_patches()
        with rbac, patch(_A + "revoke_user_certificate", new_callable=AsyncMock) as revoke:
            await retry_assignment_submission(mock_request, assignment.assignment_uuid, regular_user, db)
        revoke.assert_not_called()
        assert (await _step(db, assignment_activity, regular_user)).complete is True

        # Attempt 3: wrong again -> still complete, best score kept.
        await _answer(db, task, regular_user.id, "5", 3)
        with rbac, roles, track, webhooks, cert:
            await create_assignment_submission(mock_request, assignment.assignment_uuid, regular_user, db)
        step = await _step(db, assignment_activity, regular_user)
        assert step.complete is True
        assert step.data["best_score"] == 100
        assert step.data["last_score"] == 0
        assert step.data["attempts"] == 3

    async def test_manual_grade_completes_activity(
        self, db, mock_request, org, course, chapter, assignment_activity, regular_user
    ):
        # Not auto-graded: hand-in leaves it incomplete, the admin's grade completes it.
        assignment, task = await _practice_set(
            db, org, course, chapter, assignment_activity, auto_grading=False
        )
        await _answer(db, task, regular_user.id, "4", 1)
        rbac, roles, track, webhooks, cert = _submit_patches()
        with rbac, roles, track, webhooks, cert:
            submission = await create_assignment_submission(
                mock_request, assignment.assignment_uuid, regular_user, db
            )
        assert (await _step(db, assignment_activity, regular_user)).complete is False

        from src.db.courses.assignments import AssignmentUserSubmission

        row = (await db.execute(
            select(AssignmentUserSubmission).where(AssignmentUserSubmission.id == submission.id)
        )).scalars().first()
        with patch(_A + "dispatch_webhooks", new_callable=AsyncMock):
            await _apply_grade_and_finalize(
                assignment=assignment, course=course, user_id=regular_user.id,
                assignment_user_submission=row, db_session=db, auto_graded=False,
            )
        step = await _step(db, assignment_activity, regular_user)
        assert step.complete is True
        assert step.data["best_score"] == 100

    async def test_cannot_mark_practice_done_by_hand(
        self, db, mock_request, assignment_activity, regular_user
    ):
        with patch("src.services.trail.trail.check_resource_access", new_callable=AsyncMock):
            with pytest.raises(HTTPException) as exc:
                await add_activity_to_trail(
                    mock_request, regular_user, assignment_activity.activity_uuid, db
                )
        assert exc.value.status_code == 400
