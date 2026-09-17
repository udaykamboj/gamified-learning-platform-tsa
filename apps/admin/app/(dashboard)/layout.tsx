'use client'
import ClientAdminLayout from '@components/Dashboard/ClientAdminLayout'
import SuperadminAuthorization from '@components/Security/SuperadminAuthorization'
import { OrgProvider } from '@components/Contexts/OrgContext'
import React from 'react'

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SuperadminAuthorization>
      <OrgProvider orgslug="default">
        {children}
      </OrgProvider>
    </SuperadminAuthorization>
  )
}
