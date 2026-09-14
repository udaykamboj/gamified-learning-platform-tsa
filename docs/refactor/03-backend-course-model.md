# 03: Backend course model (enrollment, roster, staff)

## Current state

- **Enrollment** = `Trail` (one per user per org, `api/db/trails.py`) +
  `TrailRun` (one per user per course, `api/db/trail_runs.py`, unique on
  trail/course/user).
  - Created by the course page's "Start course" button:
    `web/components/Objects/Courses/CourseActions/CoursesActions.tsx` →
    `startCourse` → `POST /trail/add_course/{course_uuid}` →
    `add_course_to_trail` (`api/services/trail/trail.py`), which emits
    `COURSE_ENROLLED`.
  - Removing a course from the trail deletes the run.
- **Course access** is `public` + usergroups (`api/security/rbac/resource_access.py`),
  **not the roster**. Any student can open any public course.
- **Staff** = `ResourceAuthor` rows on the course + org roles 1–3 (dashboard
  access).
- Every table still has `org_id`. `get_platform_org(db)`
  (`api/services/orgs/platform.py`) resolves the single org.

## Why it's wrong for us

Canvas-style features (course discussions, course boards, gradebook, and later
XP/leaderboards per course) need one clear answer to "is this student in this
course?" Today that answer is buried in trail/progress code, there's no admin
roster (add/remove students), and course visibility doesn't use it at all.

## Target

- **One helper** everywhere: `is_user_enrolled_in_course(db, user_id, course_id)`
  in `api/services/trail/enrollment.py` (**exists now**; no RBAC imports, so
  the access checker can use it), and
  `is_course_staff(db, user, course)` (to add: superadmin, role 1–3 in the
  platform org, or `ResourceAuthor` on the course).
- **Explicit enrollment API** (thin wrappers over `TrailRun`):
  - `POST /courses/{uuid}/enroll`: self-enroll if the course allows it
    (`course.open_enrollment`, default true), otherwise 403.
  - `DELETE /courses/{uuid}/enroll`: unenroll self.
  - `GET /courses/{uuid}/roster`: staff only, paginated.
  - `POST /courses/{uuid}/roster` `{user_ids}` / `DELETE /courses/{uuid}/roster/{user_id}`: staff only.
  - `GET /users/me/courses`: the student dashboard's "My courses".
- `startCourse` on the web keeps working; it becomes an alias of `enroll`.
- Course visibility: `public` means "listed in the catalog". Chapter/activity
  content for non-public courses requires enrollment or staff. (Decide whether
  public courses also require enrollment for content. The Canvas default is
  yes.)
- **No new org model.** Keep `org_id` columns and fill them from
  `get_platform_org`.

## Change list
1. Add `is_course_staff` next to `is_user_enrolled_in_course`, and replace the
   inline staff check in `ResourceAccessChecker._check_course_community_gate`
   (`api/security/rbac/resource_access.py`) with it.
2. New router `api/routers/courses/enrollment.py` with the routes above. Cache
   invalidation follows `add_course_to_trail`.
3. Alembic migration: `course.open_enrollment bool default true`.
4. Web: dash course editor gets a "Roster" tab. The student dashboard reads
   `/users/me/courses`.
5. Use the helpers in boards (01) and discussions (02). Later: gamification
   hooks on `COURSE_ENROLLED` / activity completion.

## Acceptance checks
- [ ] Staff can add/remove a student, and the student immediately gains/loses discussion access.
- [ ] A student can't read another student's roster or enroll in a closed course.
- [ ] `/users/me/courses` matches the student's `TrailRun` rows.
