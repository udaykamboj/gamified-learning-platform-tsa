'use client'
import React from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import { LearningUniverse } from '@components/learning-universe/learning-universe'
import { JsonLd } from '@components/SEO/JsonLd'
import { getUriWithOrg } from '@services/config/config'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { signOut } from '@components/Contexts/AuthContext'

export default function HomeClient({ orgslug }: { orgslug: string }) {
  // Temporarily mock org to prevent skeleton loader lock-in if backend is down
  const org = useOrg() || { name: 'Demo Org', slug: orgslug } as any
  const session = useLHSession()

  React.useEffect(() => {
    if (session?.status === 'unauthenticated') {
      signOut({ callbackUrl: '/login' })
    }
  }, [session?.status])

  if (session?.status !== 'authenticated') {
    return null // Return nothing while loading or redirecting
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
    <div className="w-full">
      {orgJsonLd && <JsonLd data={orgJsonLd} />}
      <div className="learning-universe-theme">
        <LearningUniverse orgslug={orgslug} />
      </div>
    </div>
  )
}
