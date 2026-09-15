'use client'

import React from 'react'
import Link from 'next/link'
import { MessagesSquare, Pin, Lock, Trash2, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Community } from '@services/communities/communities'
import { deleteComment, deleteDiscussion, lockDiscussion, pinDiscussion } from '@services/communities/discussions'
import { CommunityActivityItem, getRecentCommunityActivity } from '@services/platform/platform'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import CommunityCard from '@components/Objects/Communities/CommunityCard'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import { getUriWithOrg } from '@services/config/config'

interface CommunitiesDashClientProps {
  org_id: number
  orgslug: string
  communities: Community[]
}

const RECENT_ACTIVITY_KEY = ['platform', 'community', 'recent'] as const

// Community moderation: the platform's communities and the newest posts across
// all of them. Admins moderate (pin, lock, remove); they don't create or assign
// communities (docs/refactor/progress/00-requirements.md, R21).
const CommunitiesDashClient = ({ org_id, orgslug, communities }: CommunitiesDashClientProps) => {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const { data: activity, isLoading } = useQuery({
    queryKey: RECENT_ACTIVITY_KEY,
    queryFn: () => getRecentCommunityActivity(access_token, 40),
    enabled: !!access_token,
    staleTime: 30_000,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: RECENT_ACTIVITY_KEY })

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action()
      toast.success(success)
      refresh()
    } catch {
      toast.error('That action failed')
    }
  }

  return (
    <div className="h-full w-full bg-[#f8f8f8] ps-4 pe-4 sm:ps-10 sm:pe-10 pb-10">
      <div className="mb-6 pt-6">
        <Breadcrumbs items={[
          { label: 'Community moderation', href: '/dash/communities', icon: <MessagesSquare size={14} /> }
        ]} />
        <div className="mt-4">
          <h1 className="text-3xl font-bold">Community moderation</h1>
          <p className="text-sm text-gray-500 mt-1">Everyone on the platform can post. Remove anything that breaks the rules.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
        {communities.map((community) => (
          <div key={community.community_uuid}>
            <CommunityCard community={community} orgslug={orgslug} org_id={org_id} />
          </div>
        ))}
        {communities.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-400">
            {t('dashboard.courses.communities.no_communities')}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl nice-shadow">
        <div className="flex flex-col bg-gray-50 -space-y-1 px-5 py-3 rounded-t-xl">
          <h2 className="font-bold text-xl text-gray-800">Recent posts</h2>
          <p className="text-gray-500 text-sm">The newest discussions and replies across every community</p>
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-gray-400">Loading…</div>
        ) : !activity || activity.length === 0 ? (
          <div className="p-6 text-sm text-gray-400">Nothing has been posted yet.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {activity.map((item: CommunityActivityItem) => (
              <li key={`${item.type}-${item.uuid}`} className="px-5 py-4 flex gap-4 items-start">
                <div className="mt-1 text-gray-400">
                  {item.type === 'discussion' ? <MessagesSquare size={16} /> : <MessageCircle size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-400">
                    @{item.author.username} · {item.community_name} · {item.type === 'comment' ? 'reply in ' : ''}
                    <Link
                      href={getUriWithOrg(orgslug, `/community/${item.community_uuid.replace('community_', '')}/discussion/${item.discussion_uuid.replace('discussion_', '')}`)}
                      className="font-semibold text-gray-600 hover:underline"
                    >
                      {item.title}
                    </Link>
                  </div>
                  <p className="text-sm text-gray-800 mt-1 line-clamp-3 whitespace-pre-line">{item.content}</p>
                  <div className="flex gap-2 mt-1">
                    {item.is_pinned && <span className="text-[10px] font-bold uppercase text-blue-600">Pinned</span>}
                    {item.is_locked && <span className="text-[10px] font-bold uppercase text-amber-600">Locked</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.type === 'discussion' && (
                    <>
                      <button
                        onClick={() => run(() => pinDiscussion(item.uuid, !item.is_pinned, access_token), item.is_pinned ? 'Unpinned' : 'Pinned')}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <Pin size={12} /> {item.is_pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        onClick={() => run(() => lockDiscussion(item.uuid, !item.is_locked, access_token), item.is_locked ? 'Unlocked' : 'Locked')}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <Lock size={12} /> {item.is_locked ? 'Unlock' : 'Lock'}
                      </button>
                    </>
                  )}
                  <ConfirmationModal
                    confirmationButtonText="Remove"
                    confirmationMessage={item.type === 'discussion' ? 'Remove this discussion and all of its replies?' : 'Remove this reply?'}
                    dialogTitle="Remove post"
                    dialogTrigger={
                      <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-md transition-colors">
                        <Trash2 size={12} /> Remove
                      </button>
                    }
                    functionToExecute={() => run(
                      () => item.type === 'discussion' ? deleteDiscussion(item.uuid, access_token) : deleteComment(item.uuid, access_token),
                      'Removed'
                    )}
                    status="warning"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default CommunitiesDashClient
