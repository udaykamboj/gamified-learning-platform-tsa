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
  boardKey?: string | null
}

function BoardGeneralTab({ board, boardUuid, boardKey: _boardKey }: BoardGeneralTabProps) {
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
      toast.success(t('boards.general.board_updated', 'Board updated'))
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(boardUuid) })
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.list(org?.slug) })
    } catch {
      toast.error(t('boards.general.board_updated_error', 'Failed to update board'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700">{t('boards.name', 'Name')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">{t('boards.description', 'Description')}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1"
          rows={3}
        />
      </div>
      {hasChanges && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {isSaving ? t('boards.general.saving', 'Saving...') : t('boards.general.save_changes', 'Save Changes')}
          </button>
        </div>
      )}
    </div>
  )
}

export default BoardGeneralTab
