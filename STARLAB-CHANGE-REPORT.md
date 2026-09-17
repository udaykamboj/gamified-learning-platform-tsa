# StarLab Orbital — Frontend Change Report

Scope: `apps/web` only. No API contracts, access rules, payment behavior or backend code changed.
Branch: `dev`. Commits: `775b0bb0` → `982a15d3` (8 commits).

## 1. What changed

**Foundation (`styles/orbital.css`)**
- Semantic tokens (`--sl-*`) for Day Observatory (light) and Deep Orbit (dark). They are defined on `:root`/`[data-theme=light]`/`.sl-theme-light` and on `.dark`/`[data-theme=dark]`/`.sl-theme-dark`.
- Tailwind v4 `@theme inline` maps shadcn roles (background, card, primary…) and Orbital roles (canvas, panel, line, link, action, success/warning/error/info plus their surfaces, scrim, discovery, reward) onto those tokens.
- The gray/neutral/slate/zinc/stone ramps re-point to a theme-aware neutral ramp. The chromatic ramps collapse onto the five Orbital hues. Legacy utilities therefore follow the theme instead of forcing light-only colors.
- Removed:
  - the invalid `hsl(var(--x))` token wrappers
  - the hard-coded root `dark` class
  - the OS-dark body bug
  - the global `!important` dark patches
  - 194 double-inverting `dark:` utilities
- Fonts via `next/font`: Manrope (UI), Space Grotesk (display), DM Mono (telemetry), Tajawal (Arabic).
- Appearance: Light / Dark / System.
  - A pre-paint script (`public/theme-init.js`) applies the theme before first paint.
  - Preference is managed by `ThemeProvider` and stored under the `starlab-appearance` key.
  - The toggle lives in the account menu, the mobile menu and the admin header.

**Shared components**
- shadcn primitives restyled on tokens: button, card, input, textarea, select, dialog, dropdown, tabs, tooltip, popover, table, alert-dialog, sheet, checkbox, badge.
- New shared components:
  - `EmptyState`
  - `SearchField`
  - `SubjectArtwork`: deterministic planet art that stands in for missing thumbnails.
  - `ObservatoryArt`: landing poster.
  - `AppearanceToggle`.
- Class primitives: `sl-card`, `sl-card-interactive`, `sl-input`, `sl-btn` (primary/secondary/ghost/destructive, `sl-btn-sm`), `sl-badge` (success/warning/error/info), `sl-telemetry`, `sl-page-title`, `sl-section-title`, `sl-atmosphere`.
- 62 ad-hoc `bg-card + nice-shadow + rounded-*` panels now use `sl-card`, so every panel shares one radius, border and elevation. Floating popovers keep a compact radius.

**Pages rebuilt or restyled**
- **Landing:** rebuilt as template A.
- **Auth:** login, signup, forgot, reset, verify, admin login, magic link, Google/SSO callbacks and Stripe OAuth use templates G/auth.
- **Learner:**
  - Learner universe (template B): bounded canvas, DOM destination chips, list view, pause control and a static fallback.
  - Catalogs: courses, library, podcasts, playgrounds, boards, communities, search.
  - Course detail and lesson/activity (template E): header hierarchy, assignment and quiz tasks, Previous/Status/Next tiles.
  - Skills, journey, trail, AI companion, copilot, public profile, account settings.
- **Board:** board settings (template F) and board canvas (pinned light).
- **Admin console:** overview, users, analytics, developers.
- **Error and status:** 404, global error boundary, embed fallback.

**Functional fixes found during QA (frontend only)**
- **Admin portal login loop:** the auth proxy now forwards the admin cookie names, and admin pages refresh through the admin endpoint.
- **Link buttons rendered dark text on teal:** the anchor color reset moved into the base layer.
- **Quiz option selection:** the row now shows a selected state and a real radio/checkbox indicator. The old × on unselected options looked like a wrong-answer verdict.
- **Board access card:** content was off-center because of an `h full` class typo.

## 2. Route coverage

Status key:
- **Verified**: screenshot reviewed in the running app.
- **Styled**: code migrated but not rendered, usually because no seed data exists.
- **Redirect**: no UI of its own.

| Source page | Template | Status | Notes |
| --- | --- | --- | --- |
| `app/page.tsx` | A | Verified L/D | Signed-in users are redirected to the org home. |
| `app/dashboard/page.tsx` | — | Redirect | Proxy rewrites to the learner home. |
| `app/home/page.tsx` | C | Styled | Org chooser; in single tenancy `/home` resolves to the default org home. |
| `app/(hub)/account/page.tsx` | F | Styled | Hub routes are multi-tenant only. |
| `app/(hub)/billing/page.tsx` | F | Gated | Shows the new 404 in single tenancy. |
| `app/(hub)/subscriptions/page.tsx` | F | Gated | Redirects to the learner home in single tenancy. |
| `app/auth/login` · `signup` · `forgot` · `reset` · `verify-email` | G | Verified L/D | |
| `app/auth/magic/page.tsx` | G | Verified D | Missing-token state. |
| `app/auth/sso/callback/page.tsx` | G | Verified D | Missing-params state. |
| `app/auth/callback/google/page.tsx` | G | Styled | Google OAuth isn't configured locally. |
| `app/auth/token-exchange/page.tsx` | G | Styled | No legacy classes. |
| `app/admin/login/page.tsx` | G | Verified L/D | |
| `app/admin/(dashboard)/page.tsx` · `users` · `analytics` · `developers` | F | Verified L/D | The EE tokens endpoint returns 404 locally, so the empty state is shown. |
| `app/board/[boarduuid]/page.tsx` | E (light canvas) | Verified | Collab server not running ("Reconnecting"). |
| `app/editor/playground/[playgrounduuid]/edit/page.tsx` | E | Styled | No playground records. |
| `app/embed/.../activity/[activityid]/page.tsx` | E | Partially verified | See limitation 3. |
| `app/payments/stripe/connect/oauth/page.tsx` | G | Styled | |
| `(withmenu)/page.tsx` (learner home) | B | Verified L/D, 390, 320 | Map and list views. |
| `(withmenu)/courses` · `course/[courseuuid]` | C / D | Verified L/D, 390, 320 | |
| `(withmenu)/course/.../activity/[activityid]` | E | Verified L/D, 320 | Dynamic page and assignment/quiz. |
| `(withmenu)/skills` · `journey` · `trail` · `search` | C / B | Verified L/D, 320 | |
| `(withmenu)/library` · `library/folder/[folderid]` | C | Library verified; folder styled | No folders in seed data. |
| `(withmenu)/podcasts` · `podcast/[podcastuuid]` | C / D | List verified; detail styled | No podcasts. |
| `(withmenu)/playgrounds` · `playground/[playgrounduuid]` | C / D | List verified; detail styled | No playgrounds. |
| `(withmenu)/boards` · `boards/[boarduuid]` · `boards/[boarduuid]/[subpage]` | C / F | Verified L/D, 320 | Test board "Design QA board" created for QA. |
| `(withmenu)/communities` · `community/[communityuuid]` | C / D | Verified L/D, 320 | |
| `(withmenu)/community/.../discussion/[discussionuuid]` | D | Styled | No discussions. |
| `(withmenu)/certificates/[uuid]/verify` | G | Styled | No certificates issued. |
| `(withmenu)/copilot` · `ai-agent` | E | Verified L/D, 320 | |
| `(withmenu)/account` · `account/[subpage]` | F | General and security verified L/D, 320 | Profile and purchases styled. |
| `(withmenu)/user/[username]` | D | Verified L/D | |
| `(withmenu)/store` · `store/offers/[offerid]` | C / D | Gated | Store feature is disabled, so it redirects. |
| `app/not-found.tsx`, `app/global-error.tsx`, `error.tsx`, `loading.tsx` boundaries | G | 404 verified L/D; others styled | |

## 3. Checks performed

- **Visual review:** screenshots in light and dark for every "Verified" route at desktop (~800–1280 px pane) plus 390 px for home, menu, courses and course detail.
- **320 px reflow:** `scrollWidth` measured at 320 px on 13 routes, with no horizontal page overflow:
  - home, courses, lesson, skills, journey, search
  - board settings
  - communities, library, account, AI companion
  - forgot password
- **Typecheck:** `tsc --noEmit` reports no errors in any changed file. The remaining errors predate this work; they were confirmed against a clean base worktree.
- **Flows exercised:** admin login, student login, catalog → course → lesson navigation, quiz answer selection with auto-save, board creation and settings tabs, theme switching with reload persistence.

## 4. Known limitations (honest)

1. **Not done:**
   - A separate 200% browser-zoom pass (the 320 px reflow check covers the same layout range at desktop widths).
   - An RTL walkthrough (logical properties were preserved but not visually checked in Arabic).
   - Lighthouse/LCP/CLS/INP measurement.
   - Automated contrast/axe runs.
2. **Unverified content types:** the seed data contains only dynamic pages and quiz assignments. Video, PDF, markdown, code, file, form, number and short-answer tasks were migrated to the shared primitives without being rendered. The teacher task-editing view has no route in this app.
3. **Embed renders blank for seeded pages:** tiptap reports invalid content (`Unknown node type: undefined`), and the content stays at opacity 0. This comes from the content/renderer, not styling; the normal lesson page renders the same activity correctly.
4. **Gated routes:**
   - Multi-tenant hub routes (`/home` chooser, `/account`, `/billing`, `/subscriptions`) can't be reached locally, because multi-tenancy rejects a `localhost` domain and `lvh.me` doesn't resolve on this machine.
   - The store is feature-gated.
5. **Test data:** the local database now holds a private test board ("Design QA board") and a saved quiz answer for the test student. Delete the board from its card menu if you don't want it.

## 5. Pending production assets

- Hero loop video (spec §8): `orbital-hero-{dark,light}.{webm,mp4}` plus mobile variants and AVIF/WebP posters. The landing currently ships the static `ObservatoryArt` poster composition.
- Per-planet crafted models/textures (spec §9). The universe uses the procedural planets, with `SubjectArtwork` as the static fallback.

## 6. Component and token reference (for new pages)

| Need | Use |
| --- | --- |
| Page container | `mx-auto max-w-[1280px] px-4 md:px-6 xl:px-8` (admin: `max-w-[1440px]`), or `GeneralWrapperStyled` |
| Page title / section title | `sl-page-title` / `sl-section-title` (Space Grotesk) |
| Eyebrow / label / metadata | `sl-telemetry` (DM Mono 12px, short labels only) · `text-meta` |
| Body text | `text-ui` (15/24) · `text-reading` (17/28, long-form) |
| Panel | `sl-card` (16px radius, `--sl-line` border, card shadow); add `sl-card-interactive` for clickable cards |
| Nested / secondary panel | `rounded-xl border border-border bg-muted/40` |
| Buttons | `sl-btn sl-btn-primary` · `-secondary` · `-ghost` · `-destructive`; add `sl-btn-sm` in dense tool rows |
| Inputs | `sl-input` (also on `textarea`/`select`) |
| Status pill | `sl-badge` + `sl-badge-success` / `-warning` / `-error` / `-info` |
| Status surfaces | `bg-success-surface text-success border-success/30` (same pattern for warning, error, info) |
| Selected state | `border-primary bg-selected` |
| Hover | `hover:bg-hover` (never shadow jumps or scale) |
| Links | `text-link` |
| Empty / no results | `EmptyState` |
| Search box | `SearchField` |
| Missing thumbnail | `<SubjectArtwork seed={uuid} />` |
| Region pinned to one theme | `sl-theme-light` / `sl-theme-dark` (certificates, whiteboard) |
| Radii | sm 6 · md/lg 10 (controls) · xl/2xl 16 (cards) · 3xl 24 (dialogs) |
| Elevation | `shadow-card`, `shadow-card-hover`, `shadow-overlay` |

Avoid:
- raw hex colors
- `bg-white` / `text-black`
- `font-black`
- sub-12px text
- new `dark:` overrides (tokens already switch)
- `nice-shadow` on new work (use `sl-card`)
