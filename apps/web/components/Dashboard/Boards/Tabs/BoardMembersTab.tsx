'use client'

import React, { useState } from 'react'
import { UserPlus, Trash2, Search } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { addBoardMember, getBoardMembers, removeBoardMember } from '@services/boards/boards'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import UserAvatar from '@components/Objects/UserAvatar'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'

interface BoardMembersTabProps {
  boardUuid: string
}

function BoardMembersTab({ boardUuid }: BoardMembersTabProps) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: queryKeys.boards.members(boardUuid),
    queryFn: () => getBoardMembers(boardUuid, access_token),
    enabled: !!access_token && !!boardUuid,
    staleTime: 60_000,
  })

  const [addMemberModal, setAddMemberModal] = useState(false)

  const handleRemoveMember = async (userId: number) => {
    try {
      await removeBoardMember(boardUuid, userId, access_token)
      toast.success(t('boards.members.member_removed'))
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.members(boardUuid) })
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(boardUuid) })
    } catch {
      toast.error(t('boards.members.member_removed_error'))
    }
  }

  const membersList = members || []

  if (membersLoading) {
    return (
      <div>
        <div className="h-6"></div>
        <div className="mx-4 sm:mx-10 bg-card rounded-xl shadow-xs px-4 py-4 animate-pulse">
          <div className="flex flex-col bg-gray-50 px-3 sm:px-5 py-3 rounded-md mb-3 gap-2">
            <div className="h-5 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-64 bg-gray-100 rounded" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 py-3 px-4 border-b border-gray-100">
                <div className="w-7 h-7 bg-gray-200 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-40" />
                </div>
                <div className="h-5 w-14 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="h-6"></div>
      <div className="mx-4 sm:mx-10 bg-card rounded-xl shadow-xs px-4 py-4">
        <div className="flex flex-col bg-gray-50 -space-y-1 px-3 sm:px-5 py-3 rounded-md mb-3">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-lg sm:text-xl text-gray-800">{t('boards.members.title')}</h1>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              membersList.length >= 10 ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'
            }`}>
              {membersList.length} / 10
            </span>
          </div>
          <h2 className="text-gray-500 text-xs sm:text-sm">{t('boards.members.description')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table-auto w-full text-start whitespace-nowrap rounded-md overflow-hidden">
            <thead className="bg-gray-100 text-gray-500 rounded-xl uppercase">
              <tr className="font-bolder text-sm">
                <th className="py-3 px-4">{t('boards.members.user')}</th>
                <th className="py-3 px-4">{t('boards.members.role')}</th>
                <th className="py-3 px-4">{t('boards.members.actions')}</th>
              </tr>
            </thead>
            <tbody className="mt-5 bg-card rounded-md">
              {membersList.map((member: any) => (
                <tr key={member.id} className="border-b border-gray-100 text-sm">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        border="border-2"
                        rounded="rounded-full"
                        avatar_url={
                          member.avatar_image && member.user_uuid
                            ? getUserAvatarMediaDirectory(member.user_uuid, member.avatar_image)
                            : ''
                        }
                        predefined_avatar={member.avatar_image ? undefined : 'empty'}
                        width={28}
                      />
                      <div>
                        <div className="font-medium text-gray-900">{member.username || 'Unknown'}</div>
                        {member.email && (
                          <div className="text-xs text-gray-400">{member.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                      member.role === 'owner'
                        ? 'bg-purple-100 text-purple-700'
                        : member.role === 'editor'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {member.role !== 'owner' && (
                      <ConfirmationModal
                        confirmationButtonText={t('boards.members.remove')}
                        confirmationMessage={t('boards.members.remove_confirm', { name: member.username || 'this user' })}
                        dialogTitle={t('boards.members.remove_member')}
                        dialogTrigger={
                          <button className="flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded-md text-sm transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('boards.members.remove')}
                          </button>
                        }
                        functionToExecute={() => handleRemoveMember(member.user_id)}
                        status="warning"
                      />
                    )}
                  </td>
                </tr>
              ))}
              {membersList.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 px-4 text-center text-gray-400 text-sm">
                    {t('boards.members.no_members')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-row-reverse mt-3 me-2 items-center gap-3">
          {membersList.length >= 10 ? (
            <span className="text-xs text-red-500 font-medium">{t('boards.members.member_limit_reached')}</span>
          ) : (
            <Modal
              isDialogOpen={addMemberModal}
              onOpenChange={setAddMemberModal}
              minHeight="no-min"
              minWidth="md"
              dialogContent={
                <AddBoardMember
                  boardUuid={boardUuid}
                  accessToken={access_token}
                  setModalOpen={setAddMemberModal}
                />
              }
              dialogTitle={t('boards.members.add_member')}
              dialogDescription={t('boards.members.add_member_description')}
              dialogTrigger={
                <button className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md font-bold text-sm hover:bg-primary transition-colors">
                  <UserPlus className="w-4 h-4" />
                  <span>{t('boards.members.add_member')}</span>
                </button>
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Students add people they know by username or email; there is no directory
// of every member to browse.
function AddBoardMember({ boardUuid, accessToken, setModalOpen }: {
  boardUuid: string
  accessToken: string
  setModalOpen: (_open: boolean) => void
}) {
  const { t } = useTranslation()
  const { track } = useLHAnalytics('learner')
  const queryClient = useQueryClient()
  const [identifier, setIdentifier] = useState('')
  const [role, setRole] = useState('editor')
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async () => {
    const value = identifier.trim()
    if (!value) return
    setIsAdding(true)
    try {
      await addBoardMember(boardUuid, { identifier: value, role }, accessToken)
      track(AnalyticsEvent.BoardMemberAdded, { added_count: 1, role })
      toast.success(t('boards.members.member_added'))
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.members(boardUuid) })
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(boardUuid) })
    } catch (err: any) {
      toast.error(err?.detail || t('boards.members.member_added_error'))
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Username or email"
          className="w-full ps-10 pe-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-border focus:border-gray-400 transition-all"
          autoFocus
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('boards.members.role_label')}</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-border focus:border-gray-400 transition-all"
          >
            <option value="editor">{t('boards.members.editor')}</option>
            <option value="viewer">{t('boards.members.viewer')}</option>
          </select>
        </div>
        <button
          onClick={handleAdd}
          disabled={!identifier.trim() || isAdding}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary transition-all"
        >
          <UserPlus className="w-4 h-4" />
          {isAdding ? t('boards.members.adding') : t('boards.members.add_member')}
        </button>
      </div>
    </div>
  )
}

export default BoardMembersTab
