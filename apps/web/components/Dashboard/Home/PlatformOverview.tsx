'use client'
import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  Users,
  ChatCircle,
  Cube,
  Chalkboard,
  GraduationCap,
} from '@phosphor-icons/react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getPlatformOverview, PlatformOverview as Overview } from '@services/platform/platform'

export const PLATFORM_OVERVIEW_KEY = ['platform', 'overview'] as const

// Headline numbers for admins: who uses the platform and how. Read-only
// (docs/refactor/progress/00-requirements.md, R18, R22).
export default function PlatformOverview() {
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token

  const { data, isLoading } = useQuery<Overview>({
    queryKey: PLATFORM_OVERVIEW_KEY,
    queryFn: () => getPlatformOverview(token),
    enabled: !!token,
    staleTime: 60_000,
  })

  const cards = [
    {
      label: 'Students',
      value: data?.users.students,
      detail: data ? `${data.users.new_last_30_days} joined in the last 30 days` : '',
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
      href: '/dash/users/settings/users',
    },
    {
      label: 'Active learners',
      value: data?.users.active_learners_last_30_days,
      detail: 'Worked on a course in the last 30 days',
      icon: GraduationCap,
      color: 'text-emerald-600 bg-emerald-50',
      href: '/dash/courses',
    },
    {
      label: 'Enrollments',
      value: data?.learning.enrollments,
      detail: data ? `${data.learning.completions} completed · ${data.learning.courses} courses` : '',
      icon: BookOpen,
      color: 'text-violet-600 bg-violet-50',
      href: '/dash/courses',
    },
    {
      label: 'Community posts',
      value: data?.community.discussions,
      detail: data ? `${data.community.discussions_last_30_days} in the last 30 days` : '',
      icon: ChatCircle,
      color: 'text-amber-600 bg-amber-50',
      href: '/dash/communities',
    },
    {
      label: 'Playgrounds',
      value: data?.tools.playgrounds,
      detail: 'Created by students',
      icon: Cube,
      color: 'text-sky-600 bg-sky-50',
      href: undefined,
    },
    {
      label: 'Boards',
      value: data?.tools.boards,
      detail: 'Created by students',
      icon: Chalkboard,
      color: 'text-rose-600 bg-rose-50',
      href: undefined,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        const body = (
          <div className="bg-white rounded-xl nice-shadow p-4 h-full hover:bg-gray-50/60 transition-colors">
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`p-1.5 rounded-lg ${card.color}`}>
                <Icon size={16} weight="duotone" />
              </div>
              <span className="text-xs font-medium text-gray-500">{card.label}</span>
            </div>
            {isLoading ? (
              <div className="h-7 bg-gray-100 rounded w-12 animate-pulse" />
            ) : (
              <div className="text-2xl font-bold text-gray-900">{card.value ?? 0}</div>
            )}
            <div className="text-[11px] text-gray-400 mt-1 line-clamp-2">{card.detail}</div>
          </div>
        )
        return card.href ? (
          <Link key={card.label} href={card.href}>{body}</Link>
        ) : (
          <div key={card.label}>{body}</div>
        )
      })}
    </div>
  )
}
