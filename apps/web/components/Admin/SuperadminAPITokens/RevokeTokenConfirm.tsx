'use client'
import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getAPIUrl } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { Warning } from '@phosphor-icons/react'
import type { SuperadminToken } from '@components/Admin/SuperadminAPITokens/TokenList'

export default function RevokeTokenConfirm({
  token,
  onClose,
}: {
  token: SuperadminToken | null
  onClose: () => void
}) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!token) return null

  const handleRevoke = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${getAPIUrl()}ee/superadmin/tokens/${token.token_uuid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.detail || `Failed to revoke (${res.status})`)
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.superadmin.apiTokens() })
      onClose()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-scrim backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Warning size={18} weight="fill" className="text-red-700" />
            <h2 className="text-base font-semibold text-foreground">Revoke token?</h2>
          </div>
        </div>

        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            Revoking <strong className="text-foreground">{token.name}</strong> immediately stops it from authenticating.
            Any tooling that depends on this token will start failing with 401.
          </p>
          <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleRevoke}
            disabled={submitting}
            className="px-3.5 py-2 bg-red-100 hover:bg-red-500/30 text-red-700 text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Revoking…' : 'Revoke token'}
          </button>
        </div>
      </div>
    </div>
  )
}
