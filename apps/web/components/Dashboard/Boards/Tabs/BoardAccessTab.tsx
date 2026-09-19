'use client'

import React, { useState, useEffect } from 'react'
import { Globe, Users, Lock } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { updateBoard } from '@services/boards/boards'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

interface BoardAccessTabProps {
  board: any
  boardUuid: string
  boardKey?: string | null
}

function BoardAccessTab({ board, boardUuid, boardKey: _boardKey }: BoardAccessTabProps) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const [isPublic, setIsPublic] = useState<boolean>(board.public ?? true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setIsPublic(board.public ?? true)
  }, [board.public])

  const handleSetAccess = async (value: boolean) => {
    setIsSaving(true)
    setIsPublic(value)
    try {
      await updateBoard(boardUuid, { public: value }, access_token)
      toast.success(value ? t('boards.access.board_set_public', 'Board set to public') : t('boards.access.board_set_private', 'Board set to private'))
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(boardUuid) })
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.list(org?.slug) })
    } catch {
      setIsPublic(!value)
      toast.error(t('boards.access.access_update_error', 'Failed to update access'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}>
        <ConfirmationModal
          confirmationButtonText={t('boards.access.set_to_public', 'Set to Public')}
          confirmationMessage={t('boards.access.set_to_public_confirm', 'Are you sure you want to make this board public? Anyone with the link will be able to view it.')}
          dialogTitle={t('boards.access.make_board_public', 'Make Board Public')}
          dialogTrigger={
            <div className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer text-start flex flex-col justify-between h-48 ${
              isPublic ? 'border-black bg-neutral-50/60' : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}>
              {isPublic && (
                <div className="absolute top-3 end-3 bg-green-100 text-green-700 font-bold text-xs px-2.5 py-0.5 rounded-full">
                  {t('boards.access.active', 'Active')}
                </div>
              )}
              <div className="w-10 h-10 rounded-lg bg-white nice-shadow flex items-center justify-center text-black mb-3">
                <Globe size={20} />
              </div>
              <div>
                <div className="text-base font-bold text-gray-900 mb-1">
                  {t('boards.access.public_option', 'Public')}
                </div>
                <div className="text-xs text-gray-500 leading-relaxed">
                  {t('boards.access.public_description', 'Anyone with the link can view this board.')}
                </div>
              </div>
            </div>
          }
          functionToExecute={() => handleSetAccess(true)}
          status="info"
        />

        <ConfirmationModal
          confirmationButtonText={t('boards.access.set_to_private', 'Set to Private')}
          confirmationMessage={t('boards.access.set_to_private_confirm', 'Are you sure you want to make this board private? Only members added will be able to view and edit.')}
          dialogTitle={t('boards.access.make_board_private', 'Make Board Private')}
          dialogTrigger={
            <div className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer text-start flex flex-col justify-between h-48 ${
              !isPublic ? 'border-black bg-neutral-50/60' : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}>
              {!isPublic && (
                <div className="absolute top-3 end-3 bg-green-100 text-green-700 font-bold text-xs px-2.5 py-0.5 rounded-full">
                  {t('boards.access.active', 'Active')}
                </div>
              )}
              <div className="w-10 h-10 rounded-lg bg-white nice-shadow flex items-center justify-center text-black mb-3">
                <Lock size={20} />
              </div>
              <div>
                <div className="text-base font-bold text-gray-900 mb-1">
                  {t('boards.access.private_option', 'Private')}
                </div>
                <div className="text-xs text-gray-500 leading-relaxed">
                  {t('boards.access.private_description', 'Only explicitly added members can access this board.')}
                </div>
              </div>
            </div>
          }
          functionToExecute={() => handleSetAccess(false)}
          status="info"
        />
      </div>
    </div>
  )
}

export default BoardAccessTab
