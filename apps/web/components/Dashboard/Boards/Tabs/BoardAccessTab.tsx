'use client'

import React, { useState, useEffect } from 'react'
import { Globe, Users } from 'lucide-react'
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
  boardKey: string | null
}

// A board is private to its owner and the members they add (Members tab), or
// public to anyone with the link. There is no group-based access.
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
      toast.success(value ? t('boards.access.board_set_public') : t('boards.access.board_set_private'))
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(boardUuid) })
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.list(org?.slug) })
    } catch {
      setIsPublic(!value)
      toast.error(t('boards.access.access_update_error'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <div className="h-6"></div>
      <div className="mx-4 sm:mx-10 bg-white rounded-xl shadow-xs px-4 py-4">
        <div className="flex flex-col bg-gray-50 -space-y-1 px-3 sm:px-5 py-3 rounded-md mb-3">
          <h1 className="font-bold text-lg sm:text-xl text-gray-800">{t('boards.access.title')}</h1>
          <h2 className="text-gray-500 text-xs sm:text-sm">{t('boards.access.description')}</h2>
        </div>
        <div className={`flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0 mx-auto mb-3 ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}>
          <ConfirmationModal
            confirmationButtonText={t('boards.access.set_to_public')}
            confirmationMessage={t('boards.access.set_to_public_confirm')}
            dialogTitle={t('boards.access.make_board_public')}
            dialogTrigger={
              <div className="w-full h-[200px] bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200 transition-all">
                {isPublic && (
                  <div className="bg-green-200 text-green-600 font-bold w-fit my-3 mx-3 absolute text-sm px-3 py-1 rounded-lg">
                    {t('boards.access.active')}
                  </div>
                )}
                <div className="flex flex-col space-y-1 justify-center items-center h-full p-2 sm:p-4">
                  <Globe className="text-slate-400" size={32} />
                  <div className="text-xl sm:text-2xl text-slate-700 font-bold">{t('boards.access.public_option')}</div>
                  <div className="text-gray-400 text-sm sm:text-md tracking-tight w-full sm:w-[500px] leading-5 text-center">
                    {t('boards.access.public_description')}
                  </div>
                </div>
              </div>
            }
            functionToExecute={() => handleSetAccess(true)}
            status="info"
          />
          <ConfirmationModal
            confirmationButtonText={t('boards.access.set_to_private')}
            confirmationMessage={t('boards.access.set_to_private_confirm')}
            dialogTitle={t('boards.access.make_board_private')}
            dialogTrigger={
              <div className="w-full h-[200px] bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200 transition-all">
                {!isPublic && (
                  <div className="bg-green-200 text-green-600 font-bold w-fit my-3 mx-3 absolute text-sm px-3 py-1 rounded-lg">
                    {t('boards.access.active')}
                  </div>
                )}
                <div className="flex flex-col space-y-1 justify-center items-center h full p-2 sm:p-4">
                  <Users className="text-slate-400" size={32} />
                  <div className="text-xl sm:text-2xl text-slate-700 font-bold">{t('boards.access.private_option')}</div>
                  <div className="text-gray-400 text-sm sm:text-md tracking-tight w-full sm:w-[500px] leading-5 text-center">
                    {t('boards.access.private_description')}
                  </div>
                </div>
              </div>
            }
            functionToExecute={() => handleSetAccess(false)}
            status="info"
          />
        </div>

      </div>
    </div>
  )
}

export default BoardAccessTab
