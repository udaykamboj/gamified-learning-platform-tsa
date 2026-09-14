# 05: Implementation order

Audit → specs → **foundation** → dashboard → gamification. Each step lists the
03 sections it covers and how to know it's done. Hand an agent one step at a
time: "Implement step 2 of `docs/refactor/05-implementation-order.md`."

## Step 0: Direction reset ✅ (2026-09-14)

- These docs. Old Canvas specs removed.
- Discussion gate reversed to course-read access (03-A).
- Boards hidden from students and admin nav (03-B). Store removed from student nav (03-I).

## Step 1: Q&A cleanup and admin separation (03-A remaining, 03-H, 03-G) ✅ mostly (2026-09-14)

Open: Instructor relabel (blocked on migration heads, see 03-G), org-settings usage/danger tabs, web unit tests not run.

Small, mostly UI; unblocks a clean product before deeper work.

- Auto-create course community on course create + backfill CLI.
- Fix `get_community_user_rights` and community breadcrumbs.
- Group dash sidebar (Content / Community / People / Insights); rename
  Communities → Q&A moderation; relabel Instructor → Content creator.
- Payments/domains/SSO redirects + router unmount.
- Close the unpublished-course read leak (03-C).

**Done when:** every course has a Q&A space; a signed-in student can read and
post on any readable course's Q&A without starting it; admin sidebar has no
classroom tools; `admin-authorization-denial.test.mjs` passes.

## Step 2: Learning roles + practice/assessment presets (03-D, 03-E)

The core loop. No migration.

- `learning_role` helper + authoring picker.
- Presets applied on create; authoring and student views drop due dates/grades.
- Practice/assessment completion moves from "visited" to "best score ≥ threshold",
  with `best_score`/`attempts` in `TrailStep.data`.

**Done when:** an admin creates Unit 1 with a lesson, a practice set, and a
unit test in the course editor; a student opens the course from the catalog,
finishes the lesson, fails then passes practice with instant feedback, passes
the unit test; `GET /trail/` shows the right completed steps and scores. No
screen shows a due date, a letter grade, or waits on a human.

## Step 3: Mastery service (03-F)

- `api/services/trail/mastery.py` + `GET /trail/course/{course_uuid}/mastery`.
- Tests for thresholds and unit-test promotion.

**Done when:** the endpoint returns per-activity levels and per-unit/course
percentages that match the step-2 scenario.

## Step 4: Student dashboard (separate spec, not written yet)

Reads `GET /trail/` (my courses + progress) and the mastery endpoint. Replaces
the mock `journey/` and `skills/` data. Write its spec after step 3 lands.

## Step 5: Gamification (separate spec, not written yet)

XP, streaks, badges hooked onto `ACTIVITY_COMPLETED`, attempt graded, mastery
level-up, `COURSE_COMPLETED`.

## Guardrails for every step

- No roster, class, section, due date, or teacher-grading dependency in a
  student flow.
- No "must be enrolled" access checks on content or Q&A.
- Prefer JSON fields already on the model over migrations until a query needs
  a column.
- Log each finished step in `progress.md`.
- Test runs: targeted suites only (`api/tests/security`, the files you touched).
