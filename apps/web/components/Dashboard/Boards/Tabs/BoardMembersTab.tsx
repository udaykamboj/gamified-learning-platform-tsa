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
      toast.success(t('boards.members.member_removed', 'Member removed'))
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.members(boardUuid) })
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(boardUuid) })
    } catch {
      toast.error(t('boards.members.member_removed_error', 'Failed to remove member'))
    }
  }

  const membersList = members || []

  if (membersLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="flex items-center justify-between py-2">
          <div className="h-5 w-32 bg-gray-200 rounded" />
          <div className="h-5 w-16 bg-gray-100 rounded-full" />
        </div>
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
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">{t('boards.members.title', 'Board Members')}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            membersList.length >= 10 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
          }`}>
            {membersList.length} / 10
          </span>
        </div>

        {membersList.length >= 10 ? (
          <span className="text-xs text-red-500 font-medium">{t('boards.members.member_limit_reached', 'Limit reached')}</span>
        ) : (
          <Modal
            isDialogOpen={addMemberModal}
            onOpenChange={setAddMemberModal}
            customWidth="sm:max-w-md"
            dialogContent={
              <AddBoardMember
                boardUuid={boardUuid}
                accessToken={access_token}
                setModalOpen={setAddMemberModal}
              />
            }
            dialogTitle={t('boards.members.add_member', 'Add Member')}
            dialogDescription={t('boards.members.add_member_description', 'Invite someone to collaborate on this board.')}
            dialogTrigger={
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-lg font-bold text-xs hover:bg-gray-800 transition-colors">
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t('boards.members.add_member', 'Add Member')}</span>
              </button>
            }
          />
        )}
      </div>

      <div className="overflow-x-auto border border-gray-100 rounded-lg">
        <table className="table-auto w-full text-start whitespace-nowrap">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
            <tr className="font-semibold text-start">
              <th className="py-2.5 px-4 text-start">{t('boards.members.user', 'User')}</th>
              <th className="py-2.5 px-4 text-start">{t('boards.members.role', 'Role')}</th>
              <th className="py-2.5 px-4 text-end">{t('boards.members.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {membersList.map((member: any) => (
              <tr key={member.id} className="text-sm">
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
                <td className="py-3 px-4 text-end">
                  {member.role !== 'owner' && (
                    <ConfirmationModal
                      confirmationButtonText={t('boards.members.remove', 'Remove')}
                      confirmationMessage={t('boards.members.remove_confirm', {
                        name: member.username || 'this user',
                        defaultValue: `Are you sure you want to remove ${member.username || 'this user'}?`,
                      })}
                      dialogTitle={t('boards.members.remove_member', 'Remove Member')}
                      dialogTrigger={
                        <button className="inline-flex items-center gap-1 px-2.5 py-1 text-red-600 hover:bg-red-50 rounded-md text-xs font-medium transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                          {t('boards.members.remove', 'Remove')}
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
                <td colSpan={3} className="py-8 px-4 text-center text-gray-400 text-sm">
                  {t('boards.members.no_members', 'No members added yet.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

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
      toast.success(t('boards.members.member_added', 'Member added'))
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.members(boardUuid) })
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(boardUuid) })
    } catch (err: any) {
      toast.error(err?.detail || t('boards.members.member_added_error', 'Failed to add member'))
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="space-y-4 p-1">
      <div>
        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 block">
          User Identifier
        </label>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Username or email"
            className="w-full ps-10 pe-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1 transition-all"
            autoFocus
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 block">
          {t('boards.members.role_label', 'Role')}
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1 transition-all"
        >
          <option value="editor">{t('boards.members.editor', 'Editor')}</option>
          <option value="viewer">{t('boards.members.viewer', 'Viewer')}</option>
        </select>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={() => setModalOpen(false)}
          className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          onClick={handleAdd}
          disabled={!identifier.trim() || isAdding}
          className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-gray-800 transition-colors"
        >
          {isAdding ? t('boards.members.adding', 'Adding...') : t('boards.members.add_member', 'Add Member')}
        </button>
      </div>
    </div>
  )
}

export default BoardMembersTab
