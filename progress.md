# Single-Organization + Student/Admin Refactor — Progress Log

This file tracks the refactor described in `prompt.md` (kept untracked on purpose:
it contains a local admin password). Anyone picking this up should read this
file top to bottom first.

## Goal (short version)

- One permanent organization. Nobody creates, selects, or switches orgs. The
  backend enforces it; the UI doesn't just hide it.
- Two account types on the existing role system:
  - **Student**: the default "User" role (role id 4). Takes courses, tracks
    progress, edits their profile. No authoring, no admin APIs.
  - **Admin**: manages courses, content, and students through the existing
    LearnHouse course-management dashboard, plus the superadmin console.
- Login routing: student → `/dashboard`, admin → `/admin`. `/admin` shows a
  chooser with two boxes: **Course management** (the org dash) and
  **Platform console** (the superadmin console).
- Students are rejected from `/admin` and admin APIs by the backend.
- The student area belongs to students. Admins don't get an "admin" badge or a
  "Dashboard → onboarding" path in there.
- Public signup always creates a student in the single org. Admins come from
  the seed or a protected promotion path.

## Status

| Phase | State |
|---|---|
| 0. Orientation + baseline tests | in progress |
| 1. Architecture map (workflow) | in progress |
| 2. Design | not started |
| 3. Backend: single-org enforcement | not started |
| 4. Backend: role model + admin authorization | not started |
| 5. Frontend: routing / admin chooser / student-only area | not started |
| 6. Frontend: remove org onboarding/creation/switching remnants | not started |
| 7. Tests + verification | not started |

## Log

### Session 1 (2026-09-13)

- The repo already had a partial attempt in commit `9a53e87d` ("Update project
  files"). It deleted `app/(hub)/new` and `app/(hub)/organizations`, removed
  `POST /orgs/` and `POST /orgs/withconfig/`, added `POST /users/register`,
  `services/auth/roles.ts`, and `app/hooks/useUserRole.ts`, and made the web EE
  gate for `/admin` never block. I'm reviewing those changes rather than
  trusting them. So far: the backend `require_superadmin` still calls
  `ensure_ee_superadmin_surface()`, which returns 403 in OSS mode, so the
  `/admin` console renders but its API calls would fail.
- Local tooling: Docker/Postgres aren't available on this machine. API tests
  run on in-memory SQLite. Deps are installed in a scratch venv
  (Python 3.14.6; the project pins 3.14.7) and web deps come from `bun install`.
- Baseline on the untouched code: web `bun test tests` gives 277 pass and 1 fail
  (`url-security.test.mjs`: `getUriWithOrg` returns `/dashboard`, a regression
  from the earlier partial commit). The API suite is still running.

## How to verify locally

```bash
# API tests (in-memory SQLite)
cd apps/api && uv run pytest src/tests -q
# Web unit tests
cd apps/web && bun test tests
```
