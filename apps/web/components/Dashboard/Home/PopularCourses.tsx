'use client'
import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { BookOpen } from '@phosphor-icons/react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getCourseMonitoring, CourseMonitoringRow } from '@services/platform/platform'

export const COURSE_MONITORING_KEY = ['platform', 'courses'] as const

// The platform courses students enroll in most, with completion.
export default function PopularCourses() {
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token

  const { data, isLoading } = useQuery<CourseMonitoringRow[]>({
    queryKey: COURSE_MONITORING_KEY,
    queryFn: () => getCourseMonitoring(token),
    enabled: !!token,
    staleTime: 60_000,
  })

  const courses = (data || []).filter((course) => course.published).slice(0, 6)

  return (
    <div className="sl-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Most popular courses</h3>
        <Link href="/dash/courses" className="text-xs font-medium text-gray-400 hover:text-gray-700">
          All courses
        </Link>
      </div>
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <p className="text-xs text-gray-400 py-6 text-center">No courses yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {courses.map((course) => (
            <li key={course.course_uuid}>
              <Link
                href={`/dash/courses/course/${course.course_uuid.replace('course_', '')}/overview`}
                className="flex items-center gap-3 py-3 hover:bg-gray-50/60 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div className="p-1.5 rounded-lg bg-gray-100 text-gray-500">
                  <BookOpen size={16} weight="duotone" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{course.name}</div>
                  <div className="h-1.5 mt-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${course.completion_rate}%` }} />
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <div className="text-sm font-semibold text-gray-900">{course.enrollments}</div>
                  <div className="text-[11px] text-gray-400">{course.completion_rate}% complete</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
