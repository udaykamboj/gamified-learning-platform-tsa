# 00 — Requirements checklist

Source of truth: [`../Refactor_Student_Learning_Platform.md`](../Refactor_Student_Learning_Platform.md).
The binding content is the user's answers (the last "You" block, spec line 767)
plus the summaries at spec lines 191, 775–876 and 908–921. Each item below is
numbered so every change can cite what it implements. Nothing outside this list
is in scope.

## Product model

- **R1** No teacher layer. No teacher/instructor accounts, roles, permissions or
  dashboard. Remove the underlying model, not just the UI (spec 88–92, 191, 326–332).
- **R2** Roles are Student and Admin only. Moderators are admins (spec 767 "moderators
  should just be admins").
- **R3** Admin has no pedagogical control over individual students: no assigning,
  no granting access to tools, no managing progress or enrollment (spec 71–92, 864–874).
- **R4** Refactor, not rewrite. Keep → Modify → Remove → Add. Preserve working
  systems and existing UI; new UI must match the surrounding design (spec 460–553, 908–912).
- **R5** Real end-to-end changes across DB → backend → API → authorization →
  routes → frontend. No overlays, no hidden-but-still-live teacher paths (spec 407–456, 878–886).

## Courses & enrollment

- **R6** Courses are program-authored / effectively hard-coded. No UI (and no API)
  for creating or editing courses, chapters, activities or assignments (spec 767, 779–781).
- **R7** Use dummy courses for now, including assignments, so the full flow works (spec 767, 785).
- **R8** Any student can register. Students choose the courses they want. Enrolled
  courses are the courses they can do (spec 767, 783, 787).
- **R9** A basic enrollment section lives on the **Skills** page (spec 767, 784).
- **R10** Assignments still exist inside course structure; students complete/submit
  them independently; keep submission/completion/progress machinery (spec 789–794).
- **R11** Student progress is persistent, student-owned, self-paced (spec 796–800).

## Student tools

- **R12** Playgrounds: unlimited, student-created, rename/edit/delete own, private by
  default, shareable when the student chooses; history-list feel (spec 767, 802–808).
- **R13** Boards: unlimited, student-created and owned, private by default, share with
  specific people, linkable into community discussions; no auto-created board per user
  (spec 767, 810–818).
- **R14** Community: platform-wide public discussion; users post, ask, answer; visible
  to the community; boards can be linked into discussions (spec 767, 820–826).
- **R15** Podcasts: platform-provided content students consume whenever they want; no
  assigning, no admin provisioning of access (spec 767, 828–833).
- **R16** AI Agent: built-in tool, always available, not enabled by an admin (spec 834–837).
- **R17** No "your teacher/administrator must enable this" states for any tool (spec 363–377).

## Admin

- **R18** Keep the admin system; transform it into technical/platform administration
  and monitoring (spec 839–848).
- **R19** Users: overview of accounts, basic info, status; account moderation
  (disable/remove) for platform/security reasons (spec 172–176, 767 "they should still be
  able to moderate accounts").
- **R20** Courses section becomes course monitoring/analytics: usage, popularity,
  completion — not management (spec 528, 850–862, 767).
- **R21** Community moderation: admins remove inappropriate posts/content (spec 767, 825).
- **R22** System/platform information and configuration (spec 178–183, 845).

## Process

- **R23** Progress files under `docs/refactor/progress/`, kept current.
- **R24** Verify behaviour end-to-end (create → API → auth → DB → reload), not by looks
  (spec 432–452).
