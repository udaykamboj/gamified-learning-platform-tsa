'use client'

import React, { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { updateBoard } from '@services/boards/boards'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useTranslation } from 'react-i18next'

interface BoardGeneralTabProps {
  board: any
  boardUuid: string
  boardKey: string | null
}

function BoardGeneralTab({ board, boardUuid, boardKey }: BoardGeneralTabProps) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const [name, setName] = useState(board.name)
  const [description, setDescription] = useState(board.description || '')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setName(board.name)
    setDescription(board.description || '')
  }, [board.name, board.description])

  const hasChanges = name !== board.name || description !== (board.description || '')

  const handleSave = async () => {
    if (!name.trim()) return
    setIsSaving(true)
    try {
      await updateBoard(boardUuid, { name, description }, access_token)
      toast.success(t('boards.general.board_updated'))
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(boardUuid) })
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.list(org?.slug) })
    } catch {
      toast.error(t('boards.general.board_updated_error'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <div className="sl-card p-4 sm:p-6">
        <div className="flex flex-col gap-1 pb-4 mb-4 border-b border-border">
          <h1 className="sl-section-title">{t('boards.general.title')}</h1>
          <h2 className="text-ui text-muted-foreground">{t('boards.general.description')}</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">{t('boards.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sl-input w-full mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{t('boards.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="sl-input w-full mt-1"
              rows={3}
            />
          </div>
          {hasChanges && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving || !name.trim()}
                className="sl-btn sl-btn-primary"
              >
                <Save size={14} />
                {isSaving ? t('boards.general.saving') : t('boards.general.save_changes')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BoardGeneralTab
