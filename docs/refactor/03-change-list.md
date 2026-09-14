# 03: Exact change list

Tick items as they ship. `[x]` = done 2026-09-14.

## A. Discussions → **repurpose** as content Q&A (not delete, not class forum)

Why repurpose: the tables (communities, discussions, comments, votes,
reactions) are solid and Q&A under content is a real student-first feature. A
global forum list and an enrollment gate are the classroom parts.

- [x] `api/security/rbac/resource_access.py::_check_course_community_gate`:
  reading a course-linked community mirrors **course READ access**; no
  enrollment check. Non-read actions fall through to normal rules (admins).
  Tests: `api/tests/security/test_course_community_access.py`.
- [x] Student top nav has no Communities; `(withmenu)/communities` redirects.
- [x] Course create (`api/services/courses/courses.py`) calls
  `ensure_course_community` (`api/services/communities/communities.py`). A
  failure there is logged and never fails course creation.
- [x] Backfill for older courses: `python cli.py backfill-course-qa` (in
  `apps/api`, runs `backfill_course_communities`). Safe to rerun. Reads never
  create rows: `community.course_id` has no unique constraint, so creating on a
  concurrent GET could duplicate. Add that constraint once the migration heads
  are merged (03-G).
- [ ] Org-wide communities with no course → `public=False` (admin-only). Don't
  delete. Do it by hand in `dash/communities`; there are few or none.
- [ ] `Discussion` anchoring: add a nullable, indexed `discussion.activity_id`
  (FK `activity.id`, `ON DELETE SET NULL`; one Alembic migration, since
  `Discussion` has no JSON field).
  Activity page shows "Questions about this lesson" filtered by it; course page
  shows all.
- [x] `get_community_user_rights`: for course communities, `read` and
  `create_discussion` come from the course access check; `via_public` stays false.
- [x] `CommunityRead.course_uuid` is filled on single reads (`get_community`,
  `get_community_by_course`) so the UI can link back to the course.
- [x] Breadcrumbs in `web/app/orgs/[orgslug]/(withmenu)/community/[communityuuid]/community.tsx`
  and `.../discussion/[discussionuuid]/discussion.tsx` → course page, not `/communities`.
- [x] `OrgEditMenu.tsx`: no "communities" or "store" menu options; saved menus
  drop them.
- [x] Dash: "Communities" → "Q&A moderation" (desktop and mobile; page kept).
- [ ] Kept on purpose: `PUT /communities/{uuid}/link-course/...` and
  `DELETE .../unlink-course` (admin repair tools), and
  `GET /communities/org/{org_id}/page/...` (the sitemap uses it).

## B. Boards → **remove from the student product, keep as dormant admin tool**

Why not repurpose: a 10-person invite-only whiteboard doesn't serve lessons →
practice → mastery. Why not delete: it's self-contained (router behind
`require_boards_feature`, own collab server), costs nothing while hidden, and
could later become a personal scratchpad.

- [x] `web/app/orgs/[orgslug]/(withmenu)/boards` → redirect to `/dashboard`.
- [x] Dash sidebar: remove top-level Boards item (`DashLeftMenu.tsx`,
  `DashMobileMenu.tsx`). `dash/boards` route still works by URL.
- [ ] **Cancelled:** `board.course_id` / `student_edit` migration and course
  board routes. Do not build.
- [ ] Recommend turning the `boards` feature flag off in platform settings.
- [ ] Later (optional, post-gamification): "personal study board" per student.

## C. Course / enrollment backend

- [ ] **Cancelled:** roster API, `open_enrollment` flag, staff-managed enrollment,
  "content requires enrollment". Do not build.
- [ ] Keep `POST /trail/add_course/{uuid}` / `DELETE /trail/remove_course/{uuid}`
  as the enroll/leave API. Web label: "Start course" / "Remove from my learning".
- [ ] `add_activity_to_trail` (`api/services/trail/trail.py`) already auto-creates
  the `TrailRun`, so opening any lesson "starts" the course. Keep that.
- [x] Closed the draft leak (01 §9): Rule 4 in `_check_public_view_read_access`
  requires `is_published` when the resource has a published field. (Rule 4 is
  now effectively unreachable, since Rule 1 already allows public+published.
  Leave it; removing it is a separate cleanup.)
- [ ] Admin enrollment view (read-only count / list per course) belongs in
  Analytics, not a roster editor.

## D. Activities: learning role + completion

- [ ] `Activity.details.learning_role` (see 02). Helper
  `get_learning_role(activity)` in `api/services/courses/activities/` with the
  fallback rule.
- [ ] Authoring UI: role picker when creating an activity
  (`web/components/Objects/Modals/Activities/Create/NewActivityModal/`).
- [ ] `add_activity_to_trail`: for `practice`/`assessment`, don't complete on
  visit. Complete from the assignment submit/grade path when best score ≥
  threshold; store `best_score`/`attempts` in `TrailStep.data`.

## E. Assignments → practice/assessment presets

- [ ] `api/services/courses/activities/assignments.py` create path: apply the
  preset from 02 when `learning_role` is practice/assessment and the caller
  didn't set the field.
- [ ] Authoring (`AssignmentActivityModal.tsx`, `EditAssignmentModal.tsx`): hide
  due date and grading type for practice/assessment; default task types to
  auto-gradable ones.
- [ ] Student view (`AssignmentStudentActivity.tsx`): no due date, no letter
  grade; show score, "Try again", correct answers per preset.
- [ ] Dash "Assignments" → "Question review": lists items with manual-graded
  tasks only. Keep `EvaluateAssignment.tsx` for that.

## F. Mastery (spec now, build in step 3 of 05)

- [ ] `api/services/trail/mastery.py`: pure functions over TrailStep +
  submissions (see 02). No RBAC imports.
- [ ] `GET /trail/course/{course_uuid}/mastery` (self only).
- [ ] Unit tests for level thresholds.

## G. Roles and naming

- [ ] Relabel role 3 "Instructor" → "Content creator" (keep id 3 and rights).
  **Blocked:** role names are rows, so this needs an Alembic data migration,
  and `apps/api/migrations/versions` currently has several heads
  (`b1c2d3e4f5a6`, `c1d2e3f4a5b6`, `d3e4f5a6b7c8`, `n4o5p6q7r8s9`). Merge the
  heads first, then rename in one migration + `setup.py`. Web code already
  treats roles 1–4 as system roles by id, not name.
- [ ] Usergroups: keep, describe as "content access groups" in dash copy.

## H. Admin dashboard separation

- [x] Removed top-level Boards from the sidebar.
- [x] Sidebar grouped *Content* (Courses, Practice & tests, Library, Podcasts,
  Playgrounds) / *Community* (Q&A moderation) / *People* (Users) / *Insights*
  (Analytics) / *Platform* (Developers). Mobile labels updated.
- [x] `dash/payments/*` → `/dash`; `dash/developers/{domains,seo,sso}` → `/dash`
  (only API + Automations tabs remain); student `/store` and offer pages →
  `/dashboard`.
- [x] Custom domain management API unmounted (`api/router.py`). Domain
  resolution (`/orgs/resolve/domain/...`) and the internal listing stay mounted
  because web tenancy/auth code calls them. Payments and SSO routers are EE-only
  and aren't in this repo, so there's nothing to unmount.
- [x] Billing upsell block, starfield constant, and account "Purchases" link
  removed from `DashLeftMenu.tsx`.
- [x] Dashboard command palette no longer indexes payments, boards, SEO,
  domains, SSO, or usage (`web/lib/dashboard-search/registry.ts`,
  `dash/org/page.search.ts`).
- [ ] `dash/org/settings/usage` (plan usage) and `danger` tabs are still in org
  settings. Decide in a later cleanup.
- [ ] `web/tests/admin-authorization-denial.test.mjs` must still pass after nav changes. It lists dash route folders, and none were deleted. Not run: `bun` isn't installed here.

## I. Student surface

- [x] Removed `store` from the student nav default order (`OrgMenuLinks.tsx`).
- [ ] Leave `journey/`, `skills/`, and the Learning Universe alone until the
  dashboard phase; they'll read `/trail/` + mastery.
