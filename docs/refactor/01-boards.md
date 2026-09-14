# 01: Boards → course-scoped

## Current state

- Model `api/db/boards.py`: `Board` has `org_id`, `created_by`, `public`,
  `ydoc_state` (Yjs collaborative whiteboard). **No `course_id`.**
- Access: `BoardMember` rows (`owner` / `editor` / `viewer`, max 10 members,
  `services/boards/boards.py`) plus the `public` flag. RBAC config
  `api/security/rbac/config.py` → `"boards"` (usergroups + authorship).
- Routes `api/routers/boards/boards.py`: `POST /boards/?org_id=`,
  `GET /boards/org/{org_id}`, `/{board_uuid}` CRUD, members, duplicate. The
  entire router is behind `require_boards_feature`.
- Role 4 (student) seed rights (`api/services/setup/setup.py`):
  `boards.action_create=False`, `action_read=True`.
- Web:
  - Student page `web/app/orgs/[orgslug]/(withmenu)/boards`
  - Admin page `web/app/orgs/[orgslug]/dash/boards`
  - Top-level dash nav item `web/components/Dashboard/Menus/DashLeftMenu.tsx`

## Why it's wrong for us

Boards act like a Miro workspace for the whole tenant: someone creates a board
and hand-invites up to 10 people. In a course app, a board is a class activity.
The instructor opens it for a course (or a group within the course), and the
enrolled students collaborate on it. Right now nothing connects a board to a
course or its roster, and the 10-member cap makes class use impossible.

## Target

- `Board.course_id` (FK `course.id`, `ON DELETE CASCADE`). It stays nullable
  only for admin scratch boards, which students never see.
- Access for a course board:
  - **Admin / course staff** (role 1–3 or `ResourceAuthor` on the course): full.
  - **Enrolled student** (`is_user_enrolled_in_course`, see 03): read. Also
    write if the board has `student_edit=True` (new bool, default `True`).
  - Everyone else: 403. `public` is ignored when `course_id` is set.
- `BoardMember` stays for explicit per-board overrides (e.g. a group project),
  but it isn't required for enrolled students, and the 10-member cap doesn't
  apply to course boards.
- Admins create boards from the course editor.

## Change list

**Backend**
1. Alembic migration: add `board.course_id` (nullable, indexed) and
   `board.student_edit` (bool, default true). Backfill: leave existing boards
   with `course_id = NULL` (admin-only scratch).
2. `BoardCreate` / `BoardRead`: add `course_id` (create takes `course_uuid`,
   resolved server-side).
3. New routes: `GET /courses/{course_uuid}/boards`,
   `POST /courses/{course_uuid}/boards`. Keep `/boards/{board_uuid}` for
   detail/update.
4. `services/boards/boards.py`: add a single `_assert_board_access(board, user,
   action)` that applies the rules above, and use it in get/update/delete/
   `check_board_membership`. The collab server calls `check_board_membership`
   through the internal router, so it must accept enrolled students too.
5. `GET /boards/org/{org_id}`: admin-only (or remove once the dash uses course
   routes).

**Web**
1. Course page (`(withmenu)/course/[courseuuid]/course.tsx`): add a "Boards"
   section next to `CourseCommunitySection`.
2. Course editor in dash: add a "Boards" tab and remove the top-level Boards nav
   item.
3. Only then: redirect `(withmenu)/boards` → `/dashboard`. Don't redirect
   before step 1 ships, or existing board members lose access.

## Acceptance checks
- [ ] A student not enrolled in course A gets 403 on a course-A board (REST and collab websocket).
- [ ] An enrolled student can open it; can edit only if `student_edit`.
- [ ] Boards with no course are invisible to students.
- [ ] The course page lists that course's boards; there's no global boards page in student nav.
