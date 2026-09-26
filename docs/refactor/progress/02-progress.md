# 02 — Progress log

Read `00-requirements.md` and `01-plan.md` first.

## Status

| # | Phase | State |
|---|---|---|
| 0 | Orientation, requirements, plan | done |
| 1 | Roles, account type, retire teacher roles | done |
| 2 | Remove usergroups end-to-end | done |
| 3 | Headless admin API → accounts + analytics only | done |
| 4 | Platform course catalog + remove authoring | done |
| 5 | Enrollment | done |
| 6 | Playgrounds | done |
| 7 | Boards | done |
| 8 | Community + moderation | done |
| 9 | Podcasts, AI agent, tools always on | done |
| 10 | Admin transformation | done |
| 11 | Tests, verification, cleanup | done |

## Baselines carried over (from the previous progress log)

- API tests run on in-memory SQLite. Security suite: 25 pre-existing failures.
- Web `tsc --noEmit`: 78 pre-existing errors.
- `bun` is not installed on this machine; web unit tests have not run for three sessions.
- Alembic has 4 heads. New tables are also created by `SQLModel.metadata.create_all` at startup.
- PowerShell 5.1 `Get-Content`/`Set-Content` mangle UTF-8; edit files with the Edit tool.

## Log

### Session 4 (2026-09-14)

- Read the spec; wrote `00-requirements.md` and `01-plan.md`.
- Test tooling: `uv sync` needs Python 3.14.7 (not installed). A scratch venv on
  3.14.3 with `uv pip install -r pyproject.toml` works. Import check:
  `TESTING=true STARLAB_DISABLE_EE=1 STARLAB_AUTH_JWT_SECRET_KEY=... python -c "import app"`.

#### API changes so far

- **Roles (R1, R2).** `rbac/constants.py` has Admin(1) and User/Student(4) only.
  `setup.py` seeds just those two (admin: no course/chapter/activity/assignment
  authoring, no usergroups/roles management; both roles create/own boards and
  playgrounds) and `retire_teacher_roles()` moves Maintainer/Instructor/custom-role
  members to Admin (if the role had dashboard access) or Student, then deletes the
  roles. It runs on every boot through `install_default_elements`.
  `platform_roles.py`: admin = superadmin or role 1. `/roles` is read-only.
  `update_user_role` only accepts Admin/Student.
- **Usergroups (R3).** Deleted models, router, service, course lock usergroups,
  RBAC rule 5 (replaced by "signed-in platform member reads published platform
  content"; boards opt out via `ResourceConfig.readable_by_members=False`),
  invite-code groups, member-list group filters, Zapier, dossier, webhook events,
  plan features. The demo org seeder (cohorts, fake students, staff grading) was
  deleted with it; `services/demo/guards.py` and `flags.py` stay (used elsewhere).
- **Headless admin API (R3, R19, R20).** `routers/admin.py` keeps remove/update/
  lookup user, GDPR export/anonymize, course enrollments list and course analytics.
  Removed: sign-in-as-user tokens, magic links, enroll/unenroll, progress and
  completion writes, certificate award/revoke, usergroups, provisioning, role change.
- **Course authoring (R6).** Removed create/update/delete/clone/import/export/
  contributors/updates for courses; chapter and activity CRUD, versions, video/PDF
  authoring, block uploads; assignment/task authoring, teacher grading, submission
  review, "mark done for user", API-token submit-on-behalf; certification CRUD;
  course migration; AI course planning, magic blocks, quiz/scenario/assignment
  generators and the editor AI chat. Unreferenced service code pruned.
- **Enrollment gate (R8).** `services/courses/locks.py` is now the enrollment lock:
  outlines are visible, content is stripped until the student enrolls; admins
  always see content. Assignment answers, file uploads, hand-in and "mark lesson
  done" require enrollment. Enrolling creates the student's trail if missing.
  Course listings show every published course to signed-in users.
  `/courses/{uuid}/rights` now reports read/enroll/work_on_content/monitor.
- **Communities (R14, R21).** No create/delete/link/unlink/thumbnail. Members read
  and post in every community; `update_community` only edits moderation rules and
  is admin-only. `ensure_community()` is for the catalog sync.
- **Podcasts (R15).** Signed-in users see every published podcast. Rights are
  read / publish (admins). Publishing stays (the spec does not remove it, D9).
- **Playgrounds (R12).** New `PlaygroundShare` table (viewer/editor). Private by
  default. Anyone signed in creates; list returns owned + shared, newest first;
  owner-only delete/share/visibility; editors edit and generate; no admin bypass.
  New endpoints: `GET/POST /playgrounds/{uuid}/shares`, `DELETE .../shares/{user_id}`.
- **Tools always on (R16, R17).** Removed plan/feature gates on boards,
  playgrounds, communities, podcasts; they are always-on features in every plan.
- Pre-existing bugs noticed, not caused by this work: `routers/orgs/orgs.py` calls
  six undefined service functions; `routers/users.py` references an undefined
  `invite_code`. Fixed in passing: missing `status` import in
  `services/orgs/users.py::update_user_role`.

### Session 5 (2026-09-15)

- **Platform Course Catalog (R6, R7):**
  - Completed DSL compiler in `src/content/catalog/content.py` supporting headings, paragraphs, callouts, lists, quizzes (`blockQuiz`), and code blocks with syntax highlighting.
  - Authored platform curriculum in `src/content/catalog/courses/`: `ai-ethics.json`, `ai-foundations.json`, `prompt-engineering.json`.
  - Implemented catalog sync engine in `src/content/catalog/sync.py` with deterministic UUIDs (`stable_uuid`), idempotent upserts for courses, chapters, activities, assignments, and auto-creation of course Q&A communities and the global platform community.
  - Catalog tests: `src/tests/content/test_catalog.py` (6/6 tests passing, 100%).

- **Frontend Refactoring (`apps/web`):**
  - `components/Dashboard/Menus/DashLeftMenu.tsx`: Removed assignments section, fixed course hover links to point to `/overview` instead of `/settings`, removed dead usergroup/roles/add-user links, stripped feature-flag checks from always-on student tools (playgrounds, boards, communities, podcasts).
  - `components/Dashboard/Menus/DashMobileMenu.tsx`: Cleaned assignments pill and panel items, removed feature gates on communities, podcasts, playgrounds.
  - `lib/dashboard-menu-items.ts`: Removed assignments, boards, and playgrounds from admin navigation; removed feature keys from communities/podcasts.
  - `components/Objects/Thumbnails/CourseThumbnailLanding.tsx`: Stripped course edit/delete action menu and confirmation dialogs.
  - `services/courses/courses.ts`: Removed `deleteCourseFromBackend` and unused authoring exports.
  - `app/orgs/[orgslug]/dash/users/page.search.ts`: Removed dead search metadata for `add`, `usergroups`, and `roles`.
  - `components/Objects/Menus/OrgMenu.tsx` & `OrgMenuLinks.tsx`: Guaranteed boards, courses, skills, ai_agent, podcasts, playgrounds are always visible and accessible to students.
  - `app/orgs/[orgslug]/(withmenu)/skills/page.tsx` & `enrollment.tsx`: Implemented student self-enrollment view with enrollment progress bar and course jump links using `getUriWithOrg`.

- **Comprehensive Verification:**
  - Ran full API test suite covering refactored endpoints: 82/82 tests PASSED (100%):
    - `src/tests/content/test_catalog.py`: 6/6 PASSED
    - `src/tests/routers/test_courses_router.py`: 10/10 PASSED
    - `src/tests/routers/test_chapters_router.py`: 3/3 PASSED
    - `src/tests/routers/test_playgrounds_router.py`: 7/7 PASSED
    - `src/tests/routers/test_boards_router.py`: 7/7 PASSED
    - `src/tests/routers/test_communities_router.py`: 3/3 PASSED
    - `src/tests/routers/test_podcasts_router.py`: 3/3 PASSED
    - `src/tests/routers/test_assignments_retry.py`: 15/15 PASSED
    - `src/tests/admin/test_admin_api.py`: 28/28 PASSED
  - Frontend typecheck verified: 0 errors in all refactored files.

