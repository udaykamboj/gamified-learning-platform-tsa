'use client'
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getAPIUrl } from '@services/config/config'
import { apiFetch } from '@services/utils/ts/requests'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { Key, Plus, Trash, CircleNotch } from '@phosphor-icons/react'
import CreateTokenModal from '@components/Admin/SuperadminAPITokens/CreateTokenModal'
import TokenCreatedDialog, { CreatedToken } from '@components/Admin/SuperadminAPITokens/TokenCreatedDialog'
import RevokeTokenConfirm from '@components/Admin/SuperadminAPITokens/RevokeTokenConfirm'

export interface SuperadminToken {
  id: number
  token_uuid: string
  name: string
  description: string | null
  token_prefix: string
  created_by_user_id: number
  creation_date: string
  update_date: string
  last_used_at: string | null
  expires_at: string | null
  is_active: boolean
}

function tokenStatus(t: SuperadminToken): 'active' | 'revoked' | 'expired' {
  if (!t.is_active) return 'revoked'
  if (t.expires_at) {
    const exp = new Date(t.expires_at)
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) return 'expired'
  }
  return 'active'
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString()
}

export default function TokenList() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const [createOpen, setCreateOpen] = useState(false)
  const [createdToken, setCreatedToken] = useState<CreatedToken | null>(null)
  const [revoking, setRevoking] = useState<SuperadminToken | null>(null)

  const { data, isLoading, isError } = useQuery<SuperadminToken[]>({
    queryKey: queryKeys.superadmin.apiTokens(),
    queryFn: () => apiFetch(`${getAPIUrl()}ee/superadmin/tokens/`, accessToken),
    enabled: !!accessToken,
  })

  const tokens = data ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          {isLoading || isError ? '' : tokens.length === 0 ? 'No tokens yet' : `${tokens.length} token${tokens.length === 1 ? '' : 's'}`}
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="sl-btn sl-btn-primary"
        >
          <Plus size={14} weight="bold" />
          Create token
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <CircleNotch size={16} className="animate-spin" />
          Loading tokens…
        </div>
      )}

      {isError && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-error/30 bg-error-surface p-4 text-error">
          <Key size={20} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="text-ui font-semibold">Couldn&apos;t load API tokens</p>
            <p className="mt-0.5 text-ui text-foreground">
              The token service did not respond. It may not be enabled on this deployment. Try again later.
            </p>
          </div>
        </div>
      )}

      {!isLoading && !isError && tokens.length === 0 && (
        <div className="sl-card py-16 text-center">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Key size={22} aria-hidden />
          </span>
          <p className="text-card-title font-semibold text-foreground">No superadmin API tokens yet</p>
          <p className="text-ui text-muted-foreground mt-1">
            Create one to automate org provisioning and feature toggling.
          </p>
        </div>
      )}

      {!isLoading && !isError && tokens.length > 0 && (
        <div className="sl-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="text-start px-4 py-3 font-medium">Name</th>
                <th className="text-start px-4 py-3 font-medium">Prefix</th>
                <th className="text-start px-4 py-3 font-medium">Status</th>
                <th className="text-start px-4 py-3 font-medium">Created</th>
                <th className="text-start px-4 py-3 font-medium">Expires</th>
                <th className="text-start px-4 py-3 font-medium">Last used</th>
                <th className="text-end px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tokens.map((t) => {
                const status = tokenStatus(t)
                return (
                  <tr key={t.token_uuid} className="text-foreground">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.token_prefix}…</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(t.creation_date)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {t.expires_at ? fmtDate(t.expires_at) : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(t.last_used_at)}</td>
                    <td className="px-4 py-3 text-end">
                      {status === 'active' && (
                        <button
                          onClick={() => setRevoking(t)}
                          className="text-red-400/80 hover:text-red-700 inline-flex items-center gap-1 text-xs"
                          title="Revoke token"
                        >
                          <Trash size={14} weight="fill" />
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateTokenModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(t) => {
          setCreateOpen(false)
          setCreatedToken(t)
        }}
      />

      <TokenCreatedDialog
        token={createdToken}
        onClose={() => setCreatedToken(null)}
      />

      <RevokeTokenConfirm
        token={revoking}
        onClose={() => setRevoking(null)}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: 'active' | 'revoked' | 'expired' }) {
  const cfg = {
    active: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    revoked: { label: 'Revoked', cls: 'bg-card text-muted-foreground border-border' },
    expired: { label: 'Expired', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  }[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}
