'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, AlertTriangle } from 'lucide-react'
import { useAuth } from '@components/Contexts/AuthContext'

/**
 * Consumes a passwordless login link: reads ?token from the URL and hands it to
 * completeMagicLink(). Mirrors the loading/redirect pattern of the Google OAuth
 * callback page.
 *
 *   - 2FA account  → bounce to /login?mfa_token=… (the login page picks it up),
 *   - success      → forward through the same /redirect_from_auth handoff every
 *                    other flow uses,
 *   - expired/used → friendly "request a new one" state linking back to /login.
 *
 * The token is read from window.location (not useSearchParams) to stay off the
 * Suspense/CSR-bailout path, matching how the login page reads ?mfa_token.
 */
export default function MagicLinkConsumePage() {
  const { completeMagicLink } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const ranRef = useRef(false)

  // Honor a sanitized ?next / ?redirect through the cross-domain handoff — same
  // rule the login page applies (internal same-origin path only, default /home).
  const buildCallbackUrl = () => {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('next') ?? params.get('redirect') ?? params.get('redirect_to')
    const dest = raw && /^\/(?!\/)/.test(raw) ? raw : '/dashboard'
    return `${window.location.origin}/redirect_from_auth?next=${encodeURIComponent(dest)}`
  }

  useEffect(() => {
    // Single-use link: never run the verify twice (React strict-mode double-mount).
    if (ranRef.current) return
    ranRef.current = true

    const run = async () => {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('token')

      if (!token) {
        setError('This link is missing its token. Request a new one to sign in.')
        setStatus('error')
        return
      }

      const callbackUrl = buildCallbackUrl()
      const res = await completeMagicLink(token, { callbackUrl, redirect: false })

      // 2FA account — the login page already knows how to finish from an mfa_token.
      if (res.mfa_required && res.mfa_token) {
        const raw =
          params.get('next') ?? params.get('redirect') ?? params.get('redirect_to')
        const loginUrl = new URL('/login', window.location.origin)
        loginUrl.searchParams.set('mfa_token', res.mfa_token)
        if (raw && /^\/(?!\/)/.test(raw)) loginUrl.searchParams.set('next', raw)
        window.location.href = loginUrl.toString()
        return
      }

      if (res.ok) {
        setStatus('success')
        window.location.href = callbackUrl
        return
      }

      let message = 'This link has expired or was already used. Request a new one to sign in.'
      try {
        const parsed = JSON.parse(res.error || '{}')
        if (parsed.message) message = parsed.message
      } catch {
        // keep the default message
      }
      setError(message)
      setStatus('error')
    }

    run()
  }, [completeMagicLink])

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="sl-card text-center w-full max-w-md p-6 md:p-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-warning-surface rounded-full">
              <AlertTriangle className="w-10 h-10 text-warning" />
            </div>
          </div>
          <h1 className="sl-section-title mb-2">
            This link isn’t valid anymore
          </h1>
          <p className="text-ui text-muted-foreground mb-6">{error}</p>
          <div className="space-y-3">
            <Link
              href="/login"
              className="sl-btn sl-btn-primary w-full"
            >
              Request a new link
            </Link>
            <Link
              href="/"
              className="sl-btn sl-btn-secondary w-full"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="sl-card text-center w-full max-w-md p-6 md:p-8">
          <div className="flex justify-center mb-4">
            <Loader2 className="w-10 h-10 text-success animate-spin" />
          </div>
          <h1 className="sl-section-title mb-2">Success!</h1>
          <p className="text-ui text-muted-foreground">Redirecting you now...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="sl-card text-center w-full max-w-md p-6 md:p-8">
        <div className="flex justify-center mb-4">
          <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
        </div>
        <h1 className="sl-section-title mb-2">Signing you in...</h1>
        <p className="text-ui text-muted-foreground">Please wait while we verify your link.</p>
      </div>
    </div>
  )
}
