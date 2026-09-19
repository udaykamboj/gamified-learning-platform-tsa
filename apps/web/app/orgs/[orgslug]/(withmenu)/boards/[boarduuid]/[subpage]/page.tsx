'use client'

import React, { use } from 'react'
import Link from 'next/link'
import { Info, Globe, Users, Image as ImageIcon, Eye, Lock, Calendar } from 'lucide-react'
import { ChalkboardSimple } from '@phosphor-icons/react'
import dayjs from 'dayjs'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { getBoardThumbnailMediaDirectory } from '@services/media/media'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getBoard } from '@services/boards/boards'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import BoardGeneralTab from '@components/Dashboard/Boards/Tabs/BoardGeneralTab'
import BoardThumbnailTab from '@components/Dashboard/Boards/Tabs/BoardThumbnailTab'
import BoardAccessTab from '@components/Dashboard/Boards/Tabs/BoardAccessTab'
import BoardMembersTab from '@components/Dashboard/Boards/Tabs/BoardMembersTab'
import { useTranslation } from 'react-i18next'

export type BoardSettingsParams = {
  orgslug: string
  boarduuid: string
  subpage: string
}

function BoardSettingsPage(props: { params: Promise<BoardSettingsParams> }) {
  const params = use(props.params)
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const { t } = useTranslation()

  const boardUuid = params.boarduuid.startsWith('board_')
    ? params.boarduuid
    : `board_${params.boarduuid}`

  const { data: board, isLoading } = useQuery({
    queryKey: queryKeys.boards.detail(boardUuid),
    queryFn: () => getBoard(boardUuid, access_token!),
    enabled: !!access_token && !!boardUuid,
    staleTime: 60_000,
  })

  const tabs = [
    {
      key: 'general',
      label: t('boards.general.title', 'General'),
      description: t('boards.general.description', 'Basic board information and details'),
      icon: <Info size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/boards/${params.boarduuid}/general`,
      active: params.subpage === 'general',
    },
    {
      key: 'thumbnail',
      label: t('boards.thumbnail.title', 'Thumbnail'),
      description: t('boards.thumbnail.description', 'Board cover image shown on cards'),
      icon: <ImageIcon size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/boards/${params.boarduuid}/thumbnail`,
      active: params.subpage === 'thumbnail',
    },
    {
      key: 'access',
      label: t('boards.access.title', 'Sharing'),
      description: t('boards.access.description', 'Configure public link sharing or private member access'),
      icon: <Globe size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/boards/${params.boarduuid}/access`,
      active: params.subpage === 'access',
    },
    {
      key: 'members',
      label: t('boards.members.title', 'Members'),
      description: t('boards.members.description', 'Manage collaborators and roles for this board'),
      icon: <Users size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/boards/${params.boarduuid}/members`,
      active: params.subpage === 'members',
    },
  ]

  const currentTab = tabs.find((t) => t.active) || tabs[0]

  if (isLoading || !board) {
    return (
      <GeneralWrapperStyled>
        <div className="pb-4">
          <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex flex-col md:flex-row gap-5 pt-2 animate-pulse">
          <div className="hidden md:block w-56 flex-shrink-0 space-y-3">
            <div className="w-full aspect-video bg-gray-200 rounded-lg" />
            <div className="bg-white nice-shadow rounded-lg p-3 space-y-3">
              <div className="h-3 w-16 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-full bg-gray-100 rounded" />
            </div>
            <div className="bg-white nice-shadow rounded-lg p-2 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="bg-white nice-shadow rounded-lg p-6 space-y-4">
              <div className="h-5 w-40 bg-gray-200 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-24 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      </GeneralWrapperStyled>
    )
  }

  const thumbnailUrl = board.thumbnail_image
    ? getBoardThumbnailMediaDirectory(org?.org_uuid, boardUuid, board.thumbnail_image)
    : '/empty_thumbnail.png'

  const canvasLink = `/board/${boardUuid.replace('board_', '')}`
  const createdDate = board.creation_date ? dayjs(board.creation_date).format('MMM D, YYYY') : null

  return (
    <GeneralWrapperStyled>
      {/* Breadcrumbs */}
      <div className="pb-4">
        <Breadcrumbs
          items={[
            { label: t('boards.boards', 'Boards'), href: '/boards', icon: <ChalkboardSimple size={14} /> },
            { label: board.name },
          ]}
        />
      </div>

      <div className="flex flex-col md:flex-row gap-5 pt-2">
        {/* ── Left Sidebar — 220px (matches Playground layout) ── */}
        <div className="hidden md:block w-56 flex-shrink-0">
          <div className="sticky top-24 space-y-3">
            {/* Thumbnail */}
            <div className="bg-white nice-shadow rounded-lg overflow-hidden">
              <img
                src={thumbnailUrl}
                alt={board.name}
                className="w-full aspect-video object-cover"
              />
            </div>

            {/* Info card */}
            <div className="bg-white nice-shadow rounded-lg overflow-hidden">
              <div className="p-3 border-b border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {t('playgrounds.view.about', 'About')}
                </p>
                <h1 className="text-sm font-bold text-gray-900 leading-snug">
                  {board.name}
                </h1>
                {board.description && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-4">
                    {board.description}
                  </p>
                )}
              </div>

              <div className="px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">{t('playgrounds.view.access', 'Access')}</span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    board.public ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {board.public ? <Globe size={10} /> : <Lock size={10} />}
                    {board.public ? t('boards.public', 'Public') : t('boards.private', 'Private')}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">{t('boards.members.title', 'Members')}</span>
                  <span className="flex items-center gap-1 text-xs text-gray-700 font-medium">
                    <Users size={12} className="text-gray-400" />
                    {board.member_count ?? 1}
                  </span>
                </div>

                {createdDate && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">{t('playgrounds.view.created', 'Created')}</span>
                    <span className="flex items-center gap-1 text-xs text-gray-700">
                      <Calendar size={10} className="text-gray-400" />
                      {createdDate}
                    </span>
                  </div>
                )}
              </div>

              <div className="px-3 pb-3">
                <Link
                  href={canvasLink}
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-bold bg-black hover:bg-gray-800 text-white transition-colors"
                >
                  <Eye size={12} />
                  {t('boards.open_board', 'Open Board Canvas')}
                </Link>
              </div>
            </div>

            {/* Section Navigation Tabs Card */}
            <div className="bg-white nice-shadow rounded-lg p-1.5 space-y-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2.5 py-1.5">
                Settings & Navigation
              </p>
              {tabs.map((tab) => (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                    tab.active
                      ? 'bg-neutral-100 text-black font-semibold'
                      : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main Content Area — Right side ── */}
        <div className="flex-1 min-w-0">
          {/* Mobile Sub-Navigation tabs */}
          <div className="md:hidden mb-4 bg-white nice-shadow rounded-lg p-1.5 flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  tab.active
                    ? 'bg-black text-white font-semibold'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </Link>
            ))}
          </div>

          {/* Right Settings Container */}
          <div className="bg-white nice-shadow rounded-lg overflow-hidden">
            {/* Header with section title & "Open Board" button */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {currentTab.label}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {currentTab.description}
                </p>
              </div>
              <Link
                href={canvasLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors"
              >
                <Eye size={13} />
                <span>{t('boards.open_board', 'Open Canvas')}</span>
              </Link>
            </div>

            {/* Tab Body */}
            <div className="p-5">
              {params.subpage === 'general' && (
                <BoardGeneralTab board={board} boardUuid={boardUuid} />
              )}
              {params.subpage === 'thumbnail' && (
                <BoardThumbnailTab board={board} boardUuid={boardUuid} orgUuid={org?.org_uuid} />
              )}
              {params.subpage === 'access' && (
                <BoardAccessTab board={board} boardUuid={boardUuid} />
              )}
              {params.subpage === 'members' && (
                <BoardMembersTab boardUuid={boardUuid} />
              )}
            </div>
          </div>
        </div>
      </div>
    </GeneralWrapperStyled>
  )
}

export default BoardSettingsPage
