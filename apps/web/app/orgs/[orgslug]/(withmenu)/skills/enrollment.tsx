'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowRight, Check, Loader2, Plus } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getOrgCourses } from '@services/courses/courses'
import { removeCourse, startCourse } from '@services/courses/activity'
import { useTrail } from '@/hooks/queries/useTrail'
import { queryKeys } from '@/lib/query/keys'

const ACCENTS = ['#4ed6c6', '#89a6ff', '#e97687', '#b88cff', '#f5b85c']

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(240,244,255,0.5)', fontSize: 13 }}>
        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading courses…
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const list: CourseCard[] = Array.isArray(courses) ? courses : []
  if (list.length === 0) {
    return <p style={{ color: 'rgba(240,244,255,0.5)', fontSize: 14 }}>No courses are available yet.</p>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {list.map((course, index) => {
        const run = runsByCourse.get(course.course_uuid)
        const enrolled = !!run
        const total = run?.course_total_steps || 0
        const done = (run?.steps || []).filter((step: any) => step.complete).length
        const percent = total > 0 ? Math.round((done / total) * 100) : 0
        const color = ACCENTS[index % ACCENTS.length]
        const courseHref = `/course/${course.course_uuid.replace('course_', '')}`
        const busy = pending === course.course_uuid

        return (
          <div
            key={course.course_uuid}
            style={{
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${enrolled ? `${color}55` : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 12, padding: '24px', position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, fontWeight: 600, color: '#fff', margin: 0 }}>{course.name}</h2>
              {enrolled && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.15em', textTransform: 'uppercase', color, border: `1px solid ${color}40`, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                  <Check size={10} /> Enrolled
                </span>
              )}
            </div>
            {course.description && (
              <p style={{ fontSize: 13, color: 'rgba(240,244,255,0.5)', lineHeight: 1.7, margin: 0 }}>{course.description}</p>
            )}

            {enrolled && (
              <div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${percent}%`, height: '100%', background: color }} />
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 11, fontFamily: 'monospace', color: 'rgba(240,244,255,0.45)' }}>
                  {done} / {total} activities · {percent}%
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
              {enrolled ? (
                <>
                  <Link
                    href={courseHref}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: color, color: '#050810', borderRadius: 6, padding: '8px 14px', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}
                  >
                    Continue <ArrowRight size={12} />
                  </Link>
                  <button
                    onClick={() => toggle(course, true)}
                    disabled={busy}
                    style={{ background: 'transparent', color: 'rgba(240,244,255,0.5)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '8px 14px', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: busy ? 'wait' : 'pointer' }}
                  >
                    {busy ? 'Leaving…' : 'Leave'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => toggle(course, false)}
                    disabled={busy}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', color: '#fff', border: `1px solid ${color}66`, borderRadius: 6, padding: '8px 14px', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: busy ? 'wait' : 'pointer' }}
                  >
                    <Plus size={12} /> {busy ? 'Enrolling…' : 'Enroll'}
                  </button>
                  <Link
                    href={courseHref}
                    style={{ display: 'flex', alignItems: 'center', color: 'rgba(240,244,255,0.5)', padding: '8px 6px', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}
                  >
                    Preview
                  </Link>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
