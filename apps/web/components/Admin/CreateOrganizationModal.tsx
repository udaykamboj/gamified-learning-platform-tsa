'use client'
import React, { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { queryKeys } from '@/lib/query/keys'
import { getAPIUrl, getDeploymentMode } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { X, Buildings } from '@phosphor-icons/react'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export default function CreateOrganizationModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const queryClient = useQueryClient()
  const router = useRouter()
  const isSaaS = getDeploymentMode() === 'saas'

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [email, setEmail] = useState('')
  const [description, setDescription] = useState('')
  const [plan, setPlan] = useState<string>('free')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setSlug('')
      setSlugTouched(false)
      setEmail('')
      setDescription('')
      setPlan('free')
      setError('')
      setSubmitting(false)
    }
  }, [open])

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name))
  }, [name, slugTouched])

  if (!open) return null

  const canSubmit = name.trim().length > 0 && slug.trim().length > 0 && email.trim().length > 0 && !submitting

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        slug: slug.trim(),
        email: email.trim(),
      }
      if (description.trim()) body.description = description.trim()
      if (isSaaS) body.plan = plan

      const res = await fetch(`${getAPIUrl()}ee/superadmin/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.detail || `Failed to create organization (${res.status})`)
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.superadmin.orgs() })
      onClose()
      if (data?.id) router.push(`/admin/organizations/${data.id}`)
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
            <Buildings size={18} weight="fill" className="text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">New organization</h2>
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
          <Field label="Name" required>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Learning"
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
            />
          </Field>

          <Field
            label="Slug"
            required
            hint="Lowercase, hyphens — used in the org URL."
          >
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(slugify(e.target.value))
              }}
              placeholder="acme-learning"
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring font-mono"
            />
          </Field>

          <Field label="Email" required>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@acme.com"
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              rows={2}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring resize-none"
            />
          </Field>

          {isSaaS && (
            <Field label="Plan">
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring"
              >
                <option value="free">Free</option>
                <option value="standard">Standard</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </Field>
          )}

          {error && (
            <p className="text-sm text-red-700">{error}</p>
          )}
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
            {submitting ? 'Creating…' : 'Create organization'}
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
