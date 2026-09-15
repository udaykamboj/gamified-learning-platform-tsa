import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests'

// Read-only platform monitoring for admins (apps/api/src/routers/platform.py).
// Admins observe the platform; nothing here changes a student's learning.

export interface PlatformOverview {
  users: {
    students: number
    admins: number
    new_last_30_days: number
    active_learners_last_30_days: number
  }
  learning: {
    courses: number
    enrollments: number
    completions: number
    submissions: number
  }
  tools: {
    playgrounds: number
    boards: number
    podcasts: number
  }
  community: {
    communities: number
    discussions: number
    discussions_last_30_days: number
  }
  system: {
    database: string
    generated_at: string
  }
}

export interface CourseMonitoringRow {
  course_uuid: string
  name: string
  description: string | null
  published: boolean
  in_catalog: boolean
  total_activities: number
  enrollments: number
  completions: number
  in_progress: number
  completion_rate: number
  average_progress: number
}

export interface CommunityActivityItem {
  type: 'discussion' | 'comment'
  uuid: string
  discussion_uuid: string
  title: string
  content: string
  community_uuid: string
  community_name: string
  is_pinned: boolean
  is_locked: boolean
  author: { user_uuid: string; username: string; avatar_image: string | null }
  creation_date: string
}

export async function getPlatformOverview(access_token: string): Promise<PlatformOverview> {
  const result = await fetch(
    `${getAPIUrl()}platform/overview`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getCourseMonitoring(access_token: string): Promise<CourseMonitoringRow[]> {
  const result = await fetch(
    `${getAPIUrl()}platform/courses`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}

export async function getRecentCommunityActivity(
  access_token: string,
  limit: number = 30
): Promise<CommunityActivityItem[]> {
  const result = await fetch(
    `${getAPIUrl()}platform/community/recent?limit=${limit}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  return errorHandling(result)
}
