# 04: Admin dashboard cleanup

## Current state

`web/components/Dashboard/Menus/DashLeftMenu.tsx` (and `DashMobileMenu.tsx`)
is the LearnHouse tenant-admin sidebar. Besides course tooling it shows:

- **Payments** (`/dash/payments/*`): selling courses per tenant.
- **Developers** → API, automations, **custom domains, SEO, SSO**: per-tenant
  SaaS settings.
- **Billing/premium upsell** block linking to `/billing?org=...`.
- An **"Other"** hover menu advertising disabled features.
- Top-level **Communities** and **Boards** items (org-wide; they should move
  under courses, see 01/02).
- Podcasts and Playgrounds (feature-flagged).

Onboarding, the org switcher, the demo banner, and the danger zone are covered
in `progress.md`.

## Why it's wrong for us

An admin at our school manages courses, content, students, and the platform
settings. They don't sell plans, map custom domains, set up tenant SSO, or get
upsold on premium tiers. These surfaces add clutter, and some of them
(domains, payments) touch backend paths we don't want reachable.

## Target sidebar

| Keep | Change | Remove |
|---|---|---|
| Home, Courses, Assignments, Library | Communities → per-course "Discussions" tab | Payments |
| Users (users, groups, roles, signups, add) | Boards → per-course "Boards" tab | Developers → Domains, SEO, SSO |
| Analytics | Developers → keep API + automations only (decide later) | Billing/premium upsell |
| Platform settings | Podcasts / Playgrounds: behind feature flags, decide later | "Other" disabled-features menu |

## Change list

**Done (this session)**
- [x] Removed the Payments, Developers → Domains/SEO/SSO, and "Other" menu
  entries from `DashLeftMenu.tsx`, and Payments from `DashMobileMenu.tsx`.
- [ ] The billing upsell block in `DashLeftMenu.tsx` is still in the file, but
  it only renders when `multiOrg && plan === 'free'`. Multi-org is off in this
  build, so it never shows. Delete the block (and `UPGRADE_STARS`, `Rocket`,
  `upgradeHovered`) during route cleanup.

**Remaining**
1. Redirect `dash/payments/*`, `dash/developers/{domains,seo,sso}` → `/dash`.
2. Backend: unmount (or admin-404) the payments, custom domains, and SSO routers.
   Check `api/routers/__init__.py` and the `plans.py` / `custom_domains` usage.
   Keep the DB tables (no migration).
3. Move Communities/Boards into the course editor once 01/02 land, then drop
   their top-level nav items.
4. Delete dead components after the redirects have been in place for a while.

## Acceptance checks
- [x] Sidebar shows no payments/domains/SEO/SSO entries (billing upsell is hidden by the multi-org gate).
- [ ] Visiting those URLs directly redirects to `/dash`, and their APIs return 404.
- [ ] `web/tests/admin-authorization-denial.test.mjs` still passes (it lists dash route names).
