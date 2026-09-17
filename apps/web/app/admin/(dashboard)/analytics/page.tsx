import React from 'react'
import type { Metadata } from 'next'
import GlobalAnalytics from '@components/Admin/GlobalAnalytics'

export const metadata: Metadata = {
  title: 'Analytics',
}

export default function AdminAnalyticsPage() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-8 md:px-6 md:pt-10 xl:px-8">
      <div className="mb-8">
        <h1 className="sl-page-title">Global Analytics</h1>
        <p className="mt-2 text-reading text-muted-foreground">
          Cross-organization analytics overview
        </p>
      </div>
      <GlobalAnalytics days={30} />
    </div>
  )
}
