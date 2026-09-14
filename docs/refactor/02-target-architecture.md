# 02: Target student-first architecture

## Mental model

```
STUDENT
  └─ My learning (TrailRun per started course)
       └─ COURSE  (catalog item, published by admins)
            └─ UNIT  = Chapter
                 ├─ LESSON      = Activity, role "lesson"     (video / dynamic page / doc)
                 ├─ PRACTICE    = Activity, role "practice"   (assignment engine, formative preset)
                 └─ UNIT TEST   = Activity, role "assessment" (assignment engine, summative preset)
       └─ PROGRESS per activity (TrailStep) → MASTERY per unit and course (derived)

ADMIN
  ├─ Content studio: courses, units, activities, question banks, media, Q&A moderation
  └─ Platform: users, roles, settings, analytics, API tokens
```

No teacher, class, roster, section, or due date sits between the student and
the content.

## Object mapping (LearnHouse → StarLab)

| StarLab concept | LearnHouse object | Change |
|---|---|---|
| Subject / course | `Course` | None. `public`+`published` = in catalog. |
| Unit | `Chapter` | None (UI label only). |
| Lesson / practice / unit test | `Activity` | Add a **learning role** (see below). |
| Exercise questions | `AssignmentTask` (`QUIZ`, `SHORT_ANSWER`, `NUMBER_ANSWER`, `CODE`, `FORM`) | None. |
| Attempt | `AssignmentUserSubmission` + task submissions | Reuse; retries already supported. |
| "I started this course" | `Trail` + `TrailRun` | None. Student-created only. |
| Activity progress | `TrailStep` | Completion rule depends on role (below). |
| Mastery | — | New, derived (below). |
| Q&A under content | `Community` (1 per course) → `Discussion` | Entry point + gate change. |
| Content author | `ResourceAuthor` on course | None. Authorship, not student management. |
| Content visibility lock | `UserGroup` + course locks | Admin-only tool. Not "classes". |

## Learning role on activities

Store in the existing `Activity.details` JSON (no migration):

```json
{ "learning_role": "lesson" | "practice" | "assessment" }
```

- Missing → derive: `TYPE_ASSIGNMENT` → `practice`, everything else → `lesson`.
- A migration to a real column is allowed later if queries need it; don't start
  with one.

## Practice and assessment presets (over the assignment engine)

| Field | Practice | Assessment (unit test) |
|---|---|---|
| `auto_grading` | true | true |
| `ungraded` | false (score is kept for mastery) | false |
| `allow_retries` / `max_retries` | true / 0 (unlimited) | true / 0 |
| `show_correct_answers` | true | true after grading |
| `solution_reveal` | `ON_SUBMISSION` | `AFTER_GRADING` |
| `pass_threshold_percentage` | 70 | 80 |
| `due_date` | always null, not shown | always null, not shown |
| `grading_type` | `PERCENTAGE` (hidden) | `PERCENTAGE` (hidden) |
| Allowed task types | auto-gradable only | auto-gradable only |

`FILE_SUBMISSION` / `CUSTOM` / `OTHER` stay in the engine for admins, but aren't
offered in the default student-first authoring flow. Manual grading endpoints
stay (admin review), they're just not part of the loop.

## Completion rules (TrailStep)

| Role | Activity is complete when |
|---|---|
| lesson | Student marks done / reaches end (current behavior) |
| practice | Best attempt ≥ pass threshold |
| assessment | Best attempt ≥ pass threshold |

Store the best score on `TrailStep.data` (`{"best_score": 85, "attempts": 3}`).
`teacher_verified` and `grade` become unused (don't drop the columns).

## Mastery (derived, net-new)

Keep it computable from existing rows first; persist only if needed for speed.

- Per activity: `not_started` / `attempted` (<threshold) / `familiar`
  (practice passed) / `proficient` (≥90 on practice) / `mastered` (assessment passed).
- Per unit: mastery points = sum of activity levels ÷ max. Unit test pass
  promotes all practice skills in that unit to at least `proficient`.
- Per course: average of units.
- Expose via one read endpoint (`GET /trail/course/{course_uuid}/mastery`) that
  the dashboard and gamification consume later. XP/streaks hook onto the same
  events (`ACTIVITY_COMPLETED`, `COURSE_COMPLETED`, attempt graded).

## Access rules

| Thing | Anonymous | Signed-in student | Admin |
|---|---|---|---|
| Catalog / course page / lessons | if course public+published | if readable (public+published, not usergroup-locked) | all |
| Practice / assessment attempts | no | if course readable | all |
| Start / leave course (TrailRun) | no | self only | — |
| Q&A: read | if course readable | if course readable | all |
| Q&A: post / vote / react | no | if course readable | all + moderate |
| Boards | no | no (hidden) | yes |
| Other students' progress | no | no | analytics only |

## Surfaces

- **Student**: catalog (`/courses`), course page, activity player, my learning
  (dashboard, later), account. Top nav: courses, library (optional), AI helper.
- **Admin `/admin` → Course management (`/dash`)**: content studio. Groups:
  *Content* (Courses, Library, Question review), *Community* (Q&A moderation),
  *People* (Users, Roles, Signups), *Insights* (Analytics).
- **Admin `/admin` → Platform console**: unchanged from `progress.md`.
