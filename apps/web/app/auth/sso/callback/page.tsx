'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { handleSSOCallback, SSOError, getErrorMessage } from '@services/auth/sso'
import { useAuth } from '@components/Contexts/AuthContext'
import { Shield, AlertTriangle, Loader2, Info, Copy, Check } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

interface ErrorDetails {
  message: string
  errorCode: string
  errorDescription: string
  provider?: string
  technicalDetails?: string
}

export default function SSOCallbackPage() {
  const { t } = useTranslation()
  const { signIn } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [error, setError] = useState<ErrorDetails | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const handleCallback = async () => {
      // First, check for IdP error parameters in the URL
      const idpError = searchParams.get('error')
      const idpErrorDescription = searchParams.get('error_description')

      if (idpError) {
        // IdP returned an error (user denied consent, etc.)
        const errorMessage = getErrorMessage(idpError, idpErrorDescription || undefined)
        setError({
          message: errorMessage,
          errorCode: idpError,
          errorDescription: idpErrorDescription || errorMessage,
          technicalDetails: `IdP Error Code: ${idpError}${idpErrorDescription ? `\nDescription: ${idpErrorDescription}` : ''}`,
        })
        setStatus('error')
        return
      }

      const code = searchParams.get('code')
      const state = searchParams.get('state')

      if (!code || !state) {
        setError({
          message: getErrorMessage('missing_params'),
          errorCode: 'missing_params',
          errorDescription: 'Missing required parameters: code and state',
          technicalDetails: `code: ${code ? 'present' : 'missing'}\nstate: ${state ? 'present' : 'missing'}`,
        })
        setStatus('error')
        return
      }

      try {
        // Exchange code for user profile and tokens
        const result = await handleSSOCallback(code, state)

        // Use absolute URL with current origin for custom domain support
        const defaultRedirect = `${window.location.origin}/redirect_from_auth`
        const redirectUrl = result.redirect_url || defaultRedirect

        // Use the credentials provider with SSO tokens
        const signInResult = await signIn('credentials', {
          redirect: false,
          email: result.user.email,
          sso: 'true',
          sso_access_token: result.tokens.access_token,
          sso_refresh_token: result.tokens.refresh_token,
          sso_user: JSON.stringify(result.user),
          sso_expiry: result.tokens.expiry ?? undefined,
          callbackUrl: redirectUrl,
        })

        if (signInResult?.error) {
          console.error('Sign-in failed:', signInResult.error)
          setError({
            message: 'Failed to complete sign-in after SSO authentication',
            errorCode: 'signin_failed',
            errorDescription: signInResult.error,
            technicalDetails: `Sign-in error: ${signInResult.error}`,
          })
          setStatus('error')
        } else if (signInResult?.ok) {
          setStatus('success')
          router.push(redirectUrl)
        } else {
          // No error but not ok either - likely a redirect happened
          setStatus('success')
          router.push(redirectUrl)
        }
      } catch (err: any) {
        console.error('SSO callback error:', err)

        if (err instanceof SSOError) {
          setError({
            message: getErrorMessage(err.errorCode, err.errorDescription),
            errorCode: err.errorCode,
            errorDescription: err.errorDescription,
            provider: err.provider,
            technicalDetails: JSON.stringify({
              error: err.error,
              error_code: err.errorCode,
              error_description: err.errorDescription,
              provider: err.provider,
              details: err.details,
            }, null, 2),
          })
        } else {
          setError({
            message: err.message || t('auth.sso_callback.error'),
            errorCode: 'unknown_error',
            errorDescription: err.message || 'An unknown error occurred',
            technicalDetails: err.stack || err.message,
          })
        }
        setStatus('error')
      }
    }

    handleCallback()
  }, [searchParams, router, t, signIn])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="sl-card text-center w-full max-w-md p-6 md:p-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Shield className="w-14 h-14 text-primary" />
              <Loader2 className="w-6 h-6 text-primary absolute -bottom-1 -end-1 animate-spin" />
            </div>
          </div>
          <h1 className="sl-section-title mb-2">
            {t('auth.sso_callback.authenticating')}
          </h1>
          <p className="text-ui text-muted-foreground">
            {t('auth.sso_callback.please_wait')}
          </p>
        </div>
      </div>
    )
  }

  const copyToClipboard = async () => {
    if (error?.technicalDetails) {
      await navigator.clipboard.writeText(error.technicalDetails)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="sl-card text-center w-full max-w-lg p-6 md:p-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-error-surface rounded-full">
              <AlertTriangle className="w-10 h-10 text-error" />
            </div>
          </div>
          <h1 className="sl-section-title mb-2">
            {t('auth.sso_callback.auth_failed')}
          </h1>

          {/* Main error message */}
          <p className="text-ui text-muted-foreground mb-4">{error?.message}</p>

          {/* Error code badge */}
          {error?.errorCode && error.errorCode !== 'unknown_error' && (
            <div className="sl-badge sl-badge-error mb-4">
              <span className="font-mono">{error.errorCode}</span>
            </div>
          )}

          {/* Provider info */}
          {error?.provider && (
            <p className="text-sm text-muted-foreground mb-4">
              Provider: {error.provider}
            </p>
          )}

          {/* Technical details expandable */}
          {error?.technicalDetails && (
            <div className="mb-6">
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <Info className="w-4 h-4" />
                {showTechnicalDetails ? 'Hide' : 'Show'} technical details
              </button>

              {showTechnicalDetails && (
                <div className="mt-2 p-3 bg-muted rounded-lg text-start relative">
                  <button
                    onClick={copyToClipboard}
                    className="absolute top-2 end-2 p-1 text-muted-foreground hover:text-foreground"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <pre className="text-xs font-mono text-foreground whitespace-pre-wrap overflow-x-auto">
                    {error.technicalDetails}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Helpful tips based on error code */}
          {error?.errorCode === 'access_denied' && (
            <div className="mb-6 p-3 bg-warning-surface border border-warning/30 rounded-lg text-start">
              <p className="text-sm text-foreground">
                <strong>Tip:</strong> If you declined the login request by mistake, try again and accept the permissions.
              </p>
            </div>
          )}

          {error?.errorCode === 'invalid_state' && (
            <div className="mb-6 p-3 bg-warning-surface border border-warning/30 rounded-lg text-start">
              <p className="text-sm text-foreground">
                <strong>Tip:</strong> Your session may have expired. Please try logging in again.
              </p>
            </div>
          )}

          {error?.errorCode === 'domain_not_allowed' && (
            <div className="mb-6 p-3 bg-warning-surface border border-warning/30 rounded-lg text-start">
              <p className="text-sm text-foreground">
                <strong>Tip:</strong> Contact your organization administrator to verify your email domain is allowed.
              </p>
            </div>
          )}

          {(error?.errorCode === 'auto_provision_disabled' || error?.errorCode === 'user_not_found') && (
            <div className="mb-6 p-3 bg-warning-surface border border-warning/30 rounded-lg text-start">
              <p className="text-sm text-foreground">
                <strong>Tip:</strong> Your organization requires an administrator to create your account first. Contact your organization admin to request access.
              </p>
            </div>
          )}

          {error?.errorCode === 'sso_misconfigured' && (
            <div className="mb-6 p-3 bg-warning-surface border border-warning/30 rounded-lg text-start">
              <p className="text-sm text-foreground">
                <strong>Tip:</strong> There may be a configuration issue with SSO. Please contact your IT administrator.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Link
              href="/login"
              className="sl-btn sl-btn-primary w-full"
            >
              {t('auth.sso_callback.try_again')}
            </Link>
            <Link
              href="/"
              className="sl-btn sl-btn-secondary w-full"
            >
              {t('auth.sso_callback.go_home')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Success state - redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="sl-card text-center w-full max-w-md p-6 md:p-8">
        <div className="flex justify-center mb-4">
          <Shield className="w-14 h-14 text-success" />
        </div>
        <h1 className="sl-section-title mb-2">
          {t('auth.sso_callback.success')}
        </h1>
        <p className="text-ui text-muted-foreground">
          {t('auth.sso_callback.redirecting')}
        </p>
      </div>
    </div>
  )
}
