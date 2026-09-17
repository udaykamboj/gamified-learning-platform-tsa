import React from 'react'
import type { Metadata } from 'next'
import DevelopersTabs from '@components/Admin/Developers/DevelopersTabs'

export const metadata: Metadata = {
  title: 'Developers',
}

export default function AdminDevelopersPage() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-8 md:px-6 md:pt-10 xl:px-8">
      <div className="mb-6">
        <h1 className="sl-page-title">Developers</h1>
        <p className="mt-2 text-reading text-muted-foreground">
          API tokens, endpoint reference, and a live playground for cross-org automation.
        </p>
      </div>
      <DevelopersTabs />
    </div>
  )
}
