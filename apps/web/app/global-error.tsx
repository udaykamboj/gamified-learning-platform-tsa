"use client";

import * as Sentry from "@sentry/nextjs";
import '../styles/globals.css'
import { classifyError } from '@lib/errors/classify'
import { detectClientLanguage, directionForLanguage, type Direction } from '@lib/direction'
import { AlertTriangle, ChevronDown, ChevronRight, Home, LogOut, MessageSquareWarning, RefreshCcw } from 'lucide-react'
import { useEffect, useState } from 'react'

// Last-resort boundary: catches errors thrown in the root layout itself, so it
// renders OUTSIDE every provider (no router, no AuthContext, no i18n). Kept
// fully self-contained — it classifies the error for a meaningful message and
// offers reload / home / sign out / report, all via plain DOM + the Sentry SDK.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [eventId, setEventId] = useState<string | undefined>()
  const [showDetails, setShowDetails] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // dir-init.js can't help here: this boundary renders its own <html>, so the
  // attribute has to come from React. Detect once, on the client. A
  // server-rendered error page is LTR for one frame — acceptable on an error
  // screen, and not worth a second blocking script.
  const [dir] = useState<Direction>(() =>
    typeof window === 'undefined' ? 'ltr' : directionForLanguage(detectClientLanguage())
  )

  const { category, detail, status } = classifyError(error)

  // This boundary replaces the root layout, so the pre-paint theme script and
  // ThemeProvider are gone. Re-apply the stored appearance (same key and class
  // contract as public/theme-init.js) so the error screen matches the app.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('starlab-appearance')
      const dark =
        stored === 'dark' ||
        ((stored === null || stored === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)
      const root = document.documentElement
      root.classList.toggle('dark', dark)
      root.setAttribute('data-theme', dark ? 'dark' : 'light')
      root.style.colorScheme = dark ? 'dark' : 'light'
    } catch {
      /* storage or matchMedia unavailable: light tokens still render */
    }
  }, [])

  useEffect(() => {
    const msg = error?.message || ''
    if (
      msg.includes('Failed to find Server Action') ||
      msg.includes('older or newer deployment') ||
      error?.name === 'ChunkLoadError' ||
      msg.includes('Loading chunk')
    ) {
      window.location.reload()
      return
    }
    if (Sentry.isInitialized()) {
      setEventId(Sentry.captureException(error))
    }
    console.error(error)
  }, [error])

  const report = () => {
    try {
      if (!Sentry.isInitialized()) return
      const id = eventId || Sentry.lastEventId()
      Sentry.showReportDialog({
        ...(id ? { eventId: id } : {}),
        title: 'Tell us what happened',
        subtitle: 'Your report goes straight to our team so we can fix it.',
        subtitle2: '',
        labelComments: 'What were you doing when this happened?',
        labelSubmit: 'Send report',
      })
    } catch (e) {
      console.error('Failed to open feedback dialog:', e)
    }
  }

  const doSignOut = async () => {
    setSigningOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // ignore — we redirect to login regardless
    }
    window.location.href = '/login'
  }

  const btn = 'sl-btn'

  return (
    <html lang="en" dir={dir} suppressHydrationWarning>
      <body className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="sl-card flex flex-col items-center gap-6 w-full max-w-xl p-6 md:p-8 text-center">
          <div className="bg-error-surface p-4 rounded-2xl">
            <AlertTriangle className="text-error" size={36} aria-hidden />
          </div>
          <div>
            <h1 className="sl-page-title">{category.title}</h1>
            <span className="sl-telemetry text-muted-foreground">
              {category.kind.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-ui text-muted-foreground">{category.description}</p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => reset()} className={`${btn} sl-btn-primary`}>
              <RefreshCcw size={16} />
              <span>Try again</span>
            </button>
            <a href="/home" className={`${btn} sl-btn-secondary`}>
              <Home size={16} />
              <span>Home</span>
            </a>
            <button onClick={doSignOut} disabled={signingOut} className={`${btn} sl-btn-ghost`}>
              <LogOut size={16} />
              <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
            {Sentry.isInitialized() && (
              <button onClick={report} className={`${btn} sl-btn-ghost`}>
                <MessageSquareWarning size={16} />
                <span>Report this problem</span>
              </button>
            )}
          </div>

          {(detail || status || error?.digest || eventId) && (
            <div className="w-full max-w-lg">
              <button
                onClick={() => setShowDetails((s) => !s)}
                className="flex items-center gap-1 mx-auto text-meta font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                {showDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>{showDetails ? 'Hide technical details' : 'Show technical details'}</span>
              </button>
              {showDetails && (
                <div className="mt-3 bg-muted border border-border rounded-xl p-4 text-start text-xs font-mono text-foreground break-all space-y-1.5">
                  {detail && <div><span className="text-muted-foreground">cause </span>{detail}</div>}
                  {status !== undefined && <div><span className="text-muted-foreground">status </span>{status}</div>}
                  {error?.digest && <div><span className="text-muted-foreground">digest </span>{error.digest}</div>}
                  {eventId && <div><span className="text-muted-foreground">ref </span>{eventId}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
