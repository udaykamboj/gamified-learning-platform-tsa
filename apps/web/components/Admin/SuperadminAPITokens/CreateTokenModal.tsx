'use client'
import React, { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getAPIUrl } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { Key, X } from '@phosphor-icons/react'
import type { CreatedToken } from '@components/Admin/SuperadminAPITokens/TokenCreatedDialog'

export default function CreateTokenModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (_token: CreatedToken) => void
}) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [neverExpires, setNeverExpires] = useState(true)
  const [expiresAt, setExpiresAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setNeverExpires(true)
      setExpiresAt('')
      setError('')
      setSubmitting(false)
    }
  }, [open])

  if (!open) return null

  const canSubmit = name.trim().length > 0 && !submitting && (neverExpires || expiresAt.length > 0)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const body: Record<string, unknown> = { name: name.trim() }
      if (description.trim()) body.description = description.trim()
      if (!neverExpires && expiresAt) {
        // <input type="datetime-local"> emits "YYYY-MM-DDTHH:mm" — send as ISO.
        body.expires_at = new Date(expiresAt).toISOString()
      }

      const res = await fetch(`${getAPIUrl()}ee/superadmin/tokens/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.detail || `Failed to create token (${res.status})`)
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.superadmin.apiTokens() })
      onCreated(data as CreatedToken)
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Key size={18} weight="fill" className="text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">New API token</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <Field label="Name" required hint="Identifier shown in the token list. Required.">
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="acme-automation"
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this token is for"
              rows={2}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring resize-none"
            />
          </Field>

          <Field label="Expiration">
            <label className="flex items-center gap-2 text-sm text-foreground mb-2">
              <input
                type="checkbox"
                checked={neverExpires}
                onChange={(e) => setNeverExpires(e.target.checked)}
                className="accent-white/80"
              />
              Never expires
            </label>
            {!neverExpires && (
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring"
              />
            )}
          </Field>

          <div className="rounded-lg bg-amber-400/[0.06] border border-amber-200 px-3 py-2.5 text-xs text-amber-200/90">
            A superadmin token can call <em>every</em> <code className="font-mono">/ee/superadmin/*</code> endpoint
            — create orgs, toggle features, update plans across the platform. Treat it like a master key.
          </div>

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
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-3.5 py-2 bg-muted hover:bg-accent text-foreground text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating…' : 'Create token'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">
        {label} {required && <span className="text-red-400/70">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  )
}
