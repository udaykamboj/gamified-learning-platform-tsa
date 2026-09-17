'use client'
import React, { useState } from 'react'
import { useAuth } from '@components/Contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Shield } from 'lucide-react'
import { StarLabLogo } from '@components/Objects/Menus/StarLabLogo'

export default function AdminLoginPage() {
  const { signIn, signOut } = useAuth()
  const _router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result: any = await signIn('credentials', {
        email,
        password,
        redirect: false,
        isAdmin: true,
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else {
        // STRICT PORTAL SEGREGATION: 
        // If the resolved landing URL is not /admin, this is not an Admin account.
        // They are not allowed to log in via the Admin portal.
        if (result?.url && !result.url.endsWith('/admin')) {
          // Immediately log them out
          signOut({ redirect: false })
          setError('You do not have administrative privileges.')
          return
        }

        window.location.href = '/admin'
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 sl-atmosphere opacity-60" />
      <header className="relative mx-auto flex h-16 w-full max-w-[1280px] items-center px-4 md:px-8">
        <StarLabLogo className="h-8 w-auto text-foreground" />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-12">
        <div className="sl-card w-full max-w-[420px] p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-[10px] bg-warning-surface text-warning">
              <Shield className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="font-display text-section font-semibold tracking-tight">StarLab Admin</h1>
              <p className="text-ui text-muted-foreground">Sign in to the administration console</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="rounded-[10px] border border-error/30 bg-error-surface px-4 py-3 text-ui text-error">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="sl-input"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="sl-input"
                placeholder="Enter your password"
              />
            </div>

            <button type="submit" disabled={isLoading} className="sl-btn sl-btn-primary w-full">
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
