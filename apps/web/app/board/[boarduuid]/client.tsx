'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getBoard } from '@services/boards/boards'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import BoardCanvas from '@components/Dashboard/Boards/BoardCanvas'
import { useTrackView, AnalyticsEvent } from '@services/analytics'
import { useLHSession } from '@components/Contexts/LHSessionContext'

interface BoardCanvasClientProps {
  boardUuid: string
  /**
   * Server-read access token. Absent whenever the access-token cookie has
   * lapsed (every visit more than 8 hours after the last one) — the server
   * deliberately does not refresh, because refreshing there would consume the
   * browser's one-time-use refresh token. We fall back to the client session,
   * which holds a freshly refreshed token once AuthContext has hydrated.
   */
  accessToken?: string
  orgslug: string
  username: string
}

export default function BoardCanvasClient({ boardUuid, accessToken, orgslug, username }: BoardCanvasClientProps) {
  const session = useLHSession() as any
  const token: string | undefined = accessToken || session?.data?.tokens?.access_token
  const displayName =
    username || session?.data?.user?.username || session?.data?.user?.email || 'Anonymous'

  const { data: board, isLoading, error } = useQuery({
    queryKey: queryKeys.boards.detail(boardUuid),
    // Guarded by `enabled` — queryFn never runs without a token.
    queryFn: () => getBoard(boardUuid, token as string),
    enabled: !!token,
    staleTime: 60_000,
  })

  // Fetch org info to get org_uuid for media URLs in board blocks
  const { data: orgData } = useQuery({
    queryKey: queryKeys.org.detail(orgslug),
    queryFn: () => getOrganizationContextInfo(orgslug, null, token),
    enabled: !!orgslug && !!token,
    staleTime: 60_000,
  })

  useTrackView(
    AnalyticsEvent.BoardViewed,
    { is_public: board?.public ?? false },
    !isLoading && !!board,
    'learner',
  )

  // No token yet means AuthContext is still trading the refresh cookie for an
  // access token. The board query is disabled until then, so keep showing the
  // spinner rather than falling through to "not found".
  if (!token || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background" aria-busy="true">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (error || !board) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="sl-card max-w-sm p-6 text-center">
          <p className="text-ui text-muted-foreground">Board not found or access denied.</p>
        </div>
      </div>
    )
  }

  // The whiteboard is a light drawing surface in both appearances: pin its
  // chrome to the light tokens so toolbars never mix dark controls onto it.
  return (
    <div className="sl-theme-light contents">
      <BoardCanvas
        board={board}
        accessToken={token}
        orgslug={orgslug}
        username={displayName}
        orgUuid={orgData?.org_uuid || ''}
      />
    </div>
  )
}
