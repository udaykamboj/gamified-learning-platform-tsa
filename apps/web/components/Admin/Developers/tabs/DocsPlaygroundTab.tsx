'use client'
import React, { useState } from 'react'
import { Eye, EyeSlash, CodeSimple } from '@phosphor-icons/react'
import { ENDPOINTS } from '@components/Admin/Developers/catalog'
import EndpointList from '@components/Admin/Developers/playground/EndpointList'
import EndpointDetail from '@components/Admin/Developers/playground/EndpointDetail'

export default function DocsPlaygroundTab({
  onGoToTokens,
}: {
  onGoToTokens: () => void
}) {
  const [token, setToken] = useState('')
  const [reveal, setReveal] = useState(false)
  const [selectedId, setSelectedId] = useState<string>(ENDPOINTS[0]?.id ?? '')

  const selected = ENDPOINTS.find((e) => e.id === selectedId) ?? ENDPOINTS[0]

  return (
    <div className="space-y-4">
      {/* Token bar */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <CodeSimple size={14} weight="bold" className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">API Token (for testing)</h2>
        </div>
        <div className="flex items-stretch gap-2">
          <input
            type={reveal ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter your API token (lh_sa_…)"
            className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring font-mono"
          />
          <button
            onClick={() => setReveal((v) => !v)}
            title={reveal ? 'Hide' : 'Reveal'}
            className="px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {reveal ? <EyeSlash size={16} weight="fill" /> : <Eye size={16} weight="fill" />}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Authenticates the live Send button below. Never persisted.{' '}
          <button
            onClick={onGoToTokens}
            className="text-sky-700 hover:text-sky-200 underline underline-offset-2"
          >
            Mint a token →
          </button>
        </p>
      </div>

      {/* Two-column explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 min-h-[600px]">
        <aside className="rounded-xl border border-border bg-background overflow-hidden lg:sticky lg:top-20 lg:max-h-[calc(100vh-8rem)]">
          <EndpointList selectedId={selectedId} onSelect={setSelectedId} />
        </aside>

        <main className="rounded-xl border border-border bg-card p-5">
          {selected && <EndpointDetail key={selected.id} endpoint={selected} token={token} />}
        </main>
      </div>
    </div>
  )
}
