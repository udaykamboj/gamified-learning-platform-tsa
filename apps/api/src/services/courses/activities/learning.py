"""
Learning roles: what an activity is for in the student's learning path.

    lesson      learn it (video, page, document). Complete when the student marks it done.
    practice    try it (assignment engine, formative). Complete once the best attempt passes.
    assessment  prove it, e.g. a unit test (assignment engine). Complete once the best attempt passes.

The role lives in ``Activity.details["learning_role"]`` (no migration). Only
assignment activities can be practice or assessment; everything else is a
lesson. An assignment activity with no role is practice.

See docs/refactor/02-target-architecture.md.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.courses.activities import ActivityTypeEnum
from src.db.courses.assignments import GradingTypeEnum, SolutionRevealEnum
from src.db.trail_steps import TrailStep

LEARNING_ROLE_KEY = "learning_role"


class LearningRole(str, Enum):
    LESSON = "lesson"
    PRACTICE = "practice"
    ASSESSMENT = "assessment"


SCORED_ROLES = (LearningRole.PRACTICE, LearningRole.ASSESSMENT)


def _type_value(activity_type: Any) -> str:
    return getattr(activity_type, "value", activity_type) or ""


def get_learning_role(activity: Any) -> LearningRole:
    """The activity's role, falling back to the rule above when unset or invalid."""
    if _type_value(getattr(activity, "activity_type", None)) != ActivityTypeEnum.TYPE_ASSIGNMENT.value:
        return LearningRole.LESSON
    details = getattr(activity, "details", None) or {}
    raw = details.get(LEARNING_ROLE_KEY) if isinstance(details, dict) else None
    if raw in (LearningRole.PRACTICE.value, LearningRole.ASSESSMENT.value):
        return LearningRole(raw)
    return LearningRole.PRACTICE


# Defaults applied to a new practice/assessment assignment. FORCED fields keep
# the learning loop intact (instant score, unlimited tries, no deadline, no
# letter grades); SOFT fields only fill in what the author didn't send.
_FORCED = {
    "allow_retries": True,
    "due_date": None,
    "grading_type": GradingTypeEnum.PERCENTAGE,
}
_SOFT = {
    LearningRole.PRACTICE: {
        "max_retries": 0,
        "show_correct_answers": True,
        "solution_reveal": SolutionRevealEnum.ON_SUBMISSION,
        "pass_threshold_percentage": 70.0,
    },
    LearningRole.ASSESSMENT: {
        "max_retries": 0,
        "show_correct_answers": True,
        "solution_reveal": SolutionRevealEnum.AFTER_GRADING,
        "pass_threshold_percentage": 80.0,
    },
}


def attempt_passed_before(trailstep: Optional[TrailStep]) -> bool:
    data = (trailstep.data or {}) if trailstep is not None else {}
    return bool(data.get("passed"))


async def record_graded_attempt(
    db_session: AsyncSession,
    *,
    activity_id: int,
    user_id: int,
    percentage: float,
    passed: bool,
    attempt_number: int,
) -> Optional[TrailStep]:
    """
    Fold a graded attempt into the student's progress for the activity.

    Keeps the best score, and completes the activity once any attempt has
    passed. Passing sticks: a later, lower attempt never un-completes it.
    Returns the step, or None if the student has no step for this activity.
    """
    trailstep = (
        await db_session.execute(
            select(TrailStep).where(
                TrailStep.activity_id == activity_id, TrailStep.user_id == user_id
            )
        )
    ).scalars().first()
    if trailstep is None:
        return None

    data = dict(trailstep.data or {})
    best = data.get("best_score")
    data["last_score"] = percentage
    data["best_score"] = percentage if best is None else max(float(best), percentage)
    data["attempts"] = max(int(data.get("attempts") or 0), int(attempt_number or 1))
    data["passed"] = bool(data.get("passed")) or bool(passed)

    # Assign a new dict so SQLAlchemy sees the JSON column change.
    trailstep.data = data
    trailstep.complete = data["passed"]
    trailstep.update_date = str(datetime.now())
    db_session.add(trailstep)
    await db_session.commit()
    await db_session.refresh(trailstep)
    return trailstep


