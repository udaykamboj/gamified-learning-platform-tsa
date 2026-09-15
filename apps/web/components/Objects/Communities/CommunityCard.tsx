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
      className="group relative flex flex-col bg-white rounded-xl nice-shadow overflow-hidden w-full transition-all duration-300 hover:scale-[1.01]"
    >
      <Link
        href={communityLink}
        className="block relative aspect-video overflow-hidden bg-gray-50"
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
          <div className="flex flex-col items-center justify-center h-full w-full text-gray-300 gap-2">
            <Users size={40} strokeWidth={1.5} />
          </div>
        )}
      </Link>

      <div className="p-3 flex flex-col space-y-1.5">
        <Link
          href={communityLink}
          className="text-base font-bold text-gray-900 leading-tight hover:text-black transition-colors line-clamp-1"
        >
          {props.community.name}
        </Link>

        {props.community.description && (
          <p className="text-[11px] text-gray-500 line-clamp-2 min-h-[1.5rem]">
            {props.community.description}
          </p>
        )}

        <div className="pt-1.5 flex items-center justify-between border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-gray-500">
            <MessageCircle size={12} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {props.community.course_id ? 'Course Q&A' : 'Everyone'}
            </span>
          </div>

          <Link
            href={communityLink}
            className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-wider"
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
