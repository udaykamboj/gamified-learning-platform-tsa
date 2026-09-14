# Single-Organization + Student/Admin Refactor — Progress Log

This file tracks the refactor described in `prompt.md`. `prompt.md` stays
untracked on purpose because it contains a local admin password. Anyone
picking this up should read this file top to bottom first.

## Goal (short version)

- One permanent organization. Nobody creates, selects, or switches orgs. The
  backend enforces this; the UI doesn't just hide it.
- Two account types on top of the existing LearnHouse role system:
  - **Student**: the default "User" role (role id 4). Takes courses, tracks
    progress, edits their profile. No authoring, no admin APIs.
  - **Admin**: manages courses, content, and students through the existing
    LearnHouse course-management dashboard, plus the platform (superadmin)
    console.
- Login routing: student → `/dashboard`, admin → `/admin`. `/admin` shows a
  chooser with two boxes: **Course management** (the org dash) and
  **Platform console** (the old superadmin console).
- Students are rejected from `/admin` and admin APIs by the backend.
- The student area is for students only. Admins get no "admin" badge and no
  "Dashboard → onboarding" path there.
- Public signup always creates a student in the single org. Admins come from
  the install seed or a protected promotion endpoint.

## Status

| Phase | State |
|---|---|
| 0. Orientation + baseline tests | done |
| 1. Architecture map (10 parallel readers) | done (8/10, 2 re-running) |
| 2. Design (below) | done, under review |
| 3. Backend: shared foundations (platform org + account type) | not started |
| 4. Backend: single-org enforcement (orgs, signup, OAuth, demo, install) | not started |
| 5. Backend: core platform console API (replaces missing EE superadmin API) | not started |
| 6. Frontend: auth/routing, `/admin` chooser + console | not started |
| 7. Frontend: course-management dash cleanup (no org onboarding/switching) | not started |
| 8. Frontend: student-only area (no admin chrome) | not started |
| 9. Tests + adversarial review + verification | not started |

## What the mapping found (the important parts)

1. **The `/admin` console has no backend in this repo.** The web console calls
   `/api/v1/ee/superadmin/*`. Those routes lived in the private `apps/api/ee`
   tree, which commit `66c4865b` removed and `.gitignore` excludes, so every
   console request returns 404. Core `require_superadmin` would also return 403
   `ee_required` in OSS mode. The earlier commit only made the *web* gate never
   block.
2. **Role-aware login routing never worked.** `services/auth/roles.ts` reads
   `session.data`, but `AuthContext` passes a raw `Session` and `login.tsx`
   passes `session.data`, so the role always comes back `null` and everyone
   lands on `/dashboard`. The tests only cover the `{data}` shape. This is the
   root cause of "admin sees the student view with an admin badge".
3. **The single org could still be destroyed or bypassed.** Still live:
   - `DELETE /orgs/{id}`
   - `POST /orgs/join` and `DELETE /orgs/{id}/leave`
   - `POST /users/`, which creates an org-less account
   - `POST /users/{org_id}`, which accepts any org id
   - Google OAuth without `org_id`, which creates org-less users
   - `/demo/enter`, which makes any user ADMIN of a second "demo" org
   - Deleting the only admin's account, which auto-deletes the org
4. **Three different "default org" resolvers** disagreed about which org to
   use (`/instance/info`, `/users/register`, and the unused `get_default_org`).
5. Leftovers from the earlier UI-testing work:
   - `OrgContext` and `getOrganizationContextInfo` return a fake "Demo Org" on
     any error.
   - `AuthContext.refreshSessionInternal` is a no-op stub.
   - `app/hooks/useUserRole.ts` imports `next-auth`, which isn't installed.
   - The single-tenancy proxy honors the `LH_org` cookie, so a client could
     switch orgs.
6. Course-management "onboarding" means `WelcomeModal`, `OnboardingSidebarBox`,
   `OnboardingTracker`, and `/dash/onboarding`, all driven by localStorage.
   Nothing redirects into it. Admins saw it because the student account menu
   linked to `/dash`.

## Design (decisions)

### Account type (one definition, computed on the backend)

- `account_type = "admin"` when `User.is_superadmin` is true, OR the user's
  membership **in the platform org** has a role that grants
  `dashboard.action_access`. That covers the seeded Admin(1), Maintainer(2),
  and Instructor(3) roles, plus custom staff roles. This reuses the existing
  LearnHouse rights model and avoids adding a new column.
- `account_type = "student"` for everyone else. That's the default role 4.
- `can_manage_platform = is_superadmin OR role_id == 1 (Admin)` in the platform
  org. This gates the Platform console box and its API. Maintainers and
  Instructors are admins who only get Course management.
- The backend exposes these as `platform_role` and `can_manage_platform` on
  `GET /users/session`. The web reads them and no longer re-derives role from
  rights. The fields have defaults, so cached Redis session blobs still load.

### Platform org (one resolver)

`services/orgs/platform.py::get_platform_org(db)` picks the org with slug
`STARLAB_INITIAL_ORG_SLUG` (or `default`) if it exists and isn't a demo org.
Otherwise it picks the lowest-id non-demo org. With no org at all it returns
503. `/instance/info`, signup, OAuth, login policy, and session all use it.

### Backend single-org enforcement

- Delete the org-creation services (`create_org`, `create_org_with_config`, the
  free-org cap), the dead `_require_platform_superadmin`, and `get_default_org`.
- Remove these routes: `DELETE /orgs/{id}`, `POST /orgs/join`,
  `DELETE /orgs/{id}/leave`, `GET /orgs/user/page/...`, and
  `GET /orgs/user_admin/page/...`.
- Restrict "remove all users" and "wipe content" to platform admins (role 1 or
  superadmin).
- `install_create_organization` refuses to run if a real org already exists.
  The CLI install is idempotent.
- Signup:
  - `/users/register` is the public path.
  - `POST /users/` delegates to it.
  - `POST /users/{org_id}` and the invite variant return 404 unless `org_id` is
    the platform org.
  - The signup rate limit is enforced.
- Google OAuth always resolves the platform org on the server and never
  creates org-less users. Password and magic-link login bind the session to the
  platform org.
- `get_user_session` only returns memberships in the platform org.
- Deleting a user never deletes the org. The last platform admin can't be
  deleted.
- Role changes: only role 1 or a superadmin can grant or revoke a
  dashboard-access role. Nobody can change their own role. Org API tokens can't
  assign dashboard-access roles.
- The demo org feature is disabled in this build: the router is unmounted, the
  scheduler doesn't start, and the CLI demo commands are removed.
  `is_multi_org_allowed()` always returns False.
- Org-less accounts from before the refactor are handled by an explicit CLI
  command, `backfill-platform-members`. It is not an automatic boot step,
  because that would silently re-add students an admin removed.

### Core platform console API (new, replaces the missing EE routes)

Router `/api/v1/platform-admin`, guarded by `require_platform_admin`, with no
EE gate:

- `GET /overview`: the platform org, plus counts of students, admins, courses,
  and enrollments, and recent signups.
- `GET /users?page&limit&search&account_type`: paginated users with their
  account type.
- `PUT /users/{id}/account-type` `{account_type}`: promotes or demotes by
  setting the platform-org role to 1 or 4. Guards: no self-change, can't remove
  the last admin, and a superadmin must lose superadmin access before being
  demoted. The user's cached session is invalidated, and their tokens are
  revoked on demotion.
- `PUT /users/{id}/superadmin` `{is_superadmin}`: superadmin only, with the
  same guards.
- `GET/POST /tokens`, `DELETE /tokens/{uuid}`: superadmin API tokens, managed
  by superadmins only.
- `ensure_ee_superadmin_surface` no longer blocks OSS. Superadmin access is
  core in this build.

### Frontend

- `services/auth/roles.ts` accepts both session shapes and prefers the backend
  fields. `resolveLandingDestination` parses absolute callback URLs.
  `useUserRole.ts` is deleted. The `AuthContext` refresh stub and the
  `OrgContext` fake-org fallbacks are reverted.
- Proxy: single tenancy always uses the default org slug and ignores `LH_org`.
  References to the deleted `/new` and `/organizations` are removed.
- `/admin` is the chooser (Course management → `/dash`, Platform console →
  `/admin/overview`). Students are sent to `/dashboard`.
- The console becomes Overview, Users (promote/demote), and Developers
  (tokens). The org list, org detail, the create-org modal, and the analytics
  page are removed.
- Course-management dash:
  - Removed: onboarding, the demo banner, the Danger Zone tab, the usage/plan
    UI, the multi-org switcher, "create organization", and the custom-domains
    tab.
  - The logo goes back to `/admin`. "Organization" settings is relabeled
    "Platform settings".
  - Students are redirected to `/dashboard`.
- Student area:
  - Removed from the header and menus: role badges, the Dashboard link, the
    admin Dashboard/Help dropdowns, the multi-org menu, and the join banner.
  - Authoring controls come out of student pages.
  - Admins are redirected to `/admin` from student home, account, and progress
    pages. Course and activity pages stay viewable by admins as a labeled
    "Admin preview", because the dash's Preview links depend on them.
- `app/home` (the org picker) is deleted.

## Log

### Session 1 (2026-09-13)

- The repo already had a partial attempt in commit `9a53e87d` ("Update project
  files"). Findings above; I'm fixing it rather than trusting it.
- Local tooling: Docker/Postgres aren't available on this machine. API tests
  run on in-memory SQLite (a scratch venv on Python 3.14.6; the project pins
  3.14.7). Web deps come from `bun install`.
- Baselines on the untouched code:
  - Web `bun test tests`: 277 pass, 1 fail. The failure is in
    `url-security.test.mjs`: `getUriWithOrg` returns `/dashboard`, a regression
    from the earlier commit.
  - Web `tsc --noEmit`: 78 errors, all pre-existing. They come from the earlier
    commit's shadcn components with missing deps, plus onboarding/editor typing.
  - API pytest: 45 failures, all pre-existing. Most are Windows-only (symlinks,
    ffmpeg, paths). Two are `test_orgs_router::test_create_org*`, broken by the
    earlier commit's removal of `POST /orgs/`.

## Student-first scope (next)

**Direction changed on 2026-09-14.** StarLab is a personal, student-first
learning platform (Khan Academy's product model), not a Canvas-style classroom.
The plan is in [`docs/refactor/`](docs/refactor/00-overview.md), which replaces
`implementation_plan.md`. Work from
[`05-implementation-order.md`](docs/refactor/05-implementation-order.md).
Session 2 below followed the cancelled Canvas plan; 00-overview says which of
its changes were kept or reversed.

### Session 2 (2026-09-13, Canvas direction, partly reversed)

- Wrote the Canvas-style `docs/refactor/00`–`04` (since replaced).
- Course-linked communities are now enrollment-gated in the shared RBAC
  checker (`resource_access.py`). New helper `services/trail/enrollment.py`.
  Tests are in `tests/security/test_course_community_access.py`. The security
  and community suites have 25 failures, the same 25 as before the change.
- Student nav no longer lists Communities, and `/communities` redirects to
  `/dashboard`.
- Dash sidebar: removed Payments, Domains/SEO/SSO, and the "Other" menu.
- `tsc`: 78 errors, same as baseline, none in touched files. `bun` isn't
  installed on this machine, so the web unit tests weren't run.

### Session 3 (2026-09-14, student-first reset)

- Audited boards, discussions, course/activity/assignment models, trail
  progress, roles/usergroups, and admin nav against the student-first model.
- Rewrote `docs/refactor/` as `00-overview` + `01`–`05` (problems, target
  architecture, change list, reuse, order). Deleted the Canvas specs.
- Reversed the enrollment gate: course Q&A read access now mirrors course read
  access (`_check_course_community_gate`). Tests rewritten; community and
  discussion tests: 65 passed. Security suite: 25 failures, all pre-existing.
- Found: public-but-unpublished courses are readable by students (Rule 4).
  Queued in step 1.
- Boards: student `/boards` redirects to `/dashboard`; Boards removed from dash
  sidebar and mobile menu (`/dash/boards` still works by URL). Store removed
  from student nav defaults.
- Web tsc and unit tests weren't run. The web changes only remove code.

### Session 3, part 2 (2026-09-14, step 1)

- Draft leak closed: students can no longer read public-but-unpublished
  courses (Rule 4 now requires published).
- Every course has a Q&A community: created with the course. For existing
  courses, run `python cli.py backfill-course-qa` once in `apps/api`
  (**deploy step**).
- Community rights follow course access; `CommunityRead.course_uuid` added;
  Q&A breadcrumbs point to the course.
- Admin sidebar grouped (Content / Community / People / Insights / Platform);
  "Assignments" → "Practice & tests", "Communities" → "Q&A moderation"; billing
  upsell and purchases link removed.
- Payments, store, and developer domains/SEO/SSO pages redirect; custom domain
  management API unmounted; command palette de-indexed.
- Not done: Instructor relabel (needs a data migration; alembic has 4 heads).
- Tests: affected API suites (communities, discussions, courses, resource
  access, podcasts, trail) pass: 402 before the CLI change, 350 on the final
  rerun. Security suite still 25 failures
  (pre-existing). Two tests updated for intended behavior (draft leak; lazy
  community creation, later reverted). Web `tsc`: 78 errors = baseline, none in touched files.
  **Web unit tests have not run for two sessions** (no `bun` here). Run
  `cd apps/web && bun test tests` on a machine with bun before merging.
- Tooling note: Windows PowerShell 5.1 `Get-Content`/`Set-Content` mangles
  UTF-8. Use the Edit tool or Python for file rewrites.

### Session 3, part 3 (2026-09-14, step 2)

- Committed steps 0-1 as `1a8a36c1`.
- Learning roles: `Activity.details.learning_role` (lesson / practice /
  assessment), `api/services/courses/activities/learning.py`. Assignment
  activities are practice by default; only they can be practice/assessment.
- Presets on `create_assignment`: auto-scored, unlimited retries, no deadline,
  percentage scores, pass at 70% (practice) / 80% (unit test), answer reveal on
  submission / after grading.
- Completion follows the score: `_apply_grade_and_finalize` records
  best/last score, attempts and `passed` on `TrailStep.data`; hand-in no longer
  completes graded work; passing sticks through retries; admin rejection resets;
  `POST /trail/add_activity` refuses practice/assessment.
- Web: create-assignment modal is now a Practice set / Unit test picker; both
  assignment modals drop due date and grading type; student view shows the
  role and pass mark.
- Tests: new `test_learning_progress.py` (6); three tests updated for the new
  rule; assignment/trail/certificate/activity suites 674 passed. Web `tsc` 78 =
  baseline. Web unit tests still not run.
- Open: auto-gradable default in the task editor; certificate gate still uses
  current grades (see 02).

## How to verify locally

```bash
# API tests (in-memory SQLite)
cd apps/api && uv run pytest src/tests -q
# Web unit tests
cd apps/web && bun test tests
```
