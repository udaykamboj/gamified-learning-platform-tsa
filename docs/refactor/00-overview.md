# Student-First Refactor: Overview

> **This folder was rewritten on 2026-09-14.** The previous version (commit
> `8cf22a29`) specced a **Canvas-style** model: the course as a classroom,
> rosters, course-scoped boards, enrollment-gated course forums. That direction
> is **cancelled. Do not implement it.** The old `01-boards.md`,
> `02-discussions.md`, `03-backend-course-model.md` and `04-admin-dashboard.md`
> were deleted; read them from git history only if you need the file refs.
>
> Still valid and unchanged: the single-org + student/admin account work in
> `progress.md`. Keep `org_id`, `/orgs/` routes and `app/orgs/[orgslug]`
> internally.

## The shift

| | Canvas (old direction) | StarLab (new direction) |
|---|---|---|
| Center of the app | A teacher's classroom | The student's own learning path |
| How a student gets into a course | Teacher enrolls them (roster) | Student picks it from the catalog and starts it |
| Content shape | Modules + assignments with due dates | Units → lessons → practice → unit test |
| Feedback | Teacher grades a submission | Instant, auto-graded, retryable |
| Progress | Grades in a gradebook | Completion + mastery per lesson/unit/course |
| Collaboration | Class boards and class forums | Optional Q&A under content |
| Admins | Run classes | Author content and run the platform |

Khan Academy is the reference for the **product model only**, not the UI.

## Docs in this folder

| Doc | Read it for |
|---|---|
| [01-current-problems.md](01-current-problems.md) | Audit: where the code is still classroom-shaped, with file refs |
| [02-target-architecture.md](02-target-architecture.md) | The student-first model mapped onto LearnHouse objects |
| [03-change-list.md](03-change-list.md) | Exact backend / web / admin changes, incl. boards and discussions decisions |
| [04-reuse.md](04-reuse.md) | What stays as-is from LearnHouse (most of it) |
| [05-implementation-order.md](05-implementation-order.md) | The order to do the work, with acceptance checks |

## Decisions on work already shipped (commit `8cf22a29`)

| Shipped item | Decision |
|---|---|
| Course communities gated by **enrollment** (`resource_access.py::_check_course_community_gate`) | **Reversed** (2026-09-14). Gate is now "can read the course". |
| `services/trail/enrollment.py::is_user_enrolled_in_course` | **Keep.** Useful for progress/mastery; no longer an access gate. |
| Communities removed from student top nav, `/communities` → `/dashboard` | **Keep.** Q&A lives under content, not in a global forum list. |
| Dash sidebar: Payments, Domains/SEO/SSO, "Other" removed | **Keep.** |

## Rules for any agent working here

1. Nothing a student needs should depend on a teacher, roster, class, or due date.
2. Access to learning content = the course is published and readable (`public` +
   optional usergroup lock). **Never** add "must be enrolled" as a content gate.
3. Enrollment is a *personal* record ("I started this course"), created by the
   student. It powers progress, not permissions.
4. Reuse LearnHouse objects; add fields/tables only where the doc says so.
5. Dashboard and gamification are **out of scope** until step 4 of
   [05](05-implementation-order.md). `journey/` and `skills/` pages are mock data.

Paths: `api/` = `apps/api/src/`, `web/` = `apps/web/`.
