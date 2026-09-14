# 01: What is currently wrong

Audit of where StarLab still follows the classroom/LMS model. Each item says
how bad it is for the student-first product.

## 1. Assignments are teacher-graded homework

- `api/db/courses/assignments.py`: `Assignment` has `due_date`, `grading_type`
  (`ALPHABET`, `GPA_SCALE`, ...), `published`, and a per-user submission →
  teacher grading flow.
- Routes `api/routers/courses/assignments.py`:
  `GET/PUT/DELETE /assignments/{uuid}/submissions/{user_id}`,
  `POST /assignments/{uuid}/submissions/{user_id}/grade`. These are a gradebook.
- `FILE_SUBMISSION` / `CUSTOM` / `OTHER` tasks can't be auto-graded, so a
  student waits on a human.
- Web: `web/components/Objects/Activities/Assignment/AssignmentStudentActivity.tsx`
  shows due dates and grade state; authoring in
  `web/components/Objects/Modals/Activities/Create/NewActivityModal/AssignmentActivityModal.tsx`
  and `.../Assignments/EditAssignmentModal.tsx` lead with due date + grading type.
- Dash: `web/app/orgs/[orgslug]/dash/assignments/*` is a grading inbox
  (`EvaluateAssignment.tsx`).

**Severity: high.** This is the core practice/assessment loop, and it is shaped
around a teacher. *But the engine underneath is good* (see 04): quiz / short
answer / number / code tasks, `auto_grading`, `allow_retries`, `max_retries`,
`show_correct_answers`, `pass_threshold_percentage`, `ungraded`,
`solution_reveal`.

## 2. No lesson / practice / assessment distinction

- `api/db/courses/activities.py`: `ActivityTypeEnum` is a *media* type
  (`TYPE_VIDEO`, `TYPE_DOCUMENT`, `TYPE_DYNAMIC`, `TYPE_ASSIGNMENT`, ...). There
  is no notion of "this is a lesson", "this is practice", "this is the unit test".
- Chapters are just folders of activities.

**Severity: high.** Without a role per activity, the app can't build a learning
path, recommend "practice next", or compute mastery.

## 3. Progress is binary; mastery doesn't exist

- `api/db/trail_steps.py`: `TrailStep` = `complete: bool`, `teacher_verified`,
  `grade: str`. `teacher_verified` and `grade` are gradebook leftovers and are
  never meaningfully set by a student flow.
- `api/services/trail/trail.py::add_activity_to_trail` marks an activity done on
  visit/click, regardless of score.
- No mastery/proficiency concept anywhere in `api/` (grep confirms).
- `web/app/orgs/[orgslug]/(withmenu)/journey/page.tsx` and `skills/page.tsx` are
  **hardcoded mock data**, not a progress system.

**Severity: high** for the direction, but it's net-new, not a rewrite.

## 4. Discussions were being built as class forums

- `api/db/communities/`: `Community` (org-wide, optional `course_id`) →
  `Discussion` → comments/votes/reactions. A Discord-style forum list.
- Last session added an **enrollment gate** on course communities
  (`api/security/rbac/resource_access.py::_check_course_community_gate`): a student
  could read a lesson but got 403 on its discussion until they "joined the
  class". **Fixed 2026-09-14** (now gated on course read access).
- `api/services/communities/communities.py::get_community_user_rights` still
  reports `via_public`, which doesn't match the gate.
- Breadcrumbs in `web/app/orgs/[orgslug]/(withmenu)/community/[communityuuid]/*`
  still link to the removed `/communities` list.

**Severity: medium.** Tables are fine; the framing and entry point are wrong.

## 5. Boards are a classroom whiteboard tool

- `api/db/boards.py`: org-wide Yjs whiteboards, invite-only `BoardMember`
  (owner/editor/viewer, max 10). Role 4 can't create boards.
- Student route `web/app/orgs/[orgslug]/(withmenu)/boards`, admin
  `dash/boards`, collab server `apps/collab`.
- The cancelled plan wanted `board.course_id` for "class activities".

**Severity: low** (easy to hide), but nothing in the student learning loop
needs it.

## 6. Roles and usergroups still describe a school staff

- Seeded roles (`api/services/setup/setup.py`): Admin(1), Maintainer(2),
  **Instructor(3)**, User(4). "Instructor" implies someone teaching students.
- `ResourceAuthor` on a course is authorship, which is fine. It must not become
  "course staff who manage students".
- Usergroups + `lock_usergroups.py` lock courses to groups. Fine as an admin
  content-visibility tool; wrong if used as "class sections".

**Severity: low.** Mostly naming and intent. No schema change.

## 7. Admin dashboard mixes content studio, platform admin, and classroom tools

- `web/components/Dashboard/Menus/DashLeftMenu.tsx` top level: Home, Courses,
  **Assignments (grading inbox)**, Library, **Communities**, Podcasts, **Boards**,
  Playgrounds, Users, Developers.
- Boards/Communities/Assignments read as "run your class".

**Severity: medium.** Admin should read as **Content studio** + **Platform**.

## 8. Student surface leftovers

- Student nav (`web/components/Objects/Menus/OrgMenuLinks.tsx`) still includes
  `store` (payments) and relies on feature flags for podcasts/playgrounds.
- `/dashboard` is a redirect into the Learning Universe
  (`web/components/learning-universe/learning-universe.tsx`), which links to
  mock journey/skills. Out of scope until the dashboard phase.

## 9. Course read quirk: public-but-unpublished courses are readable

`resource_access.py::_check_public_view_read_access` Rule 4 lets any signed-in
user with `courses.read` (every student) read a course that is `public=True`
but `published=False`. Drafts leak into the student experience, and course Q&A
inherits the same rule. Fix in step 1 (03-C): Rule 4 should require
`is_published` for resources that have a published field. Check
`api/tests/security` for tests that depend on the old behavior first.

## What is NOT wrong (don't "fix" it)

- Course access is already open: `public` + `published` → readable by any
  signed-in student (`resource_access.py`). No roster gate exists. Keep it.
- Self-enrollment already exists: "Start course" → `POST /trail/add_course/{uuid}`
  creates a `TrailRun`. That *is* the student-first enrollment.
- Single org + student/admin account types (`progress.md`) are correct.
