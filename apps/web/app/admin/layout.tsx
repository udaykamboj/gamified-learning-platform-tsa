import type { Metadata } from 'next'
import AdminProviders from './providers'
import React from 'react'
import { fetchInstanceMode, isSuperadminSurfaceBlocked } from '@lib/eeGate'
import EERequiredScreen from '@components/Security/EERequiredScreen'

// The admin console is CORE to the single-org build: it renders in every
// deployment mode, and access is enforced by the role/permission layer
// (SuperadminAuthorization + backend _require_platform_superadmin), never by
// licensing. The mode lookup below is retained for compatibility with the
// shared gate helper but never blocks.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: {
    template: '%s | StarLab Admin',
    default: 'StarLab Admin',
  },
}

// Wraps everything under /admin, including /admin/login. The gate helper is
// never-fire in this build, so AdminProviders always bootstraps.
export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (isSuperadminSurfaceBlocked(await fetchInstanceMode())) {
    return <EERequiredScreen />
  }

  return <AdminProviders>{children}</AdminProviders>
}
