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
      <div className="sl-card p-4 sm:p-6">
        <div className="flex flex-col gap-1 pb-4 mb-4 border-b border-border">
          <h1 className="sl-section-title">{t('boards.access.title')}</h1>
          <h2 className="text-ui text-muted-foreground">{t('boards.access.description')}</h2>
        </div>
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}>
          <ConfirmationModal
            confirmationButtonText={t('boards.access.set_to_public')}
            confirmationMessage={t('boards.access.set_to_public_confirm')}
            dialogTitle={t('boards.access.make_board_public')}
            dialogTrigger={
              <div
                className={`relative w-full min-h-[200px] rounded-xl border cursor-pointer transition-colors ${isPublic ? 'border-primary bg-selected' : 'border-border bg-card hover:bg-hover'}`}
              >
                {isPublic && (
                  <span className="sl-badge sl-badge-success absolute top-3 start-3">
                    {t('boards.access.active')}
                  </span>
                )}
                <div className="flex flex-col gap-2 justify-center items-center h-full min-h-[200px] p-4 sm:p-6 text-center">
                  <Globe className="text-muted-foreground" size={28} aria-hidden />
                  <div className="sl-section-title">{t('boards.access.public_option')}</div>
                  <div className="text-ui text-muted-foreground max-w-sm">
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
              <div
                className={`relative w-full min-h-[200px] rounded-xl border cursor-pointer transition-colors ${!isPublic ? 'border-primary bg-selected' : 'border-border bg-card hover:bg-hover'}`}
              >
                {!isPublic && (
                  <span className="sl-badge sl-badge-success absolute top-3 start-3">
                    {t('boards.access.active')}
                  </span>
                )}
                <div className="flex flex-col gap-2 justify-center items-center h-full min-h-[200px] p-4 sm:p-6 text-center">
                  <Users className="text-muted-foreground" size={28} aria-hidden />
                  <div className="sl-section-title">{t('boards.access.private_option')}</div>
                  <div className="text-ui text-muted-foreground max-w-sm">
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
