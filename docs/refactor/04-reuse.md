# 04: What stays (reuse from LearnHouse)

Most of LearnHouse already fits a self-paced product. Don't rewrite these.

| System | Where | Reuse as | Notes |
|---|---|---|---|
| Courses, chapters, activities, ordering | `api/db/courses/*`, `api/services/courses/*` | Course → unit → lesson/practice/test | Only add `details.learning_role`. |
| Course editor (dash) | `web/app/orgs/[orgslug]/dash/courses/*`, `web/app/editor` | Content studio | Add role picker; nothing else. |
| Dynamic pages + blocks (`BLOCK_QUIZ`, video, PDF...) | `api/db/courses/blocks.py`, editor | Lesson content with inline checks | Inline quiz blocks = "check your understanding" inside lessons. |
| Assignment engine (tasks, submissions, auto-grading, retries, solutions) | `api/db/courses/assignments.py`, `api/services/courses/activities/assignments.py` | Practice + unit tests | Presets over existing fields. Manual grading kept for admins. |
| Trail / TrailRun / TrailStep | `api/db/trails.py`, `trail_runs.py`, `trail_steps.py`, `api/services/trail/` | My learning + per-activity progress | Use `TrailStep.data` for scores. |
| `is_user_enrolled_in_course` | `api/services/trail/enrollment.py` | "Has the student started this?" | Not an access gate. |
| Completion events, certificates, webhooks, audit | `trail.py` (`ACTIVITY_COMPLETED`, `COURSE_COMPLETED`) | Hooks for mastery, XP, streaks | Gamification subscribes here later. |
| RBAC `ResourceAccessChecker` | `api/security/rbac/resource_access.py` | Course/content access | Public + published + usergroup lock is already the right rule. |
| Communities / discussions / comments / votes / reactions | `api/db/communities/*` | Course + lesson Q&A | Gate = course readable. |
| Single org + account types | `api/services/orgs/platform.py`, `api/security/platform_roles.py` | Student vs admin | Unchanged. |
| Users, roles, signups, usergroups (dash) | `dash/users/*` | People admin | Relabel Instructor; groups = content access. |
| Analytics | `dash/analytics`, `api/routers/analytics.py` | Insights (enrollments, completion) | Replaces any roster idea. |
| Library/folders, media, search, AI copilot | respective routers | Unchanged | Optional in student nav. |
| Certifications | `api/services/courses/certifications.py` | Course completion reward | Fits gamification later. |

## Kept but dormant (don't delete, don't extend)

| System | Why dormant |
|---|---|
| Boards + `apps/collab` | Not part of the learning loop. Not linked for students or in admin nav; `/boards` redirects. The editor route `web/app/board/[uuid]` is still reachable by URL for board members. |
| Podcasts, playgrounds | Feature-flagged; decide after dashboard. |
| Org-wide (non-course) communities | Admin-only after backfill. |
| Assignment `due_date`, `grading_type`, manual grade routes | Admin review of manual tasks only. |
| `TrailStep.teacher_verified`, `grade` | Unused columns; leave in schema. |

## Remove (already done or queued in 03-H)

Payments/store, custom domains, SEO, SSO, billing upsell, multi-org/demo.
