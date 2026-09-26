# 01 — Architecture findings and phase plan

Each decision cites the requirement (R#) from `00-requirements.md`.

## Findings (current code, 2026-09-14)

| Area | What exists today | Conflict |
|---|---|---|
| Roles (`services/setup/setup.py`, `security/rbac/constants.py`) | Admin(1), Maintainer(2), Instructor(3), User(4) + custom org roles via `/roles` CRUD | R1, R2: Maintainer/Instructor are the teacher layer; custom roles are teacher permissions |
| Account type (`security/platform_roles.py`) | admin = superadmin or any role with `dashboard.action_access` | Instructor/Maintainer count as admin (R1) |
| Student rights (role 4) | `boards.action_create=False`, `playgrounds.action_create=False` | Students cannot create their own tools (R12, R13) |
| Usergroups (`db/usergroup*`, `services/users/usergroups.py`, `routers/usergroups.py`, RBAC rule 5, `courses/lock_usergroups.py`, playground/podcast/community gates) | Admin creates groups and links them to courses, playgrounds, boards, podcasts, communities to grant access | Exactly "admin gives a student access" (R3, R15, R17) |
| Headless admin API (`routers/admin.py`) | Enroll/unenroll a user, mark activities complete, reset progress, award certificates, manage usergroups, create users. Not called by the web app | Per-student control (R3) |
| Course authoring (`routers/courses/*`, `chapters`, `activities`, `blocks`, `assignments`, AI course/assignment/quiz generation, `app/editor/course/...`, `/dash/courses/...`) | Admins build courses and assignments in the dash | R6 |
| Enrollment | `POST /trail/add_course/{uuid}` / `DELETE /trail/remove_course/{uuid}` (student self-enroll) | Keep (R8); no UI on Skills (mock page) (R9) |
| Playgrounds (`services/playgrounds/playgrounds.py`) | Listed per org; share via usergroups; create needs role right | R12 |
| Boards (`services/boards/boards.py`) | `BoardMember` owner/editor/viewer sharing exists; list returns every org board; create needs role right; student `/boards` redirects away | R13 |
| Communities | Admin-created communities + one Q&A per course; student `/communities` redirects away; `CommunityEditAccess` usergroup linking | R14, R21 |
| Podcasts | Admin authored; usergroup-restricted access | R15 |
| Feature toggles (`resolved_features`, `require_plan_for_*`) | Tools can be switched off per org / plan | R16, R17 |

Sessions 2–3 (previous plan, `git show HEAD~1:progress.md`) removed student
Boards and Community pages. This spec reverses that: restore, then modify.

## Decisions

- **D1 Roles (R1, R2).** Seed only Admin(1) and User/Student(4). Admin rights lose
  course/chapter/activity/assignment authoring, usergroups and role management; keep
  users, communities/discussions (moderation), podcasts, org config. Student rights gain
  create/own-update/own-delete on boards and playgrounds. CLI `retire-teacher-roles`
  moves members of Maintainer/Instructor/custom roles to Admin and deletes those roles.
  Account type: admin = superadmin or role 1. `/roles` becomes read-only.
- **D2 Usergroups removed (R3).** Router, service, models, RBAC rule, course/chapter/activity
  locks, playground/podcast/community/board access tabs, admin API group endpoints, web
  pages/modals. Tables dropped by migration.
- **D3 Platform course catalog (R6, R7).** Courses live in code (`src/content/catalog.py`):
  dummy courses with chapters, lessons and an auto-graded assignment. `cli.py
  sync-platform-content` upserts them (also run by `install`). Course/chapter/activity/
  assignment create/update/delete endpoints, course import/export/migration, AI authoring
  generators and the course editor route are removed.
- **D4 Enrollment (R8, R9).** Trail add/remove course stays the enrollment API. Skills page
  gets a real enrollment section. Students must be enrolled to open a course's activities
  and submit work; the course page shows how to enroll.
- **D5 Assignments (R10).** Keep student submission, auto-grading and completion. Remove
  authoring, manual grading/rejection and "assign to student" paths.
- **D6 Playgrounds (R12).** Any signed-in user creates unlimited playgrounds. "My playgrounds"
  lists owned + shared-with-me. Sharing is per user (new `PlaygroundShare` table) replacing
  usergroups; access types stay (private=restricted, signed-in link, public).
- **D7 Boards (R13).** Any signed-in user creates unlimited boards. List = boards I own or am a
  member of. Share with specific people via existing `BoardMember`. A discussion can link a
  board; people who can read that discussion can open the board as editors.
- **D8 Community (R14, R21).** A platform "Community" is seeded with the catalog; communities
  are platform content (no admin create). All signed-in users read and post. Admins moderate
  (pin, lock, delete posts/comments) from the admin moderation page.
- **D9 Podcasts (R15).** Readable by every signed-in user; no usergroup restriction. The spec
  does not remove podcast publishing, so admin episode publishing stays as platform content.
- **D10 Tools always on (R16, R17).** Boards/playgrounds/communities/podcasts/AI agent are not
  gated by org feature toggles or plan checks.
- **D11 Admin (R18–R22).** `/admin` console + `/dash` stay. Dash nav: Home (overview), Courses
  (monitoring: enrollments, completion, popularity), Community (moderation), People (users,
  disable/remove), Insights (analytics), Platform (settings/developers). Removed: create/edit
  course, assignments, usergroups, roles, add-users, per-student enrollment/progress controls.
  Headless admin API keeps only account and course-analytics endpoints.

## Phases

| # | Phase | Requirements |
|---|---|---|
| 1 | Roles, account type, retire teacher roles | R1 R2 |
| 2 | Remove usergroups end-to-end | R3 R15 R17 |
| 3 | Headless admin API → accounts + analytics only | R3 R19 R20 |
| 4 | Platform course catalog + remove course/assignment authoring | R6 R7 R10 |
| 5 | Enrollment (Skills page, enrollment gate) | R8 R9 R11 |
| 6 | Playgrounds student-owned + per-user sharing | R12 |
| 7 | Boards student-owned + discussion links | R13 |
| 8 | Platform community + moderation | R14 R21 |
| 9 | Podcasts + AI agent + tools always on | R15 R16 R17 |
| 10 | Admin dash/console transformation | R18–R22 |
| 11 | Tests, verification, cleanup | R5 R24 |
