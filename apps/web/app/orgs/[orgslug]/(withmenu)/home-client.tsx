'use client'
import React from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import { LearningUniverse } from '@components/learning-universe/learning-universe'
import { JsonLd } from '@components/SEO/JsonLd'
import { getUriWithOrg } from '@services/config/config'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { useLHSession } from '@components/Contexts/LHSessionContext'

export default function HomeClient({ orgslug }: { orgslug: string }) {
  // Temporarily mock org to prevent skeleton loader lock-in if backend is down
  const org = useOrg() || { name: 'Demo Org', slug: orgslug } as any
  const session = useLHSession()

  // This component deliberately does NOT sign anyone out.
  //
  // It used to: `status === 'unauthenticated'` → signOut() → /login. But
  // AuthContext settles on 'unauthenticated' for TRANSIENT failures too — a 502,
  // a timeout, the API being down — and keeps the session so the tab can heal
  // itself (see its transient/terminal split). Treating that state as "signed
  // out" turned every backend hiccup on the dashboard into a sign-out, and with
  // a stale marker still in the browser the visitor was then bounced straight
  // back to /dashboard: the flicker, in a loop.
  //
  // Ending a session is AuthContext's decision, made only when the backend
  // rejects the credential. Redirecting an unauthenticated visitor is
  // SessionGate's, in the (withmenu) layout — one gate, one policy, no page
  // quietly inventing its own.

  if (session?.status !== 'authenticated') {
    return null // Nothing renders until the session is confirmed
  }

  const orgJsonLd = org
    ? {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: org.name,
        description: org.description,
        url: getUriWithOrg(orgslug, '/'),
        ...(org.logo_image && {
          logo: getOrgLogoMediaDirectory(org.org_uuid, org.logo_image),
        }),
      }
    : null

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col">
      {orgJsonLd && <JsonLd data={orgJsonLd} />}
      <div className="learning-universe-theme flex flex-1 min-h-0 flex-col">
        <LearningUniverse orgslug={orgslug} />
      </div>
    </div>
  )
}
