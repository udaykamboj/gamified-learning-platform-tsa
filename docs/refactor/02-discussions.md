# 02: Discussions → one space per course

## Current state

- Models in `api/db/communities/`:
  - `Community` has `org_id`, **optional** `course_id`, `public`, and
    moderation settings.
  - `Discussion`, `DiscussionComment`, votes, and reactions hang off a
    community.
- Link/unlink endpoints: `PUT /communities/{uuid}/link-course/{course_uuid}` and
  `DELETE /communities/{uuid}/unlink-course`. `GET /communities/course/{course_uuid}`
  finds the linked one.
- RBAC (`api/security/rbac/config.py`): `communities` is a top-level resource
  gated by `public` + usergroups. `discussions` inherits from its community.
  **Course enrollment was never checked**, so any logged-in student could read
  and post in any public community, including other courses'.
- Role 4 seed rights: `communities.read`, and `discussions.create/read` plus
  own update/delete.
- Web:
  - Global student nav entry `/communities`
    (`web/components/Objects/Menus/OrgMenuLinks.tsx`)
  - List page `(withmenu)/communities`
  - Detail `(withmenu)/community/[communityuuid]`
  - The course page already renders `CourseCommunitySection`
    (`(withmenu)/course/[courseuuid]/course.tsx`).

## Why it's wrong for us

Communities are Discord-style org forums that you can *optionally* attach to a
course. In Canvas, discussions belong to the course: only that class sees them,
and the instructor moderates them. A global forum list in the student nav is
the tenant model leaking through.

## Target

- **Every community has a course.** Exactly one per course, created
  automatically when the course is created. `course_id` is required on create.
- Access to a course community and all its discussions/comments/votes/reactions:
  - Admin / course staff: full + moderation.
  - Enrolled student: read, post, comment, and edit/delete their own posts.
  - Everyone else: 403.
  - **`public` is ignored once `course_id` is set.** Don't add a public bypass
    back.
- No global community list for students. Discussions are reached from the
  course page.
- Admins manage/moderate from the course editor. `dash/communities` can stay as
  an admin-wide moderation view.

## Change list

**Done (this session)**
- [x] Backend enrollment gate in the one shared checker:
  `ResourceAccessChecker._check_course_community_gate`
  (`api/security/rbac/resource_access.py`). Discussions, comments, votes, and
  reactions all call `check_resource_access(community_uuid, ...)`, so they're
  all covered. Rules: anonymous → deny; admin/maintainer, course author, or
  anyone with `communities.update` → normal rules; enrolled student → read
  allowed; otherwise → 403.
- [x] Enrollment helper `is_user_enrolled_in_course()` in
  `api/services/trail/enrollment.py`. It's a separate module because `trail.py`
  imports RBAC, and importing it from RBAC would create a cycle.
- [x] Tests: `api/tests/security/test_course_community_access.py`.
- [x] `communities` removed from the student nav builtins
  (`web/components/Objects/Menus/OrgMenuLinks.tsx`); `(withmenu)/communities`
  redirects to `/dashboard`.

**Remaining**
1. Course create (`api/services/courses/courses.py`): auto-create the community
   with `course_id` set.
2. `CommunityCreate`: require `course_id` (or `course_uuid`). Remove
   `unlink-course`, and keep `link-course` only for the backfill.
3. Backfill CLI command: for each course without a community, create one. For
   communities without a course, either link them manually or mark them
   admin-only (`public=False`, no usergroups).
4. `GET /communities/org/{org_id}/page/...`: admin-only.
5. Dash course editor: add a "Discussions" tab (moderation settings, pin/lock).
6. Community/discussion breadcrumbs (`(withmenu)/community/[communityuuid]/community.tsx`,
   `.../discussion/[discussionuuid]/discussion.tsx`, `page.tsx` JSON-LD) still
   link to `/communities`. Point them at the course page instead.
7. `get_community_user_rights` (`api/services/communities/communities.py`)
   still reports `via_public` for course communities. Make it reflect the
   enrollment gate so the UI doesn't show a "join/post" button that then 403s.
8. The org-wide community picker `web/components/Dashboard/Pages/Org/OrgEditMenu/OrgEditMenu.tsx`
   can still add a custom "communities" menu item. Remove that option.

## Acceptance checks
- [x] Non-enrolled student → 403 on a course community and its discussions.
- [x] Enrolled student → can list and post.
- [ ] Creating a course creates its discussion space.
- [ ] No community without a course is visible to students.
