'use client'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CheckCircle, Users, TrendingUp, FileText, ClipboardCheck, Video } from 'lucide-react'
import { useCourse } from '@components/Contexts/CourseContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getCourseMonitoring, CourseMonitoringRow } from '@services/platform/platform'

const COURSE_MONITORING_KEY = ['platform', 'courses'] as const

function activityIcon(type: string) {
  if (type === 'TYPE_ASSIGNMENT') return <ClipboardCheck size={14} className="text-violet-500" />
  if (type === 'TYPE_VIDEO') return <Video size={14} className="text-sky-500" />
  return <FileText size={14} className="text-gray-400" />
}

// A platform course as admins see it: how it is used, and what it contains.
// Courses are platform content, so there is nothing to edit here
// (docs/refactor/progress/00-requirements.md, R6, R20).
export default function CourseMonitoringOverview() {
  const course = useCourse() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const structure = course?.courseStructure

  const { data } = useQuery<CourseMonitoringRow[]>({
    queryKey: COURSE_MONITORING_KEY,
    queryFn: () => getCourseMonitoring(token),
    enabled: !!token,
    staleTime: 60_000,
  })
  const row = data?.find((c) => c.course_uuid === structure?.course_uuid)

  const stats = [
    { label: 'Enrolled', value: row?.enrollments ?? 0, icon: Users },
    { label: 'In progress', value: row?.in_progress ?? 0, icon: TrendingUp },
    { label: 'Completed', value: row?.completions ?? 0, icon: CheckCircle },
    { label: 'Completion rate', value: `${row?.completion_rate ?? 0}%`, icon: CheckCircle },
    { label: 'Average progress', value: `${row?.average_progress ?? 0}%`, icon: TrendingUp },
    { label: 'Activities', value: row?.total_activities ?? 0, icon: BookOpen },
  ]

  if (!structure) return null

  return (
    <div className="px-4 sm:px-10 py-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl nice-shadow p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
              <Icon size={14} /> {label}
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl nice-shadow">
        <div className="flex flex-col bg-gray-50 -space-y-1 px-5 py-3 rounded-t-xl">
          <h2 className="font-bold text-xl text-gray-800">Course content</h2>
          <p className="text-gray-500 text-sm">
            Platform-authored. Content changes are made in the course catalog, not here.
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {(structure.chapters || []).map((chapter: any, index: number) => (
            <div key={chapter.chapter_uuid} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 text-neutral-600 text-xs font-semibold">
                  {index + 1}
                </span>
                <h3 className="font-semibold text-gray-900">{chapter.name}</h3>
              </div>
              <ul className="space-y-1.5 ps-7">
                {(chapter.activities || []).map((activity: any) => (
                  <li key={activity.activity_uuid} className="flex items-center gap-2 text-sm text-gray-600">
                    {activityIcon(activity.activity_type)}
                    <span>{activity.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
