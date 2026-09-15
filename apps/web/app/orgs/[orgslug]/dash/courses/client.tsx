'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { BookCopy, Search, X, Eye, BarChart3 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { getCourseMonitoring, CourseMonitoringRow } from '@services/platform/platform'
import { searchMatchesAny } from '@/lib/search/normalize'

const COURSE_MONITORING_KEY = ['platform', 'courses'] as const

// Course monitoring: every platform course with how many students enrolled,
// completed and how far they got, most popular first. Courses are platform
// content, so there is no create/edit here (docs/refactor/progress/00-requirements.md, R6, R20).
function CoursesHome({ orgslug }: { orgslug: string }) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isLoading } = useQuery<CourseMonitoringRow[]>({
    queryKey: COURSE_MONITORING_KEY,
    queryFn: () => getCourseMonitoring(token),
    enabled: !!token,
    staleTime: 60_000,
  })

  const courses = useMemo(() => {
    const all = data || []
    if (!searchQuery.trim()) return all
    return all.filter((c) => searchMatchesAny([c.name, c.description], searchQuery))
  }, [data, searchQuery])

  const totals = useMemo(() => {
    const all = (data || []).filter((c) => c.published)
    return {
      courses: all.length,
      enrollments: all.reduce((sum, c) => sum + c.enrollments, 0),
      completions: all.reduce((sum, c) => sum + c.completions, 0),
    }
  }, [data])

  return (
    <div className="h-full w-full bg-[#f8f8f8] ps-4 pe-4 sm:ps-10 sm:pe-10 pb-10">
      <div className="mb-6 pt-6">
        <Breadcrumbs items={[
          { label: t('courses.courses'), href: '/dash/courses', icon: <BookCopy size={14} /> }
        ]} />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mt-4">
          <div>
            <h1 className="text-3xl font-bold">{t('courses.courses')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {totals.courses} courses · {totals.enrollments} enrollments · {totals.completions} completions
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses"
              className="w-full ps-10 pe-10 py-2.5 bg-white nice-shadow rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 border-0"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl nice-shadow overflow-x-auto">
        <table className="table-auto w-full text-start whitespace-nowrap">
          <thead className="bg-gray-100 text-gray-500 uppercase">
            <tr className="text-xs font-semibold">
              <th className="py-3 px-4 text-start">Course</th>
              <th className="py-3 px-4 text-end">Enrolled</th>
              <th className="py-3 px-4 text-end">In progress</th>
              <th className="py-3 px-4 text-end">Completed</th>
              <th className="py-3 px-4 text-start">Completion rate</th>
              <th className="py-3 px-4 text-end">Avg. progress</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="py-8 px-4 text-center text-sm text-gray-400">Loading…</td>
              </tr>
            )}
            {!isLoading && courses.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 px-4 text-center text-sm text-gray-400">
                  {searchQuery ? 'No courses match your search.' : 'No courses yet.'}
                </td>
              </tr>
            )}
            {courses.map((course) => {
              const shortUuid = course.course_uuid.replace('course_', '')
              return (
                <tr key={course.course_uuid} className="border-t border-gray-100 text-sm">
                  <td className="py-3 px-4">
                    <Link
                      href={getUriWithOrg(orgslug, `/dash/courses/course/${shortUuid}/overview`)}
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      {course.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{course.total_activities} activities</span>
                      {!course.published && (
                        <span className="px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 text-[10px] font-semibold uppercase">
                          Not in catalog
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-end font-semibold text-gray-900">{course.enrollments}</td>
                  <td className="py-3 px-4 text-end text-gray-600">{course.in_progress}</td>
                  <td className="py-3 px-4 text-end text-gray-600">{course.completions}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${course.completion_rate}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-end">{course.completion_rate}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-end text-gray-600">{course.average_progress}%</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={getUriWithOrg(orgslug, `/dash/courses/course/${shortUuid}/analytics`)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <BarChart3 size={12} /> Analytics
                      </Link>
                      <Link
                        href={getUriWithOrg(orgslug, `/course/${shortUuid}`)}
                        target="_blank"
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <Eye size={12} /> {t('dashboard.courses.preview')}
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default CoursesHome
