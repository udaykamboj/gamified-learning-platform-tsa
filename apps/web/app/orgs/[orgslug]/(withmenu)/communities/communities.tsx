'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import CommunityCard from '@components/Objects/Communities/CommunityCard'
import { Users } from 'lucide-react'
import { Community } from '@services/communities/communities'
import { useTrackView, AnalyticsEvent } from '@services/analytics'

interface CommunitiesClientProps {
  communities: Community[]
  orgslug: string
  org_id: number
}

// The platform's discussion spaces: the Community for everyone and a Q&A space
// per course. They come with the platform; nobody creates or assigns them
// (docs/refactor/progress/00-requirements.md, R14).
const CommunitiesClient = ({ communities, orgslug, org_id }: CommunitiesClientProps) => {
  const { t } = useTranslation()

  useTrackView(AnalyticsEvent.CommunitiesListViewed, {
    communities_count: communities.length,
  })

  return (
    <GeneralWrapperStyled>
      <div className="flex flex-col space-y-2 mb-6">
        <div className="flex items-center justify-between">
          <TypeOfContentTitle title={t('communities.title')} type="col" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {communities.map((community: Community) => (
            <div key={community.community_uuid}>
              <CommunityCard
                community={community}
                orgslug={orgslug}
                org_id={org_id}
                variant="public"
              />
            </div>
          ))}
          {communities.length === 0 && (
            <div className="col-span-full flex flex-col justify-center items-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30">
              <div className="p-4 bg-card rounded-full nice-shadow mb-4">
                <Users className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
              </div>
              <h1 className="text-xl font-bold text-gray-600 mb-2">
                {t('communities.no_communities')}
              </h1>
            </div>
          )}
        </div>
      </div>
    </GeneralWrapperStyled>
  )
}

export default CommunitiesClient
