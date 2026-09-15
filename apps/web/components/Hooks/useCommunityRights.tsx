'use client'
import { getCommunityRights, CommunityRights } from '@services/communities/communities'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useLHSession } from '@components/Contexts/LHSessionContext'

export type { CommunityRights }

// Members read and post; moderators (the platform's admins) moderate.
export function useCommunityRights(communityuuid: string) {
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token

  const { data: rights, error, isLoading } = useQuery<CommunityRights>({
    queryKey: queryKeys.community.rights(communityuuid),
    queryFn: () => getCommunityRights(communityuuid, access_token),
    enabled: !!communityuuid && !!access_token,
    staleTime: 60_000,
  })

  return {
    rights,
    error,
    isLoading,
    hasPermission: (permission: keyof CommunityRights['permissions']) => {
      return rights?.permissions?.[permission] ?? false
    },
    isModerator: rights?.ownership?.is_moderator ?? false,
    canCreateDiscussion: rights?.permissions?.create_discussion ?? false,
    canManageCommunity: rights?.permissions?.moderate ?? false,
  }
}
