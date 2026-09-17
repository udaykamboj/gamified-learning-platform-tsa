# StarLab frontend review

Reviewed repository: https://github.com/udaykamboj/gamified-learning-platform-tsa

Snapshot: `301975fbd42783d7f0d1846d1e012aabfc911e9a`.

Scope: frontend route inventory, layouts, CSS, UI components, existing scene code, and public asset filenames in `apps/web`. No backend architecture review. This is a source-based design assessment, not a browser-verified audit of authenticated pages. No dependencies were installed and no application code was changed. The companion `STARLAB-REDESIGN-PROMPT.md` is the proposed design system and future implementation brief.

## Main finding

StarLab has several competing visual systems. Adding more planets alone would not resolve the mismatch. Shared typography, surface hierarchy, navigation, interaction states, and theme semantics need to connect the space scenes to everyday learning screens.

| Finding | Frontend evidence | Design consequence |
| --- | --- | --- |
| Public identity differs from learner identity | `apps/web/app/page.tsx` uses cream `#f4f1ea`, forest `#183f35`, and coral `#e8794f`, with rotated editorial cards. | The public page does not establish the visual vocabulary used by the learning universe. |
| Dark mode is baked into the root | `apps/web/app/layout.tsx` puts `dark` directly on the root element. A targeted search of app/components/lib/public did not identify a conventional shared theme toggle implementation. | Define an explicit light/dark/system preference and a consistent first-paint strategy. Runtime behavior still needs verification. |
| Theme token formats conflict | `styles/globals.css` maps tokens through `hsl(var(--background))` and similar expressions, while `styles/universe.css` assigns complete `oklch(...)` values to those same variables. | Consumers can form invalid expressions such as `hsl(oklch(...))`. Migrate the producer and consumer formats together. |
| The universe has no genuinely light default | `.learning-universe-theme` starts with a dark background; `.dark .learning-universe-theme` changes several colors toward neutral tones. | Light mode needs an intentionally designed scene and surface palette. |
| Global patches substitute for component theming | End of `globals.css` overrides white/gray utility classes under `.dark .lh-org-font-root` using `!important`. Earlier OS-dark CSS sets body text black and its background near white. | Cascading exceptions can flatten hierarchy and produce inconsistent combinations. Replace them with semantic component tokens. |
| Several font systems coexist | Root loads Wix Madefor Text and Tajawal; universe CSS declares Manrope, Space Grotesk, and DM Mono; skills/agent screens use inline font names; editors have their own defaults. | Select and actually load the shared families, retain Arabic typography, and distinguish reading text from display/telemetry text. |
| Space features already exist | `components/learning-universe/learning-universe.tsx` includes a React Three Fiber canvas, spheres, rings, lighting, and sparkles. Journey uses a black-hole hero and orbital timeline; AI Agent uses a shader. | Refine an existing foundation instead of introducing another disconnected visual experiment. |
| Some scene data and actions are illustrative | Universe contains a hardcoded course array, sample progress/XP, and toast-only actions; Journey contains static milestone data. | A redesign must not imply these are verified learner records or working new features. Preserve the distinction between demonstration and live data. |
| Motion handling is incomplete in the inspected scene | OrbitalScene checks reduced motion for constellation rotation; Planet's frame callback continues its own rotation and bobbing. | A shared motion preference must reach every animated layer, including video and shaders. |
| Old surfaces remain visible across the product | AuthLayout and the organization switcher use white backgrounds; AccountSidebar uses gray/white utilities; board settings use light hex backgrounds; admin headings assume white text. | Fix shared shells and primitives before individual page polish. Include portals and utility screens. |
| Navigation has multiple visual approaches | OrgMenu is a fixed black bar; Universe adds a dock; skills/agent/journey add their own return headers. | Keep one global navigation model and use scene controls only for scene-specific actions. |
| No local production video/model files were found in the targeted public asset search | No `.mp4`, `.webm`, `.glb`, or `.gltf` paths returned under `apps/web/public`. Existing planets are procedural geometry. | Specify an asset contract and posters now; final external or future assets remain to be supplied. |

## Proposed direction

**StarLab Orbital:** an approachable learning observatory. Midnight navy, atmospheric blue, teal navigation, violet discovery, and amber milestones. Light mode uses pale blue-white surfaces, navy typography, and softly lit planet artwork. Both modes retain the same information hierarchy and subject identities.

Use expressive cinematic scenes on the landing page and learning universe. Use quieter constellation motifs and subject artwork in catalogs. Keep lesson bodies, assignments, editors, billing, and administration visually calm. A planet should identify a learning destination; an orbit should communicate sequence or progress. Decoration should reinforce these meanings.

## Review limits and next validation

The route inventory is comprehensive for the checked-out `app/**/page.tsx` files; individual component inspection was targeted, not an exhaustive interaction test. Host-dependent public aliases were not verified, and frontend redirects should remain intact. No claims are made about live accessibility compliance, browser performance, authentication, or existing backend behavior.

The implementation brief includes a route manifest, token tables, templates, media requirements, and acceptance checks. Its proposed colors and layout specifications are design decisions. Validate actual rendered contrast, motion preferences, route behavior, and responsive layouts during implementation.
