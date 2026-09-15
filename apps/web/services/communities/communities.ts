import { getAPIUrl } from '@services/config/config'
import {
  RequestBodyWithAuthHeader,
  RequestBodyFormWithAuthHeader,
  errorHandling,
  getResponseMetadata,
} from '@services/utils/ts/requests'

export interface CommunityModerationSettings {
  block_links?: boolean
  min_post_length?: number
  max_post_length?: number
  max_comment_length?: number
  slow_mode_seconds?: number
  max_posts_per_day?: number
  min_account_age_days?: number
  require_email_verified?: boolean
  disable_reactions?: boolean
  auto_lock_days?: number
}

export interface Community {
  id: number
  org_id: number
  course_id: number | null
  course_uuid?: string | null
  community_uuid: string
  name: string
  description: string | null
  public: boolean
  moderation_words: string[]
  moderation_settings: CommunityModerationSettings | null
  thumbnail_image: string | null
  creation_date: string
  update_date: string
}

// Communities are platform content; admins only change their moderation rules.
export interface CommunityUpdate {
  moderation_words?: string[]
  moderation_settings?: CommunityModerationSettings
}

export interface CommunityRights {
  community_uuid: string
  user_id: number
  is_anonymous: boolean
  permissions: {
    read: boolean
    create_discussion: boolean
    moderate: boolean
  }
  ownership: {
    is_moderator: boolean
  }
}

export async function getCommunities(
  org_id: number,
  page: number = 1,
  limit: number = 10,
  next: any,
  access_token?: string
) {
  const result: any = await fetch(
    `${getAPIUrl()}communities/org/${org_id}/page/${page}/limit/${limit}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token)
  )
  const res = await errorHandling(result)
  return res
}

export async function getCommunity(
  community_uuid: string,
  next: any,
  access_token?: string
) {
  const result: any = await fetch(
    `${getAPIUrl()}communities/${community_uuid}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token)
  )
  const res = await errorHandling(result)
  return res
}

export async function getCommunityByCourse(
  course_uuid: string,
  next: any,
  access_token?: string
) {
  const result: any = await fetch(
    `${getAPIUrl()}communities/course/${course_uuid}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token)
  )
  const res = await errorHandling(result)
  return res
}

export async function updateCommunity(
  community_uuid: string,
  data: CommunityUpdate,
  access_token: string
) {
  const result: any = await fetch(
    `${getAPIUrl()}communities/${community_uuid}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token)
  )
  const res = await errorHandling(result)
  return res
}

export async function getCommunityRights(
  community_uuid: string,
  access_token?: string
): Promise<CommunityRights> {
  const result: any = await fetch(
    `${getAPIUrl()}communities/${community_uuid}/rights`,
    RequestBodyWithAuthHeader('GET', null, null, access_token)
  )
  const res = await errorHandling(result)
  return res
}
