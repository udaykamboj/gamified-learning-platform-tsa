'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { Community } from '@services/communities/communities'
import { getCommunityThumbnailMediaDirectory } from '@services/media/media'
import { Users, MessageCircle, Shield } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { useTranslation } from 'react-i18next'

type PropsType = {
  community: Community
  orgslug: string
  org_id: string | number
  variant?: 'dashboard' | 'public'
}

const removeCommunityPrefix = (communityid: string) => {
  return communityid.replace('community_', '')
}

// Communities are platform content: students open them, admins open the
// moderation view. Nobody creates, edits or deletes them here.
function CommunityCard(props: PropsType) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const communityId = removeCommunityPrefix(props.community.community_uuid)
  const variant = props.variant || 'dashboard'

  const communityLink = variant === 'dashboard'
    ? getUriWithOrg(props.orgslug, `/dash/communities/${communityId}/moderation`)
    : getUriWithOrg(props.orgslug, `/community/${communityId}`)

  return (
    <div
      className="group relative flex flex-col sl-card sl-card-interactive overflow-hidden w-full"
    >
      <Link
        href={communityLink}
        className="block relative aspect-video overflow-hidden bg-muted"
      >
        {props.community.thumbnail_image && org?.org_uuid ? (
          <img
            src={getCommunityThumbnailMediaDirectory(
              org.org_uuid,
              props.community.community_uuid,
              props.community.thumbnail_image
            )}
            alt={props.community.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full w-full sl-atmosphere text-muted-foreground gap-2">
            <Users size={40} strokeWidth={1.5} />
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <Link
          href={communityLink}
          className="text-card-title font-semibold text-foreground line-clamp-1"
        >
          {props.community.name}
        </Link>

        {props.community.description && (
          <p className="text-ui text-muted-foreground line-clamp-2">
            {props.community.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MessageCircle size={12} />
            <span className="text-meta">
              {props.community.course_id ? 'Course Q&A' : 'Everyone'}
            </span>
          </div>

          <Link
            href={communityLink}
            className="flex items-center gap-1 text-sm font-semibold text-link hover:underline underline-offset-4"
          >
            {variant === 'dashboard' && <Shield size={10} />}
            {variant === 'dashboard' ? 'Moderate' : t('dashboard.courses.communities.card.view_community')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default CommunityCard
