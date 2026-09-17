# StarLab Orbital — complete frontend redesign prompt

Copy this entire document into the future implementation task. It is a design specification, not authorization to implement during the current review. The application repository has been left unchanged.

## 1. Assignment and boundaries

Redesign the entire existing StarLab frontend in `apps/web` into one cohesive space-themed learning platform. Apply the **StarLab Orbital** design system below to every existing page, shared component, overlay, responsive variant, and UI state. Deliver a complete product experience, not a decorated homepage.

Preserve existing functionality, content, localization, permissions, feature gates, authentication flows, URL semantics, navigation helpers, query parameters, forms, validation, and data contracts. Do not inspect or change backend architecture, API implementations, databases, authentication internals, or payment logic. Frontend service calls are existing boundaries; restyle their presentation without redesigning their behavior.

Do not invent new working features, populated analytics, XP totals, prerequisites, achievements, purchases, or learner progress. Where current UI uses illustrative data, keep it visibly identified as a preview or omit unsupported statistics. Where an existing destination works, use it; where an action is currently a placeholder, do not dress it up as a completed transaction. Do not invent replacement routes. Keep `/dashboard` and other redirect-only entry points as redirects.

Use the existing UI stack and primitives wherever practical. Follow `apps/web/AGENTS.md`; before writing framework code, read the relevant installed Next.js documentation as instructed there. Do not add a second UI framework, animation engine, or WebGL stack merely for this redesign.

Read the companion audit if available, but this document is the authoritative proposed design. Begin by confirming the frontend route inventory against the current checkout. The appendix lists source routes from snapshot `301975fbd42783d7f0d1846d1e012aabfc911e9a`; cover any routes added since then as well.

## 2. Creative direction

**Concept: an observatory for personal discovery.** StarLab should feel optimistic, intelligent, tactile, and welcoming. Combine astronomical depth with the clarity of a well-designed learning tool. The visual signature is layered blue surfaces, softly illuminated planetary materials, precise orbit lines, generous typography, and controlled bursts of color.

Three expression levels:

1. **Explore:** public landing and learning universe. Large planet artwork, atmospheric depth, optional cinematic motion, prominent next action.
2. **Navigate:** courses, skills, journey, library, podcasts, community, and profiles. Small planetary identifiers, constellation lines, tinted headers, clear cards and lists.
3. **Focus:** lessons, assignments, code, boards, chat transcripts, account, checkout, and admin. Solid reading surfaces, restrained color, minimal background decoration, excellent controls.

These are intensity levels within one design system. Do not create three unrelated themes.

Use meaningful metaphors: course = destination; curriculum sequence = orbit/path; lesson = mission only in supporting copy; earned milestone = mission patch; AI assistance = flight companion. Keep ordinary navigation labels such as Courses, Library, Account, and Billing. Users should never have to decode fictional terminology to complete a task.

Avoid pure-black page defaults, rainbow gradients on every card, neon body text, glows around every control, tiny uppercase interface text, random stock galaxies, heavy glass blur, constantly moving navigation, and a different sci-fi effect on each route. Retain the StarLab name and existing brand assets, with legible light/dark logo variants.

## 3. Color foundations and theme tokens

All application colors must resolve through semantic tokens. Feature components consume roles such as `surface.panel`, `text.secondary`, or `action.primary.background`; they must not choose arbitrary hex colors or depend on gray utility names. Raw values belong in the token definition and art asset configuration only.

### Core palette

| Palette | Shades from light to dark | Role |
| --- | --- | --- |
| Orbital blue | `#F3F6FC`, `#E8EEF8`, `#CAD6E8`, `#8C9FBC`, `#53637A`, `#263A55`, `#17263D`, `#111D30`, `#0B1424` | Canvas, panels, readable hierarchy |
| Aurora teal | `#E0F5F1`, `#B0E8DC`, `#72E3CE`, `#4DD4BC`, `#087F72`, `#006B60` | Primary action and selection |
| Nebula violet | `#F0EAFF`, `#D4C1FF`, `#B8A0FF`, `#8B63D9`, `#6941B8` | Discovery and AI accents |
| Solar amber | `#FFF1D5`, `#FFD78C`, `#F4BD64`, `#B77716`, `#805008` | Earned rewards and milestones |
| Signal blue | `#E8F0FF`, `#BDD0FF`, `#9AB9FF`, `#507CD8`, `#315CA8` | Information and data series |
| Coral | `#FFE8ED`, `#FFBAC8`, `#FF9AAF`, `#D95C79`, `#A82947` | Error/destructive semantics; restrained decorative material |

### Semantic theme pairs

| Token | Dark: Deep Orbit | Light: Day Observatory |
| --- | --- | --- |
| `surface.canvas` | `#0B1424` | `#F3F6FC` |
| `surface.sunken` | `#08101D` | `#E8EEF8` |
| `surface.panel` | `#111D30` | `#FFFFFF` |
| `surface.raised` | `#17263D` | `#FFFFFF` |
| `surface.hover` | `#20324B` | `#E8EEF8` |
| `surface.selected` | `#123A38` | `#DDF3ED` |
| `text.primary` | `#F3F6FC` | `#17263D` |
| `text.secondary` | `#B7C5DA` | `#465A73` |
| `text.muted` | `#95A8C4` | `#53637A` |
| `text.link` | `#72E3CE` | `#006B60` |
| `border.subtle` | `#263A55` | `#D8E0ED` |
| `border.control` | `#657D9E` | `#70839D` |
| `action.primary.background` | `#4DD4BC` | `#006B60` |
| `action.primary.foreground` | `#08241F` | `#FFFFFF` |
| `action.primary.hover` | `#72E3CE` | `#00564D` |
| `action.primary.pressed` | `#2BB59E` | `#00483F` |
| `focus.ring` | `#9AB9FF` | `#315CA8` |
| `accent.discovery` | `#B8A0FF` | `#6941B8` |
| `accent.reward` | `#F4BD64` | `#805008` |
| `status.success.text` | `#72E3CE` | `#006B60` |
| `status.success.surface` | `#123A38` | `#E0F5F1` |
| `status.warning.text` | `#FFD78C` | `#805008` |
| `status.warning.surface` | `#382C19` | `#FFF1D5` |
| `status.error.text` | `#FF9AAF` | `#A82947` |
| `status.error.surface` | `#3B2030` | `#FFE8ED` |
| `status.info.text` | `#9AB9FF` | `#315CA8` |
| `status.info.surface` | `#182E50` | `#E8F0FF` |
| `disabled.background` | `#1C2A3E` | `#E3E9F2` |
| `disabled.foreground` | `#8292AB` | `#63718A` |
| `overlay.scrim` | `rgba(3,8,18,0.72)` | `rgba(16,30,51,0.38)` |

Borders marked subtle are decorative separators, not the sole indication of an input or interactive boundary. Use `border.control` when contrast is required to identify the control. Disabled appearance must also use disabled semantics; do not simply reduce an entire element's opacity.

Secondary buttons use panel/primary text/control border; hover uses surface.hover. Ghost buttons use transparent backgrounds and the same hover fill. Selected tabs use selected surface, primary text, and an explicit indicator. Destructive buttons use a strong red fill (`#A82947` light; `#FF9AAF` dark) and paired foreground (`#FFFFFF` light; `#3B1020` dark), with separately defined hover/pressed shades verified for contrast.

Decorative gradients: dark atmospheric header `#0B1424 → #172844 → #252045`; light atmospheric header `#F3F6FC → #E7F5F3 → #EEE9FC`. Use low-opacity colored light behind artwork, not through text. Normal card bodies stay solid.

### Subject identities

Preserve the useful identities suggested by the existing universe: Foundations/amber, Healthcare/teal, Business/blue, Model building/coral, Arena/violet. These are artwork/category colors, not evidence that each track is live. Pair color with a name, icon, and stable label. Coral artwork must never substitute for an error state; error messages use the semantic status component. Unknown subjects use a deterministic neutral planet, not random color on every render.

Charts use teal, blue, violet, amber, and coral with markers or patterns and a text legend. Use darker corresponding palette shades in light mode. Never encode progress or meaning through color alone.

### Theme behavior and implementation contract

Provide Light, Dark, and System choices in a discoverable Appearance control. First visit follows System; an explicit selection persists. System responds to OS changes. Apply the resolved theme before the first visible paint using the framework-supported approach and set native `color-scheme` consistently. Gracefully handle unavailable preference storage. Theme changes must not reload the page, reset forms, lose chat text, or remount a scene unnecessarily.

Use one root theme owner. Portaled menus, dialogs, tooltips, toasts, native controls, charts, code surfaces, and scene backgrounds must agree with it. Organization branding may customize a validated brand role; it must not overwrite text, status, or surface roles unpredictably. Preserve custom branding options and Arabic font support.

Normalize token color syntax across `globals.css`, `universe.css`, and their consumers. Recommended representation: complete CSS color values consumed with `var(...)`, including corresponding Tailwind mappings. Do not put complete OKLCH values inside an HSL wrapper. Keep adapters only while migrating consumers; remove legacy broad utility overrides once their components use tokens. Do not add more global `!important` recoloring.

Light mode is a first-class composition: pale observatory canvas, navy ink, darker teal actions, violet annotations, and softly lit planets against atmospheric blue. Do not invert photographs, logos, media, or canvas pixels. A bounded cinematic image may remain naturally dark, with its own accessible caption/control layer, while the surrounding application follows the selected theme.

## 4. Typography, geometry, and layout tokens

Use **Space Grotesk** for display and section headings, **Manrope** for interface and reading text, and **DM Mono** for short technical labels and metrics. These extend the existing universe's intended font direction. Actually load the required fonts and connect the variables; naming an unloaded font is insufficient. Keep Tajawal for Arabic with normal tracking, appropriate weights, and logical layout properties. Organization fonts must remain supported with sensible role fallbacks.

| Role | Desktop size/line height | Mobile size/line height | Weight |
| --- | --- | --- | --- |
| Hero | 64/68 px | 40/44 px | 600 |
| Page title | 36/44 px | 28/36 px | 600 |
| Section title | 24/32 px | 22/30 px | 600 |
| Card title | 18/26 px | 18/26 px | 600 |
| Reading body | 17/28 px | 16/26 px | 400 |
| UI body | 15/24 px | 15/24 px | 400/500 |
| Label/button | 14/20 px | 14/20 px | 600 |
| Metadata | 13/20 px | 13/20 px | 400/500 |
| Telemetry | 12/18 px | 12/18 px | 500 |

Use rem-based fluid sizing between endpoints. Hero tracking may be −0.03em, headings −0.02em, body 0. Uppercase telemetry may use +0.06em, never long sentences. Use tabular numbers for progress, time, and tables. Limit paragraphs to roughly 65–72 characters per line. Avoid 9–10 px functional labels present in some existing scene UI.

| Foundation | Tokens |
| --- | --- |
| Spacing | 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 px |
| Radius | 6 px small labels; 10 px controls; 16 px cards; 24 px feature panels; 999 px chips/avatar rings |
| Control height | 44 px standard; 48 px large; 36 px dense desktop with adequate target spacing; touch controls at least 44 px |
| Borders | 1 px normal; 2 px selection; 2 px focus ring with 3 px separation |
| Content widths | 1280 px standard; 1440 px wide dashboards; 760 px reading; 480 px forms |
| Navigation | 64 px desktop header; 56 px mobile header; 240 px optional section sidebar |
| Gutters | 16 px narrow phones; 24 px tablet; 32–48 px desktop |
| Grid | 4 columns mobile, 8 tablet, 12 desktop; 24 px standard gap |
| Breakpoints | 640, 768, 1024, 1280, 1536 px; use content fit between them |

Cards use either a border or restrained elevation, with consistent padding (24 px desktop, 16–20 px mobile). Suggested shadows: light card `0 4px 16px rgba(23,38,61,.06)`; dark card `0 6px 20px rgba(0,0,0,.18)`; light overlay `0 20px 60px rgba(23,38,61,.16)`; dark overlay `0 20px 60px rgba(0,0,0,.40)`. A restrained teal glow belongs only to the selected destination or a short reward moment.

Define named stacking roles: background 0, content 10, sticky 20, navigation 30, dropdown 40, modal backdrop 50, modal 60, tooltip 70, toast 80. Adapt existing editor requirements deliberately. Menus opened inside dialogs must stack within/above that dialog and remain inside its focus handling. Avoid negative scene layers and ad hoc `9999` fixes.

## 5. Shared component system

Build or adapt these reusable components before restyling all pages. Every component needs light/dark, keyboard focus, hover, pressed, selected, disabled, loading, error, and responsive states where applicable.

| Component | Required design and behavior |
| --- | --- |
| App shell | Consistent brand, primary navigation, search, account, Appearance, and utility actions; current location is explicit. Preserve join/MFA banners and focus mode. |
| Page header | Optional breadcrumb/eyebrow, one page heading, short description, one primary action, optional secondary tools. Avoid a second global header. |
| Navigation item | Icon + readable label, selected fill + indicator, reliable focus. Collapse overflow into More; do not render nine tiny dock targets. |
| Buttons | Primary, secondary, ghost, destructive, link; loading retains width and has a meaningful label; icon-only actions have names. One visually dominant action per region. |
| Form fields | Persistent label, optional hint, required indicator, clear border, inline error and recovery. Cover text, password, select, checkbox, radio, switch, upload, date, OTP. Preserve password managers/autofill. |
| Content card | Stable thumbnail ratio, type/subject, title, essential metadata, optional genuine progress, explicit primary link. Avoid nested conflicting click areas. |
| Progress | Linear bar for task completion; labeled ring for compact summary; milestone track for sequence. Show numeric/text values when known, and truthful indeterminate states otherwise. |
| Status badge | Text + icon + paired tint. Available, in progress, completed, locked, draft, error are distinct. Locked has an explanation. |
| Metric tile | Label, value, unit, period/source context if available. No invented trends or celebratory treatment for ordinary counts. |
| Tabs/filter bar | Keyboard-operable tabs; filters with selected values and Clear; query state preserved. Mobile filters use a sheet. |
| Data table | Header, row hover/selection, sorting indication, empty state, loading state, pagination, row actions. Keep meaningful columns accessible on mobile. |
| Dialog/sheet | Solid raised surface, title, concise description, clear close/cancel, bounded scrolling, focus trap and return. Never rely on glass over moving content for legibility. |
| Toast/alert | Unified position and tokens across existing toast libraries; status icon, succinct outcome, recovery action where possible; errors persist long enough to read. |
| Search | Labeled search, clear control, loading/results counts, keyboard access, meaningful no-results state. Shared command palette uses the same system. |
| Empty/error/loading | One small themed illustration or icon, plain-language heading, next action. Skeleton matches final geometry; no endless decorative loading animation. |
| Planet destination | Stable subject artwork, plain course title, status and progress outside canvas, selected state, accessible DOM control and static fallback. |
| Mission patch | Consistent circular or softly hexagonal silhouette, line icon, subject color and textual achievement; awarded and locked states. |
| Media player | Consistent controls, visible focus, accessible scrubber, captions/transcript access where supported. Preserve playback state across ordinary navigation. |
| Chat message | Clear role, readable prose/code, source links when returned, status/error/retry, selectable text. Do not invent citations. |
| Editor toolbar | Same control geometry and tokens; preserve editing shortcuts, menus, selected-node feedback, collaboration cursors, resizing, and saving indicators. |

Use Lucide for general navigation and actions to align with the existing universe; retain specialized brand marks and essential editor icons. Standard icons use 20 or 24 px, approximately 1.75–2 px stroke, and consistent optical weight. Avoid mixing unrelated filled/outlined styles in one toolbar. Tooltips supplement labels, not replace essential information.

## 6. Reusable page templates

**A — Cinematic introduction:** header → two-column hero (copy roughly 45%, art 55%) → product preview → three learning benefits → authentic next action → footer. Mobile puts copy first and bounded artwork below. Keep content meaningful without motion.

**B — Learning command center:** shared header → greeting + Resume action → bounded universe scene with visible destination labels → selected course detail → compact real progress/next steps. Mobile favors a list of destinations; the optional scene comes second.

**C — Discovery/catalog:** page header → search/filter toolbar → responsive card grid/list → pagination → contextual empty state. Three columns desktop where cards remain readable, two tablet, one narrow mobile; large monitors may fit four.

**D — Detail/briefing:** breadcrumb → title/artwork summary → two-column content with main information and action/progress aside → related material. Stack aside below summary on mobile. Sticky actions must not obscure content.

**E — Focus workspace:** compact navigation → primary content area + collapsible outline/context panel → task controls. Opaque surfaces, minimal motion. Use this for lessons, chat, editors, and boards, with appropriate specialized controls.

**F — Settings/operations:** title → section navigation → grouped form panels or data table → explicit save/result state. Sidebar becomes tabs/select on small screens. Dense work gets the same brand typography without cinematic artwork.

**G — Authentication/status:** small brand header → bounded form or status panel → optional observatory illustration → help/legal/language/Appearance. Desktop may split 52/48; mobile stays one column.

All templates use shared title spacing, container widths, button hierarchy, status language, skeleton geometry, and theme roles. Preserve functional differences between pages while eliminating arbitrary visual differences.

## 7. Page-by-page redesign requirements

Paths below refer to frontend source route families. `(withmenu)`, `(hub)`, and `(dashboard)` are route groups, not URL segments. Organization routes may be exposed through host-specific aliases. Preserve the existing routing helpers; do not prepend source path segments to public links blindly.

### Public, entry, and authentication

- **`app/page.tsx` — public landing, template A.** Replace the cream/forest/coral identity with Orbital. Use a concise promise such as “Find your next learning frontier,” existing product capabilities, Start learning and Log in. Place the planned looping observatory video in the artwork region with poster and pause control. Include a truthful preview of courses, practice, and progress; do not fabricate testimonials, adoption counts, or awards. A lower section should explain how a course becomes a learning destination. Match footer/logo/navigation to the app.
- **`app/home/page.tsx` — organization chooser, G/C.** A calm “Choose your learning space” page with organization cards, avatar/logo, access context, existing create/join actions, account/language controls. Theme the entire chooser, its menus, and destructive confirmation dialogs. Preserve empty-account redirects.
- **`app/dashboard/page.tsx`.** Preserve the existing redirect-only entry point. The redesigned learner destination is the organization home, not a second dashboard implementation.
- **Login and signup.** Shared G layout; consistent input hierarchy and social/SSO controls. Preserve organization branding, signup fields, consent, password strength, anti-bot controls, validation, and redirects. Artwork must not displace the form on small screens.
- **Forgot password and reset password.** Same form shell, clear instructions, visible errors and confirmation. Keep real response semantics; avoid suggesting success before it is returned.
- **Magic link and verify email.** Status panel with explanatory text, supported resend/continue actions, pending/success/expired/error presentation. Do not invent a resend timer or action absent from the existing flow.
- **Google callback, SSO callback, token exchange.** Minimal branded transition screen if one is rendered. Preserve automatic redirects. Use compact loading and recoverable error states; never insert a cinematic onboarding delay.
- **Admin login.** Same design system, restrained G layout, clear Admin context. Preserve existing fields and access behavior.

### Learner core

- **Organization home / Learning Universe, B.** Make the scene a navigable learning map. Show one clear Resume/Continue action based on available state; course names remain readable outside the canvas. Selected destination detail includes existing title, progress, and next action. Rework the “My courses” modal into the shared card/list language. Keep a list mode equally functional. Replace the competing global dock/header pattern with one navigation model; a dock may remain only as compact scene controls. Label unavailable actions as coming soon instead of implying a mission launched. Do not present the hardcoded universe course/XP array as live learner data.
- **Skills, C/D.** A discipline selection and enrollment experience. Use subject planet thumbnails, outcomes, existing enrollment status, and explicit enroll/leave controls. Keep prerequisites only where supported by actual UI data. A constellation accent can connect categories, but enrollment must remain a straightforward list/grid task. Theme confirmation and failure states.
- **Journey, D with orbital overview.** Keep the curriculum path concept, but prioritize ordered milestones and a current step. Desktop can offer orbital/linear views; mobile and reduced-motion use the linear view. A black-hole illustration may anchor the header, not overpower the curriculum. Static sample completion/energy must be labeled illustrative. Each node exposes title, status, details, and an existing next action. Do not make a moving node the only way to open details.
- **Courses, C.** Consistent course cards, genuine thumbnails or subject artwork fallback, search, existing metadata, enrollment/progress where available, pagination and empty/loading states. Avoid placing independent animated planets in every card.
- **Course detail, D.** A mission briefing with the real course title, description, author, curriculum, access information, and Start/Resume/Enroll as appropriate. Keep learning objectives readable. Use one course planet in the summary, chapter list below, and a restrained action aside. Preserve community/access/payment sections.
- **Course activity, E.** Give reading and tasks priority. Consistent chapter outline, lesson title, progress, previous/next, and completion controls. Preserve focus mode and share/navigation actions. Restyle every activity type: video and captions/settings; PDF viewer controls; Markdown/rich content and tables; dynamic content/TOC; short answer, quiz, number, form, file and code assignments; AI activity; embedded/resource activities; SCORM wrapper/results when enabled. Keep task validation, autosave, grades, feedback, and resubmission states legible. Never recolor author-provided content or third-party frames globally. Provide appropriate light/dark code syntax themes. No ambient video behind lesson text.
- **Trail, C/D.** Clearly title it as personal learning progress so it is distinguishable from the curriculum Journey. Present enrolled courses, current progress, earned certificates, and existing resume actions. Destructive course removal remains secondary and explicit. A flight-log motif may structure history, without inventing dates or events.
- **Certificate verification, G/D.** Trustworthy verification status, issuer, recipient, course, and existing certificate details/actions. Small mission-patch artwork is sufficient. Valid, invalid, unavailable, and loading must be unambiguous. Certificate print/download surfaces stay clean and legible.
- **Search, C.** Unified results with query, type filters, snippets, clear resource labels, and pagination. Use compact rows where scanning is easier than cards. Preserve current search semantics and no-results recovery. No background scene.

### Content, community, and creation

- **Library, C.** Organized resource grid/list, familiar folder/file icons with modest orbital accents, existing permissions and actions. Consistent resource thumbnails and type metadata. Theme search, upload, picker, preview, sharing, and folder-edit overlays.
- **Library folder, C.** Breadcrumb trail, folder title/description, scoped tools, contents, and empty state. Preserve hierarchy and existing organization actions. Do not replace folder semantics with fictional space terminology.
- **Podcasts, C.** Consistent show cards with artwork, real descriptions and metadata. Optional waveform motif; no autoplay ambient audio.
- **Podcast detail, D.** Artwork + title, episode list, supported subscription/sharing actions, and player. Style the persistent mini-player and reserve layout space for it so it never covers navigation or forms.
- **Playgrounds, C.** Project cards with real previews, language/type metadata if available, and existing creation/open actions. Tint the header as an experimentation area.
- **Playground detail, D/E.** Preview stage, project description, creator, reactions, chat, and existing edit/remix/open affordances. Use a solid frame around untrusted/user-authored preview content; do not force its internal colors.
- **Playground editor, E.** Resizable code/preview/chat panels, file controls if present, clear save/run states, keyboard focus, readable syntax in both modes. Hide decoration. Mobile may switch between panels rather than squeeze them side by side. Preserve functionality even when the editor remains best suited to desktop.
- **Boards index, C.** Board previews with names, access context, and supported actions. Standard card/empty/loading treatment.
- **Organization board detail and standalone `/board/[boarduuid]`, E.** Same board toolbar, canvas surround, breadcrumbs/back action, presence, sharing, and status vocabulary. Preserve standalone/chromeless behavior and board content appearance. Do not add an astronomical background beneath a working board unless it is user-selected content.
- **Board settings: general, thumbnail, access, members, F.** Consistent section navigation, grouped settings, previews, permissions, member rows, and save/error states. “Sharing” remains plainly labeled even when the source subpage is `access`.
- **Communities, C.** Community cards with actual names, descriptions, avatars and membership metadata. Use human content as the visual focus rather than substituting astronaut avatars.
- **Community detail, C/D.** Community header, topic/label filters, discussion list, membership and new-discussion actions, readable sidebar. Mobile tools move into a sheet while the discussion feed remains primary.
- **Discussion detail, D/E.** Readable title, author/time metadata, body, reactions, comments, editor, moderation controls, attachments, and reply states. Retain indentation without crushing mobile text width. Use ordinary reading surfaces and accessible links.
- **Public user profile, D.** Avatar, bio, existing profile content and activity, optional earned badges where present. Use a restrained star-chart cover. Do not invent learner ranks, public streaks, or visibility changes.

### AI surfaces

- **AI Agent / ASTRA, E.** Small companion identity and useful starter questions above a generous conversation area. Use violet as a supporting accent, primary teal for actions. Replace tiny telemetry text with readable role/status labels. The existing shader may become a bounded header accent; it must not animate under the transcript. Keep messages selectable, preserve input on failure where feasible without changing service behavior, provide clear retry, and avoid auto-scrolling users away from older messages they are reading. Do not claim “online” from a decorative status if availability is unknown.
- **Copilot, E.** Use the same chat primitives and identity language while preserving its distinct course-context features and conversation history. Style context selection, source cards, messages, markdown, code, errors, and suggestions. Do not merge its behavior with AI Agent or change service contracts.
- **Copilot bubble.** Match the full chat surface; reachable close/minimize, appropriate focus, safe mobile dimensions, no conflict with podcast player, toasts, or bottom navigation.

### Commerce and accounts

- **Store, C.** Resource offers with existing prices/currencies/billing terms and included content. Treat money as money, not XP or fuel. Color helps category distinction without making every card look promoted.
- **Offer detail, D.** Clear title, contents, price, billing interval where applicable, eligibility/ownership, and purchase action. Keep resource links and payment error/loading states. A compact subject illustration is optional; no video beside purchase confirmation.
- **Organization account root.** Preserve existing redirect/default section behavior.
- **Account/general, F.** Profile/account preferences and localization controls grouped clearly; add Appearance through the shared system without disturbing other settings.
- **Account/profile, F.** Theme the existing profile builder, previews, media controls, and saving feedback.
- **Account/security, F.** Password/authentication controls and existing security states use plain language, readable explanations, and explicit confirmations. No playful mission language.
- **Account/purchases, F.** Purchase rows/cards with real dates, prices, statuses, and existing receipt/access actions.
- **Hub account, F.** Same foundations while preserving platform-vs-organization context. Group general/security/delete actions; keep destructive settings visually separate.
- **Hub billing, F.** Plan/usage summary, invoice history, pricing grid, add-ons, upgrade/switch wizard, promo fields, and success/error panels share tokens. Keep amounts, intervals, and confirmation details prominent. Do not alter calculations or payment behavior.
- **Hub subscriptions, F.** Readable subscription list with plan, organization/context, amount, status and available actions. Explain empty state through supported next steps.
- **Stripe connect OAuth return.** Theme only any existing transition/error UI. Preserve redirect behavior and never manufacture a successful connection state.

### Administration and cross-cutting surfaces

- **Admin home, F.** Clear operational overview and existing navigation tiles. Space identity is confined to typography, palette, and a small header mark.
- **Admin users, F.** Searchable/scannable user interface, existing filters/actions, dialogs, pagination, and states. Keep role/access badges explicit.
- **Admin analytics, F.** Theme all chart axes, legends, tooltip surfaces, tables and time filters. Do not invent metrics; provide data-empty and unavailable states.
- **Admin developers, F.** Theme the existing developer controls and documentation/credential displays without changing their behavior or revealing masked values.
- **Additional existing management components.** Apply F to any reachable course management/monitoring, podcast episode/general/distribution, community moderation, organization branding/images/menu/landing/social/SEO/general, domains/SSO/API access/AI/automation/usage/audit/danger-zone, user access/security/analytics, payment configuration/customers/offers/groups, and upload/import dialogs. A component file is not proof of a separate active route: locate its existing frontend caller, style it there, and do not create routes merely to expose it.
- **Embedded activity and embed layout, E.** Retain minimal/chromeless navigation and explicit background query behavior. Use the same lesson controls at small embed sizes; preserve host-content boundaries and avoid overriding embedded documents.
- **404, route errors, global errors, loading boundaries, G.** A small lost-signal/observatory illustration, plain explanation, actual retry/back/home action. Global errors must remain readable even if the main providers/styles fail. Skeletons and error cards match their destination template in both themes.
- **All shared overlays.** Include account menu, language/Appearance, search/command palette, feedback, profile popups, upgrade/paywall/feature gates, confirmation dialogs, image pickers, captions, sharing, onboarding/signup field panels, background-task progress, and notices. Preserve feature visibility and access restrictions.

## 8. Looping video art direction and asset contract

The user plans to supply a loop. Design the layout so it works with a static poster now and can accept the final video without restructuring the page. Do not add a broken placeholder URL or download arbitrary stock footage. Suggested future asset names are contractual placeholders, not files that already exist.

**Video brief:** a slow observatory view above a softly lit blue planet. Warm amber rim light on the horizon, a restrained violet nebula, sparse fine stars, and one gentle orbital arc. No text, logos, UI, hard cuts, explosions, flashing, rapid zoom, or camera roll. Place the planet toward the right on desktop and below the copy on mobile. Reserve approximately 45% quiet negative space for desktop copy, while keeping the focal subject inside the mobile-safe crop. Produce a seamless 12–16 second loop with matching start/end framing and luminance. The still frame must be attractive on its own.

Deliverables for the media creator: desktop 16:9 master, mobile crop/composition, dark and light grade if needed, optimized WebM and MP4 exports, and matched AVIF/WebP posters. Example names: `orbital-hero-dark.webm`, `orbital-hero-dark.mp4`, `orbital-hero-light.webm`, corresponding mobile variants and posters. Keep files locally hosted through the product's existing asset process.

Placement: public landing art region by default; optional bounded universe backdrop only if the foreground uses static artwork. Do not run a hero video and a busy 3D scene simultaneously in the same visual region. Do not repeat the video across catalog cards, lesson pages, auth forms, billing, or admin.

Playback: muted, inline, looping, with a visible keyboard-accessible Pause motion/Play motion control. Poster is shown immediately, dimensions reserved, video enhancement loads after core content. Autoplay denial, slow network, missing media, or failed decoding must leave the complete poster composition intact. Reduced motion and user-disabled ambient motion use a poster and must not request the decorative video unnecessarily. Pause when offscreen or the tab is hidden.

Initial asset budgets, to be verified on representative devices: poster ≤200 KB desktop/≤120 KB mobile; loop ≤4 MB desktop/≤2 MB mobile, preferably 720p–1080p at 24 fps. These are design budgets, not measured existing performance. Avoid preloading both theme variants. Do not sacrifice readability or core page loading to reach a cinematic effect.

## 9. 3D planets and spatial illustration system

Evolve the existing React Three Fiber/Three.js scene. Use a consistent camera, material language, light direction, scale, and atmosphere across planets. Each destination should look crafted: mineral/cloud surface detail, subtle terminator, restrained atmospheric rim, and a subject-specific palette. Avoid identical glossy balls distinguished only by color.

Foundations: ochre mineral world with a broad stable ring. Healthcare: teal oceanic world with soft cloud bands. Business: blue world with structured surface bands. Model building: coral volcanic/mineral world. Arena: violet crystalline world. These are art directions for the existing conceptual subjects, not permission to create functioning courses.

Interaction: selecting a planet highlights its DOM label and detail panel; hovering gives restrained outline/scale feedback; keyboard focus has equivalent emphasis. Use click/tap to select and a separate explicit action to enter the course. Locked planets remain inspectable so their state can be explained. Never put essential labels, progress values, or hit targets only inside WebGL.

List mode offers the same destinations, status, and actions. On mobile, default to this mode with optional Explore in 3D. Provide static planet thumbnails when WebGL is unavailable, lost, slow, or disabled. The fallback must remain functional and visually complete.

Motion: rotation roughly one turn per 60–120 seconds; bobbing optional and very slight; no continuous camera orbit during normal interaction. Global reduced-motion and ambient-motion preferences stop planet rotation, bobbing, star drift, shaders, and orbital timelines. Existing reduced-motion handling must be extended to individual Planet frame callbacks, not just the constellation parent. Changes to the OS preference should apply while the page is open.

Rendering budgets: one active WebGL canvas per viewport; lazy-load the scene; cap effective DPR around 1–1.5; suspend frames offscreen/hidden; use static thumbnails in lists; avoid heavy post-processing; start with ≤100k visible triangles and ≤4 MB compressed scene assets, then profile. Aim for at least 30 fps on a representative midrange phone for the optional scene; reduce detail or fall back if it cannot meet that target. Dispose resources on teardown and handle context loss. No infinite render loop after navigation.

Asset package for each planet: optimized model/textures if a model replaces procedural geometry, transparent poster thumbnail, light/dark composited hero image if needed, subject label and stable identifier, and usage/licensing record. The main interface must ship without waiting for these assets by using polished procedural/static fallbacks.

## 10. Motion, responsive behavior, and accessibility

Motion tokens: 120 ms control feedback, 180 ms state transition, 240 ms panel entrance, 400 ms one-time success emphasis; ease-out `cubic-bezier(.2,.8,.2,1)`. Translate panels no more than 8 px and avoid layout-moving hover effects. Ordinary route changes should not trigger a cinematic sequence. Reduced motion replaces spatial movement with immediate state changes or brief nonessential opacity changes.

At narrow widths, prioritize next action, content, then illustration. Collapse secondary sidebars into named drawers/sheets, keep titles wrapping naturally, and ensure sticky header/player/composer/bottom controls account for safe-area insets and each other. Avoid fixed viewport heights that clip auth forms or chat when the software keyboard opens. Long translations and 200% zoom must fit without obscured controls. Use logical properties for RTL; do not mirror media or scientific/code content indiscriminately.

Accessibility target: WCAG 2.2 AA. Verify normal text at 4.5:1, large text at 3:1, and required non-text indicators at 3:1 against adjacent colors. Test actual composited surfaces, especially video overlays and translucent controls. Every interactive destination needs keyboard access and visible focus. Use semantic headings, landmarks, labels, accessible names, error association, and status announcements. Preserve readable text selection and working editor focus. Do not remove outlines without an equivalent visible indicator. See the [W3C WCAG 2.2 specification](https://www.w3.org/TR/WCAG22/).

Provide a pause mechanism for persistent ambient movement; do not rely only on OS reduced-motion preferences. The product also chooses to disable nonessential interaction animation in reduced-motion mode. See [W3C guidance on Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html). Avoid flashing effects altogether.

Prefer standard DOM controls around the 3D scene, screen-reader descriptions of the destination list, meaningful alt text for informative artwork, and hidden semantics for purely decorative stars. All error/locked/completed states need words or icons as well as color. Do not announce continuous progress or animation frames to assistive technology.

Font reference: [Space Grotesk's official project](https://floriankarsten.github.io/space-grotesk/). Verify font files and licensing at asset intake, retain license notices, and load only necessary weights/subsets. Typography choices here are design recommendations rather than claims about fonts already loaded by the application.

## 11. Implementation sequence and acceptance criteria

1. Inventory current frontend routes, shared shells, overlays, UI state variants, and active management component callers. Record source path, page template, light/dark status, mobile status, and verification evidence. Preserve redirect-only paths.
2. Establish the semantic tokens, font loading, Appearance control, root theme behavior, and shared primitives. Fix mixed token formats and theme ownership before adding more artwork.
3. Implement three representative screens first: public landing, learner universe, and course activity. Together they prove Explore, Navigate, and Focus intensity; validate each in light and dark at desktop and phone sizes.
4. Migrate every route family in section 7 and the appendix. Include portals, loading/error/empty/permission states, editors, embedded pages, and inactive-but-shared components where their active callers use them.
5. Integrate optimized video/3D only after static composition and accessibility work. Ship complete fallbacks if final media is unavailable; report pending production assets explicitly.
6. Run frontend-appropriate checks and visual review. Use the repository's strict lint command when available; do not treat a command that swallows lint failures as proof of correctness. Do not start backend services solely for this design work. Use existing frontend fixtures for inaccessible states without altering production data behavior.

Acceptance checklist:

- Every existing page is either redesigned with a named template or explicitly recorded as a redirect/no-UI route; no route silently omitted.
- All semantic tokens have both themes. No light-only white cards, forced-white admin text, invalid color wrappers, or global gray-to-dark patches remain in migrated application chrome.
- Light and dark screenshots are checked at approximately 390, 768, 1440, and 1920 px, with a 320 px reflow check and a separate 200% zoom check. Wide tables/editors use intentional internal scrolling rather than accidental page overflow.
- Representative states include new learner/no courses, populated dashboard, completed/locked destination, no results, pending request, failed request, invalid form, permission denied, unavailable media, open dialog/menu, and long localized text.
- Main flows still work: entry/login, course search/open, enroll where supported, resume/activity navigation, assignment editing, profile/settings, existing store flow, and existing admin controls. Verify with safe test data; do not make real purchases or change real account permissions for visual QA.
- Theme persists across navigation and reload without obvious flashing; System follows OS; overlays and charts match; RTL remains usable.
- Keyboard traversal, focus return, form errors, screen-reader labels, contrast, and motion controls are checked. Automated checks supplement visual/manual review.
- The learning map is usable without WebGL; landing works without video; content renders without web fonts; reduced motion stops every ambient layer.
- Measure frontend performance on representative hardware/network. Aim for LCP ≤2.5 s, CLS ≤0.1, and INP ≤200 ms where measurable; report the measurement method and limitations. Do not claim field performance from a single lab test.
- No service contracts, backend architecture, access rules, or payment behavior changed. No fabricated learner data is presented as live.

Deliver a concise change report with screenshots of representative pages in both themes, completed route coverage, checks performed, known limitations, and any final assets still required. Include a frontend component/token reference that future pages can follow. Completion means a consistent product across the route inventory, not just a polished hero.

## Appendix — source route manifest

The manifest below was generated from the cloned frontend. Source paths identify coverage; they are not a replacement public URL scheme.

Total page entry files: **52**.

| Frontend source page | Coverage |
| --- | --- |
| `app/(hub)/account/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/(hub)/billing/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/(hub)/subscriptions/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/admin/(dashboard)/analytics/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/admin/(dashboard)/developers/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/admin/(dashboard)/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/admin/(dashboard)/users/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/admin/login/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/auth/callback/google/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/auth/forgot/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/auth/login/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/auth/magic/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/auth/reset/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/auth/signup/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/auth/sso/callback/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/auth/token-exchange/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/auth/verify-email/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/board/[boarduuid]/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/dashboard/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/editor/playground/[playgrounduuid]/edit/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/embed/[orgslug]/course/[courseuuid]/activity/[activityid]/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/home/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/account/[subpage]/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/account/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/ai-agent/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/boards/[boarduuid]/[subpage]/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/boards/[boarduuid]/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/boards/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/certificates/[uuid]/verify/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/communities/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/community/[communityuuid]/discussion/[discussionuuid]/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/community/[communityuuid]/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/copilot/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/activity/[activityid]/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/courses/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/journey/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/library/folder/[folderid]/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/library/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/playground/[playgrounduuid]/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/playgrounds/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/podcast/[podcastuuid]/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/podcasts/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/search/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/skills/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/store/offers/[offerid]/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/store/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/trail/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/orgs/[orgslug]/(withmenu)/user/[username]/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |
| `app/payments/stripe/connect/oauth/page.tsx` | Required; apply section 7 and preserve redirect-only behavior where applicable. |

### State boundary files

Apply the destination template to loading/error states and template G to standalone status screens.

- `app/board/[boarduuid]/loading.tsx`
- `app/error.tsx`
- `app/global-error.tsx`
- `app/not-found.tsx`
- `app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/activity/[activityid]/error.tsx`
- `app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/activity/[activityid]/loading.tsx`
- `app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/error.tsx`
- `app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/loading.tsx`
- `app/orgs/[orgslug]/(withmenu)/courses/error.tsx`
- `app/orgs/[orgslug]/(withmenu)/courses/loading.tsx`
- `app/orgs/[orgslug]/(withmenu)/error.tsx`
- `app/orgs/[orgslug]/(withmenu)/loading.tsx`
- `app/orgs/[orgslug]/(withmenu)/trail/loading.tsx`
