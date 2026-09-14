# Canvas-Style Refactor: Overview

> This folder replaces `implementation_plan.md` at the repo root. That file has
> stale `/Users/udaykamboj/...` paths and asks whether to purge "org" naming.
> Answer: **no**. Keep `org_id`, `/orgs/` routes, and `app/orgs/[orgslug]`
> internally. Users never see them.
>
> `progress.md` tracks the single-org + student/admin auth work. These docs
> cover what comes after it.

## The problem

StarLab is built on LearnHouse, which is a **cluster of organizations**: many
tenants, each owning its own courses, boards, communities, payments, domains,
and SSO. Almost every feature is scoped to "the org."

We are **one school**, and we want the app to behave like Canvas:

- The **course** is the hub.
- Students see and work inside the courses they're enrolled in.
- Collaboration (discussions, boards) belongs to a course, not to the whole
  platform.
- Admins manage courses, rosters, and content, not tenants.

The earlier work made the org *singular*. The pieces below are still
*org-shaped*: they treat the whole platform as a shared space instead of a set
of courses.

## Target model

```
                  PLATFORM (the one org, resolved by get_platform_org)
                                   │
                 ┌─────────────────┴─────────────────┐
              ADMINS                              STUDENTS
      (role 1–3 / superadmin)                     (role 4)
                 │                                   │
                 └──────────────┬────────────────────┘
                                │
                             COURSES
                                │
      ┌──────────────┬──────────┼─────────────┬──────────────┐
  Chapters /     Assignments  Roster       Discussions     Boards
  Activities                (enrollment)  (1 per course)  (per course)
```

**Rule: anything collaborative is scoped to a course.** A student can only read
or write it if they're enrolled in that course. Admins and course staff can
always access it.

## Where the flow is wrong today

| Area | Doc | One-line summary |
|---|---|---|
| Boards | [01-boards.md](01-boards.md) | Org-wide whiteboards with invite-only membership; no link to courses |
| Discussions | [02-discussions.md](02-discussions.md) | "Communities" are org-wide forums; course link is optional and enrollment is never checked |
| Backend course model | [03-backend-course-model.md](03-backend-course-model.md) | No explicit enrollment/roster API; access is `public`/usergroup-based |
| Admin dashboard | [04-admin-dashboard.md](04-admin-dashboard.md) | Still shows SaaS/tenant surfaces (payments, domains, SSO, billing upsell) |

## Order of work

Do these **before** building the student dashboard and gamification. XP,
streaks, and leaderboards all need a reliable answer to "which courses is this
student in?"

1. Backend course model (enrollment helper + roster API): the others depend on it.
2. Discussions → course-scoped. *(Enrollment gate is already in; see 02.)*
3. Boards → course-scoped (needs a schema migration).
4. Admin dashboard cleanup (nav first, then remove dead routes/APIs).

## How to use these docs with Claude

Hand Claude one doc at a time: "Implement `docs/refactor/02-discussions.md`."
Each doc has **Current state** (with file refs), **Target**, a **Change list**,
and **Acceptance checks**. When a doc is done, tick its checks and add a log
line to `progress.md`.

Paths in these docs are relative to the repo root. `api/` means `apps/api/src/`
and `web/` means `apps/web/`.
