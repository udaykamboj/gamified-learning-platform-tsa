'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowRight, Check, Loader2, Plus } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { getOrgCourses } from '@services/courses/courses'
import { removeCourse, startCourse } from '@services/courses/activity'
import { useTrail } from '@/hooks/queries/useTrail'
import { queryKeys } from '@/lib/query/keys'

// Subject identity accents (teal, blue, coral, violet, amber), assigned by
// position so a course keeps the same color on every render.
const ACCENTS = ['var(--sl-teal-400)', 'var(--sl-blue-400)', 'var(--sl-coral-400)', 'var(--sl-violet-400)', 'var(--sl-amber-400)']

type CourseCard = {
  course_uuid: string
  name: string
  description?: string | null
}

// Basic enrollment: every platform course, with the student's own choice to
// enroll or leave. Enrolled courses are the ones they can work on
// (docs/refactor/progress/00-requirements.md, R8, R9).
export default function SkillsEnrollment({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<string | null>(null)

  const { data: courses, isLoading } = useQuery({
    queryKey: [...queryKeys.courses.list(orgslug), 'skills'],
    queryFn: () => getOrgCourses(orgslug, null, accessToken),
    enabled: !!orgslug,
    staleTime: 60_000,
  })
  const { data: trail } = useTrail(accessToken ? org?.id : undefined)

  const runsByCourse = useMemo(() => {
    const map = new Map<string, any>()
    for (const run of trail?.runs || []) {
      if (run?.course?.course_uuid) map.set(run.course.course_uuid, run)
    }
    return map
  }, [trail])

  const toggle = async (course: CourseCard, enrolled: boolean) => {
    if (!accessToken) {
      window.location.href = '/signup'
      return
    }
    setPending(course.course_uuid)
    try {
      if (enrolled) {
        await removeCourse(course.course_uuid, orgslug, accessToken)
        toast.success(`Left ${course.name}`)
      } else {
        await startCourse(course.course_uuid, orgslug, accessToken)
        toast.success(`Enrolled in ${course.name}`)
      }
      if (org?.id) await queryClient.invalidateQueries({ queryKey: queryKeys.trail.org(org.id) })
    } catch {
      toast.error(enrolled ? 'Could not leave the course' : 'Could not enroll')
    } finally {
      setPending(null)
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading courses">
        {[0, 1, 2].map((i) => (
          <div key={i} className="sl-card h-52 animate-pulse p-6">
            <div className="h-5 w-2/3 rounded-[6px] bg-muted" />
            <div className="mt-4 h-3 w-full rounded-[6px] bg-muted" />
            <div className="mt-2 h-3 w-4/5 rounded-[6px] bg-muted" />
          </div>
        ))}
        <span className="sr-only">
          <Loader2 size={14} /> Loading courses…
        </span>
      </div>
    )
  }

  const list: CourseCard[] = Array.isArray(courses) ? courses : []
  if (list.length === 0) {
    return (
      <div className="sl-card flex flex-col items-center px-6 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Plus size={22} aria-hidden />
        </span>
        <h2 className="mt-4 text-card-title font-semibold text-foreground">No courses are available yet</h2>
        <p className="mt-1 text-ui text-muted-foreground">When your learning space publishes courses, they will appear here.</p>
      </div>
    )
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((course, index) => {
        const run = runsByCourse.get(course.course_uuid)
        const enrolled = !!run
        const total = run?.course_total_steps || 0
        const done = (run?.steps || []).filter((step: any) => step.complete).length
        const percent = total > 0 ? Math.round((done / total) * 100) : 0
        const color = ACCENTS[index % ACCENTS.length]
        const courseHref = getUriWithOrg(orgslug, `/course/${course.course_uuid.replace('course_', '')}`)
        const busy = pending === course.course_uuid

        return (
          <li
            key={course.course_uuid}
            className={`sl-card relative flex flex-col gap-3 overflow-hidden p-5 md:p-6 ${enrolled ? 'border-primary/50' : ''}`}
          >
            <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-card-title font-semibold text-foreground">{course.name}</h2>
              {enrolled && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-surface px-2.5 py-0.5 text-meta font-semibold text-success">
                  <Check size={12} aria-hidden /> Enrolled
                </span>
              )}
            </div>
            {course.description && (
              <p className="line-clamp-3 text-ui text-muted-foreground">{course.description}</p>
            )}

            {enrolled && (
              <div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  aria-label={`${course.name} progress`}
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1.5 font-mono text-meta tabular-nums text-muted-foreground">
                  {done} / {total} activities · {percent}%
                </p>
              </div>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
              {enrolled ? (
                <>
                  <Link href={courseHref} className="sl-btn sl-btn-primary min-h-10 px-4">
                    Continue <ArrowRight size={16} aria-hidden />
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggle(course, true)}
                    disabled={busy}
                    className="sl-btn sl-btn-ghost min-h-10 px-4 text-muted-foreground"
                  >
                    {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
                    {busy ? 'Leaving…' : 'Leave'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => toggle(course, false)}
                    disabled={busy}
                    className="sl-btn sl-btn-secondary min-h-10 px-4"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Plus size={16} aria-hidden />}
                    {busy ? 'Enrolling…' : 'Enroll'}
                  </button>
                  <Link href={courseHref} className="sl-btn sl-btn-ghost min-h-10 px-4">
                    Preview
                  </Link>
                </>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
