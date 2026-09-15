'use client'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { getUriWithOrg } from '@services/config/config'
import { Shield, MessagesSquare, Eye } from 'lucide-react'
import Link from 'next/link'
import React, { use } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { CommunityProvider, useCommunity } from '@components/Contexts/CommunityContext'
import CommunityEditModeration from '@components/Dashboard/Pages/Community/CommunityEditModeration'
import { DashTabBar, DashTabItem } from '@components/Dashboard/Shared/DashTabBar/DashTabBar'

export type CommunityParams = {
  subpage: string
  orgslug: string
  communityuuid: string
}

// A community's moderation rules. The community itself (name, description,
// course link) is platform content, so there is nothing else to edit here.
function CommunitySettingsContent({ params }: { params: CommunityParams }) {
  const { t } = useTranslation()
  const communityState = useCommunity()
  const community = communityState?.community

  if (!community) return null

  const tabs: DashTabItem[] = [
    {
      key: 'moderation',
      label: t('dashboard.courses.communities.settings.tabs.moderation'),
      icon: <Shield size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/dash/communities/${params.communityuuid}/moderation`,
      active: true,
    },
  ]

  return (
    <div className="h-full w-full bg-[#f8f8f8] flex flex-col">
      <div className="ps-4 pe-4 sm:ps-10 sm:pe-10 tracking-tight bg-[#fcfbfc] z-10 nice-shadow flex-shrink-0 relative">
        <div className="pt-6 pb-4">
          <Breadcrumbs items={[
            { label: 'Community moderation', href: '/dash/communities', icon: <MessagesSquare size={14} /> },
            { label: community.name }
          ]} />
        </div>
        <div className="my-2 py-2 flex items-center justify-between gap-4">
          <div className="w-full flex flex-col space-y-1 min-w-0">
            <div className="pt-3 flex font-bold text-3xl sm:text-4xl tracking-tighter truncate">
              {t('dashboard.courses.communities.settings.moderation.title')}
            </div>
            <div className="flex font-medium text-gray-400 text-md truncate">
              {t('dashboard.courses.communities.settings.moderation.subtitle')}
            </div>
          </div>
          <Link
            href={getUriWithOrg(params.orgslug, `/community/${params.communityuuid}`)}
            className="shrink-0 px-3.5 py-2 text-sm font-semibold text-neutral-600 bg-neutral-50/70 hover:bg-neutral-100/70 rounded-lg ring-1 ring-neutral-200/60 transition-colors flex items-center space-x-2"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">View community</span>
          </Link>
        </div>
        <DashTabBar tabs={tabs} />
      </div>
      <div className="h-6 flex-shrink-0"></div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1, type: 'spring', stiffness: 80 }}
        className="flex-1 overflow-y-auto"
      >
        <CommunityEditModeration />
      </motion.div>
    </div>
  )
}

function CommunitySettingsPage(props: { params: Promise<CommunityParams> }) {
  const params = use(props.params)

  return (
    <CommunityProvider communityuuid={params.communityuuid}>
      <CommunitySettingsContent params={params} />
    </CommunityProvider>
  )
}

export default CommunitySettingsPage
