# Single-Organization + Student/Admin Architecture Refactor

## Background

LearnHouse is built on a **multi-tenant, multi-organization** model where users create orgs, select between orgs, and every resource is scoped to an org they created. The request is to refactor to a **single-organization educational platform** with two account types: Student and Admin.

## Good News: Most of the Infrastructure Already Exists

After deep analysis, the existing codebase already has:

- **Role ID 4 = "User" (Student)**: A `TYPE_GLOBAL` role with read-only permissions and `dashboard.action_access = False`. Every new public signup gets this by default (`role_id=4` in `create_user`, `join_org`, `signWithGoogle`).
- **Role ID 1 = "Admin"**: Full permissions + `dashboard.action_access = True`.
- **Role ID 2 = "Maintainer"**: Mid-level, also has dashboard access.
- **Single tenancy mode already exists**: The backend config has `tenancy = "single"` and a `LH_org` cookie that pins to the default org. The middleware already reads this. The `STARLAB_SINGLE_ORG` concept is partially implemented.
- **The seeded org is the default**: When CLI installs, it creates one org and one admin. All subsequent signups join that one org.
- **RBAC authorization is backend-enforced**: The `rbac_check` and `check_resource_access` functions already use the user's role for all resource operations.
- **Admin dashboard gate**: `dashboard.action_access = False` for User (role 4) already prevents the existing admin dashboard from rendering.

## What This Means

The backend is **already a single-org + role system** in single-tenancy mode. The problems are:

1. **Frontend still shows org-creation flows** to all users (hub/new, hub/organizations)
2. **Login/post-auth redirect** doesn't route by role (everyone goes to `/orgs/[slug]/`)
3. **Org creation API (`POST /api/v1/orgs/`)** is open to any authenticated user — students could technically call it
4. **No post-login role-based routing** on the frontend
5. **Nav bar shows org-management links** even to students (partially fixed already)
6. **The home page space issue** (from the previous task — a top space left by a removed navbar)

## Addressed Requirements from Final Architecture

Based on the latest constraints, the plan is finalized around these core rules:
1. **Single Organization:** Users do not create, select, or switch orgs. Backend APIs enforce this.
2. **Two Account Types:** Student (role 4) and Admin (role 1).
3. **Authentication/Routing:** Admin goes to `/admin` and Student goes to `/dashboard`. This is enforced by backend role checks.
4. **Preserve LearnHouse Admin:** The existing course management system is retained for admins.
5. **Database/Backend:** The backend will automatically resolve the `org_id` to the single existing organization for any operations that require it, preventing the need to pass it from the frontend during registration.
6. **Signup:** The public signup creates a student account by default in the single organization. Admins cannot be created via public signup.

## Proposed Changes

### Layer 1 — Backend: Remove Org Creation Entirely

#### [MODIFY] [`orgs.py`](file:///Users/udaykamboj/learnhouse/apps/api/src/routers/orgs/orgs.py)
- The `POST /api/v1/orgs/` endpoint currently allows users to create organizations.
- We will completely **DELETE** this endpoint and its associated creation logic. The single organization will be seeded at database initialization, and no one (not even superadmins) will be able to create new organizations via the API. This structurally guarantees the single-organization model.

---

### Layer 2 — Backend: Auto-Join Default Org on Signup

Currently the signup API requires an explicit `org_id`. In single-org mode, every new signup should always join the one existing org automatically.

#### [MODIFY] [`users.py` router](file:///Users/udaykamboj/learnhouse/apps/api/src/routers/users.py)
- The `POST /api/v1/users/{org_id}` endpoint requires `org_id` to be passed.
- Add a new endpoint `POST /api/v1/users/register` that resolves the default org_id automatically from the database and creates the user with role 4 (Student).
- This ensures public signups ALWAYS default to a student account in the single organization, without the frontend explicitly needing to specify an `org_id`. Admins must be promoted via the admin console or seeded.

#### [MODIFY] [`orgs.py` service](file:///Users/udaykamboj/learnhouse/apps/api/src/services/orgs/orgs.py)
- Add a helper `get_default_org(db_session)` that queries the first organization in the database (since there is only one in this architecture).

---

### Layer 3 — Backend: Role in JWT / Session

The JWT currently carries only `sub` (email). The session endpoint (`GET /users/session`) returns roles. Post-login routing needs to know the role quickly.

#### [MODIFY] [`auth.py` router](file:///Users/udaykamboj/learnhouse/apps/api/src/routers/auth.py)
- After successful login, look up the user's role in the default org.
- Include `user_role` (e.g., `"admin"`, `"student"`) in the login response body (NOT in the JWT itself — keep JWT minimal).
- Frontend uses this to redirect to the correct area.

---

### Layer 4 — Frontend: Post-Login Role-Based Routing

#### [MODIFY] [`login.tsx`](file:///Users/udaykamboj/learnhouse/apps/web/app/auth/login/login.tsx)
- After successful login, inspect the returned user session roles.
- If the user has `dashboard.action_access = true` (role 1 or 2) → redirect to `/admin`.
- If `dashboard.action_access = false` (role 4) → redirect to `/dashboard` (which proxy rewrites to the Learning Universe).

#### [NEW] `useUserRole` hook
- A simple hook/utility that reads the user's role from the session and returns `"admin"` or `"student"`.

---

### Layer 5 — Frontend: Remove Org-Creation Flows

#### [DELETE] [`(hub)/new/`](file:///Users/udaykamboj/learnhouse/apps/web/app/(hub)/new)
- Delete the entire directory responsible for the organization onboarding/creation flow.

#### [DELETE] [`(hub)/organizations/`](file:///Users/udaykamboj/learnhouse/apps/web/app/(hub)/organizations)
- Delete the entire directory responsible for organization switching and management.

#### [MODIFY] [`page.tsx`](file:///Users/udaykamboj/learnhouse/apps/web/app/page.tsx) (root landing)
- Already nicely customized. Keep as-is (it links to `/login` and `/signup`).

---

### Layer 6 — Frontend: Signup Uses Default Org

#### [MODIFY] [`OpenSignup.tsx`](file:///Users/udaykamboj/learnhouse/apps/web/app/auth/signup/OpenSignup.tsx)
- Change the signup API call to use the new `/users/register` endpoint (no org_id required in the form).
- Or: Fetch the default org from `/instance` on mount and use its `id` automatically.
- The signup form should NOT show any org selection.

---

### Layer 7 — Frontend: Top Space Fix (Previous Task)

#### [MODIFY] [`learning-universe.tsx`](file:///Users/udaykamboj/learnhouse/apps/web/components/learning-universe/learning-universe.tsx)
- The homepage has a top padding/margin that was left over from a nav bar that was removed. Set `paddingTop: 0` or `marginTop: 0` at the top-level wrapper.

---

### Layer 8 — Frontend: Student Navigation Cleanup

#### [MODIFY] [`OrgMenuLinks.tsx`](file:///Users/udaykamboj/learnhouse/apps/web/components/Objects/Menus/OrgMenuLinks.tsx)
- Already partially done. Ensure "Journey" and "Skills" remain removed.
- Hide any remaining admin-only links for role-4 users.

---

## Role Mapping Summary

| Role ID | Name | `dashboard.action_access` | Our Label | Goes to |
|---------|------|--------------------------|-----------|---------|
| 1 | Admin | ✅ true | Admin | `/admin` |
| 2 | Maintainer | ✅ true | Admin | `/admin` |
| 3 | Instructor | ✅ true | Admin | `/admin` |
| 4 | User | ❌ false | Student | `/orgs/[slug]/` |

## Verification Plan

### Backend
- `POST /api/v1/orgs/` with a student-role JWT → expect 403
- `POST /api/v1/users/register` with no org_id → user created and joined to default org with role 4
- Login response body includes role indicator

### Frontend
- Login as admin → redirected to `/admin`
- Login as student → redirected to `/dashboard`
- Student visiting `/admin` → redirect (frontend guard + backend 403)
- Signup flow creates a student account automatically
- Hub org-creation flows redirect away

## What We Are NOT Changing

- The existing role/permission database schema (it already works correctly)
- The existing admin dashboard routes
- The existing learning/course delivery system
- The existing JWT/session auth mechanism
- The existing RBAC backend enforcement (it already works correctly for admin vs. student)
- Any database schema migrations. The current schema (`org_id` relations) remains, but the application layer enforces the single-org resolution, meaning we don't have to rewrite the entire LearnHouse backend, honoring the "smallest architectural changes necessary" rule.

---

## Phase 6: Removing 'Org' Terminology (User Requested)

The user has requested to remove references to `orgs` in the naming across the application and keep only what is needed. This represents a massive shift from the original plan (which kept the terminology to avoid breaking things) and touches both the frontend and backend deeply.

### User Review Required

> [!WARNING]
> Renaming `orgs` to something else (e.g., `platform` or removing the prefix entirely) is a massive refactoring effort. `orgs` is baked deeply into:
> - **API endpoints** (`/api/v1/orgs/{org_id}/...`)
> - **Next.js App Router folders** (`apps/web/app/orgs/[orgslug]/...`)
> - **Proxy Re-writes** (`apps/web/proxy.ts` rewrites virtually all routes to `/orgs/{slug}`)
> - **Media URL paths** (`content/orgs/{orgUUID}/...`)
> - **Database Column Names and Types** (`UserOrganization`, `org_id`, etc.)
> - **Hundreds of internal functions and variables**

### Open Questions

> [!IMPORTANT]
> **Are you sure you want to proceed with completely purging 'orgs' from the terminology?**
> 
> **Option A (Recommended):** Keep the internal codebase naming (`org_id`, `/orgs/` API routes, and `apps/web/app/orgs/[orgslug]/` folder structure) as it is. It's invisible to the end user. The user will only see `/dashboard`, `/courses`, etc., due to the proxy rewrites and backend role enforcement.
> 
> **Option B:** Fully rename `orgs` to `platform` (or similar) everywhere in the frontend and backend APIs, but leave the database schema as `organizations` to prevent nasty SQL migration issues. This will take significant time and carries a high risk of breaking existing frontend routing.
>
> Please confirm which option you'd like to pursue!
