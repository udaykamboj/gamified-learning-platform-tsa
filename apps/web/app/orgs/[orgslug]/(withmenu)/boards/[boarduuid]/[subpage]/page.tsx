'use client'
import React, { use } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { Info, Globe, Users, Image as ImageIcon, Eye } from 'lucide-react'
import { ChalkboardSimple } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { getBoardThumbnailMediaDirectory } from '@services/media/media'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getBoard } from '@services/boards/boards'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import BoardGeneralTab from '@components/Dashboard/Boards/Tabs/BoardGeneralTab'
import BoardThumbnailTab from '@components/Dashboard/Boards/Tabs/BoardThumbnailTab'
import BoardAccessTab from '@components/Dashboard/Boards/Tabs/BoardAccessTab'
import BoardMembersTab from '@components/Dashboard/Boards/Tabs/BoardMembersTab'
import { DashTabBar, DashTabItem } from '@components/Dashboard/Shared/DashTabBar/DashTabBar'

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

  const boardUuid = params.boarduuid.startsWith('board_')
    ? params.boarduuid
    : `board_${params.boarduuid}`

  const { data: board, isLoading } = useQuery({
    queryKey: queryKeys.boards.detail(boardUuid),
    queryFn: () => getBoard(boardUuid, access_token!),
    enabled: !!access_token && !!boardUuid,
    staleTime: 60_000,
  })

  // boardKey passed as null — tabs use queryKeys directly now
  const boardKey = null

  const tabs: DashTabItem[] = [
    {
      key: 'general',
      label: 'General',
      icon: <Info size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/boards/${params.boarduuid}/general`,
      active: params.subpage === 'general',
    },
    {
      key: 'thumbnail',
      label: 'Thumbnail',
      icon: <ImageIcon size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/boards/${params.boarduuid}/thumbnail`,
      active: params.subpage === 'thumbnail',
    },
    {
      key: 'access',
      label: 'Sharing',
      icon: <Globe size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/boards/${params.boarduuid}/access`,
      active: params.subpage === 'access',
    },
    {
      key: 'members',
      label: 'Members',
      icon: <Users size={16} />,
      href: getUriWithOrg(params.orgslug, '') + `/boards/${params.boarduuid}/members`,
      active: params.subpage === 'members',
    },
  ]

  const container = 'mx-auto w-full max-w-[1280px] px-4 md:px-6 xl:px-8'

  if (isLoading || !board) {
    return (
      <div className="w-full bg-background" aria-busy="true">
        <div className="border-b border-border bg-card">
          <div className={`${container} animate-pulse`}>
            <div className="pt-6 pb-4">
              <div className="h-4 w-40 rounded bg-muted" />
            </div>
            <div className="flex items-center gap-5 py-3">
              <div className="h-[57px] w-[100px] rounded-lg bg-muted" />
              <div className="flex flex-col gap-2">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-5 w-48 rounded bg-muted" />
              </div>
            </div>
            <div className="mt-2 flex gap-3 pb-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 w-24 rounded bg-muted" />
              ))}
            </div>
          </div>
        </div>
        <div className={`${container} py-8`}>
          <div className="sl-card space-y-4 p-6 animate-pulse">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-11 rounded-lg bg-muted" />
            <div className="h-11 rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    )
  }

  const thumbnailUrl = board.thumbnail_image
    ? getBoardThumbnailMediaDirectory(org?.org_uuid, boardUuid, board.thumbnail_image)
    : '/empty_thumbnail.png'

  return (
    <div className="w-full bg-background pb-16">
      <div className="border-b border-border bg-card">
        <div className={`${container} min-w-0`}>
          <div className="pt-6 pb-4">
            <Breadcrumbs items={[
              { label: 'Boards', href: '/boards', icon: <ChalkboardSimple size={14} /> },
              { label: board.name },
            ]} />
          </div>

          <div className="flex flex-wrap items-center gap-3 pb-2">
            <div className="flex min-w-0 grow items-center gap-3 sm:gap-5">
              <Link href={`/board/${boardUuid.replace('board_', '')}`} className="shrink-0">
                <img
                  className="h-[41px] w-[72px] rounded-lg border border-border object-cover sm:h-[57px] sm:w-[100px]"
                  src={thumbnailUrl}
                  alt=""
                />
              </Link>
              <div className="flex min-w-0 flex-col justify-center">
                <p className="sl-telemetry text-muted-foreground">Board settings</p>
                <h1 className="sl-page-title truncate first-letter:uppercase">{board.name}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`sl-badge min-h-9 px-3 ${board.public ? 'sl-badge-success' : 'sl-badge-warning'}`}>
                {board.public ? <Globe className="h-4 w-4" aria-hidden /> : <Users className="h-4 w-4" aria-hidden />}
                {board.public ? 'Public' : 'Private'}
              </span>
              <Link
                href={`/board/${boardUuid.replace('board_', '')}`}
                className="sl-btn sl-btn-secondary sl-btn-sm"
              >
                <Eye className="h-4 w-4" aria-hidden />
                View board
              </Link>
            </div>
          </div>

          <DashTabBar tabs={tabs} />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1, type: 'spring', stiffness: 80 }}
        className={`${container} py-8`}
      >
        {params.subpage === 'general' && (
          <BoardGeneralTab board={board} boardUuid={boardUuid} boardKey={boardKey} />
        )}
        {params.subpage === 'thumbnail' && (
          <BoardThumbnailTab board={board} boardUuid={boardUuid} orgUuid={org?.org_uuid} boardKey={boardKey} />
        )}
        {params.subpage === 'access' && (
          <BoardAccessTab board={board} boardUuid={boardUuid} boardKey={boardKey} />
        )}
        {params.subpage === 'members' && (
          <BoardMembersTab boardUuid={boardUuid} />
        )}
      </motion.div>
    </div>
  )
}

export default BoardSettingsPage
