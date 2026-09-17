'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { BookOpen, CircleNotch, PaperPlaneRight, Warning } from '@phosphor-icons/react'
import { getAPIUrl } from '@services/config/config'
import { buildSnippets, type HttpMethod } from '@components/Admin/Developers/snippets'
import CodeSnippetTabs from '@components/Admin/Developers/CodeSnippetTabs'
import type { EndpointDoc, PathParam } from '@components/Admin/Developers/catalog'
import OrgPicker from '@components/Admin/Developers/playground/OrgPicker'
import EELicenseError, { isEELicenseInactiveError } from '@components/Admin/EELicenseError'

const METHOD_CLS: Record<HttpMethod, string> = {
  GET: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  POST: 'bg-sky-100 text-sky-700 border-sky-200',
  PUT: 'bg-amber-100 text-amber-700 border-amber-200',
  PATCH: 'bg-violet-100 text-violet-700 border-violet-200',
  DELETE: 'bg-red-100 text-red-700 border-red-200',
}

interface CallResult {
  status: number
  ok: boolean
  body: unknown
}

function fillTemplate(template: string, params: Record<string, string>): { resolved: string; missing: string[] } {
  const missing: string[] = []
  const resolved = template.replace(/\{([^}]+)\}/g, (_, key) => {
    const v = params[key]
    if (v === undefined || v === '') {
      missing.push(key)
      return `{${key}}`
    }
    return encodeURIComponent(v)
  })
  return { resolved, missing }
}

export default function EndpointDetail({
  endpoint,
  token,
}: {
  endpoint: EndpointDoc
  token: string
}) {
  // ── Path params state ────────────────────────────────────────────────────
  const [pathValues, setPathValues] = useState<Record<string, string>>({})
  // Reset per-endpoint state when the user picks a different endpoint.
  useEffect(() => {
    setPathValues({})
    setBodyText(endpoint.sampleBody ? JSON.stringify(endpoint.sampleBody, null, 2) : '')
    setResult(null)
    setError('')
    setBodyParseError('')
  }, [endpoint.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Body editor state ────────────────────────────────────────────────────
  const hasBody = endpoint.method !== 'GET' && endpoint.method !== 'DELETE'
  const [bodyText, setBodyText] = useState<string>(
    endpoint.sampleBody ? JSON.stringify(endpoint.sampleBody, null, 2) : '',
  )
  // Only the setter is used — the value is never rendered.
  const [, setBodyParseError] = useState('')

  const parsedBody: { ok: boolean; value: unknown } = useMemo(() => {
    if (!hasBody) return { ok: true, value: undefined }
    const t = bodyText.trim()
    if (!t) return { ok: true, value: undefined }
    try {
      return { ok: true, value: JSON.parse(t) }
    } catch (e) {
      return { ok: false, value: e instanceof Error ? e.message : 'Invalid JSON' }
    }
  }, [bodyText, hasBody])

  // ── Compute URL + snippets ───────────────────────────────────────────────
  const apiBase = getAPIUrl().replace(/\/$/, '')
  const { resolved: filledPath, missing: missingParams } = fillTemplate(endpoint.pathTemplate, pathValues)
  const url = `${apiBase}/${filledPath.replace(/^\//, '')}`

  const snippets = useMemo(
    () =>
      buildSnippets({
        method: endpoint.method,
        url,
        body: hasBody && parsedBody.ok ? parsedBody.value : undefined,
        token,
      }),
    [endpoint.method, url, hasBody, parsedBody, token],
  )

  // ── Send state ───────────────────────────────────────────────────────────
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<CallResult | null>(null)
  const [error, setError] = useState('')
  const qc = useQueryClient()

  const tokenMissing = !token.trim()
  const canSend =
    !tokenMissing && missingParams.length === 0 && parsedBody.ok && !sending

  const handleSend = async () => {
    setSending(true)
    setError('')
    setResult(null)
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token.trim()}`,
      }
      const init: RequestInit = { method: endpoint.method, headers }
      if (hasBody && parsedBody.ok && parsedBody.value !== undefined) {
        headers['Content-Type'] = 'application/json'
        init.body = JSON.stringify(parsedBody.value)
      }
      const res = await fetch(url, init)
      const text = await res.text()
      let data: unknown = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = text
      }
      setResult({ status: res.status, ok: res.ok, body: data })
      // Invalidate cached org list when an org mutation succeeds.
      if (res.ok && endpoint.category === 'Organizations' && endpoint.method !== 'GET') {
        qc.invalidateQueries({ queryKey: queryKeys.superadmin.orgs() })
      }
      if (res.ok && endpoint.category === 'Tokens' && endpoint.method !== 'GET') {
        qc.invalidateQueries({ queryKey: queryKeys.superadmin.apiTokens() })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2 mb-2">
          <span
            className={
              'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border font-mono ' +
              METHOD_CLS[endpoint.method]
            }
          >
            {endpoint.method}
          </span>
          <code className="font-mono text-sm text-foreground break-all">/{endpoint.pathTemplate}</code>
        </div>
        <h2 className="text-base font-semibold text-foreground">{endpoint.title}</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{endpoint.description}</p>
        {endpoint.sessionOnly && (
          <div className="mt-3 rounded-lg bg-amber-400/[0.06] border border-amber-200 px-3 py-2 text-xs text-amber-200/90 flex items-start gap-2">
            <Warning size={14} weight="fill" className="text-amber-700 mt-0.5 shrink-0" />
            <span>
              <strong>Session auth only.</strong> API tokens cannot call this endpoint
              (privilege-escalation block). The live Send button will fail with 403 if you use a token —
              copy the snippet and run it as a logged-in superadmin instead.
            </span>
          </div>
        )}
      </header>

      {/* Parameters */}
      {endpoint.pathParams && endpoint.pathParams.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Parameters</h3>
          <div className="space-y-3">
            {endpoint.pathParams.map((p) => (
              <ParamRow
                key={p.name}
                param={p}
                value={pathValues[p.name] ?? ''}
                onChange={(v) =>
                  setPathValues((s) => ({ ...s, [p.name]: v }))
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Request Body */}
      {hasBody && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Request Body (JSON)</h3>
            {endpoint.sampleBody != null && (
              <button
                onClick={() => setBodyText(JSON.stringify(endpoint.sampleBody, null, 2))}
                className="text-[11px] text-muted-foreground hover:text-muted-foreground transition-colors"
              >
                Reset to sample
              </button>
            )}
          </div>
          {endpoint.bodyFields && endpoint.bodyFields.length > 0 && (
            <div className="rounded-lg border border-border bg-card divide-y divide-border mb-2">
              {endpoint.bodyFields.map((f) => (
                <div key={f.name} className="px-3 py-1.5 text-[11px] flex items-baseline gap-1.5">
                  <span className="font-mono text-foreground">{f.name}</span>
                  <span className="text-muted-foreground">{f.type}</span>
                  {f.required && <span className="text-red-400/80">*</span>}
                  {f.description && (
                    <span className="text-muted-foreground">— {f.description}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <textarea
            value={bodyText}
            onChange={(e) => {
              setBodyText(e.target.value)
              setBodyParseError('')
            }}
            spellCheck={false}
            rows={Math.min(20, Math.max(6, bodyText.split('\n').length + 1))}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-ring resize-y"
            placeholder='{"key": "value"}'
          />
          {!parsedBody.ok && (
            <p className="text-xs text-red-700 mt-1">JSON parse error: {String(parsedBody.value)}</p>
          )}
        </section>
      )}

      {/* Send */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-card text-foreground text-sm font-medium rounded-lg hover:bg-card/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? <CircleNotch size={14} className="animate-spin" /> : <PaperPlaneRight size={14} weight="fill" />}
          {sending ? 'Sending…' : 'Send Request'}
        </button>
        {tokenMissing && (
          <span className="text-xs text-amber-300/80">
            Paste a token at the top to enable live calls.
          </span>
        )}
        {!tokenMissing && missingParams.length > 0 && (
          <span className="text-xs text-amber-300/80">
            Fill in: {missingParams.join(', ')}
          </span>
        )}
      </div>
      {error && <div className="text-sm text-red-700">{error}</div>}

      {/* Response */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Response</h3>
          {result && (
            <span
              className={
                'inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border font-mono ' +
                (result.ok
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-red-100 text-red-700 border-red-200')
              }
            >
              HTTP {result.status}
            </span>
          )}
        </div>
        {result ? (
          <>
            {/* If the API returned a deactivated-license error, show the
                explainer banner above the raw JSON so the user sees the cause
                directly instead of just a 503 detail blob. */}
            {(() => {
              // FastAPI wraps HTTPException payloads as {detail: ...}, and the
              // playground stores that whole envelope in result.body. Passing
              // it straight through meant the matcher read `.error` off the
              // wrapper, found undefined, and the banner never rendered on any
              // license 503. Unwrap first, keeping the raw body as a fallback
              // for handlers that return the detail unwrapped.
              const err = {
                status: result.status,
                detail: (result.body as { detail?: unknown })?.detail ?? result.body,
              }
              return isEELicenseInactiveError(err) ? <EELicenseError error={err} /> : null
            })()}
            <pre className="rounded-lg border border-border bg-muted px-3 py-2.5 text-xs font-mono text-foreground whitespace-pre-wrap break-all overflow-x-auto max-h-96">
              {typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2)}
            </pre>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border py-10 text-center">
            <BookOpen size={20} weight="fill" className="text-muted-foreground/70 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Send a request to see the response</p>
          </div>
        )}
      </section>

      {/* Snippets */}
      <section>
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Snippet</h3>
        <CodeSnippetTabs snippets={snippets} />
      </section>
    </div>
  )
}

function ParamRow({
  param,
  value,
  onChange,
}: {
  param: PathParam
  value: string
  onChange: (_v: string) => void
}) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="font-mono text-sm text-foreground">{param.name}</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] uppercase tracking-wider border font-mono bg-card text-muted-foreground border-border">
          path
        </span>
        {param.required && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border font-mono bg-red-100 text-red-700 border-red-200">
            required
          </span>
        )}
        <span className="text-[11px] text-muted-foreground">{param.type}</span>
        {param.description && (
          <span className="text-[11px] text-muted-foreground">— {param.description}</span>
        )}
      </div>
      {param.picker === 'org_id' ? (
        <OrgPicker
          value={value === '' ? '' : Number(value)}
          onChange={(v) => onChange(v === '' ? '' : String(v))}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.type === 'integer' ? '42' : 'value'}
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring font-mono"
        />
      )}
    </div>
  )
}
