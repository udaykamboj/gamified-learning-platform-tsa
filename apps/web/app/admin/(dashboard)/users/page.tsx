import React from 'react'
import type { Metadata } from 'next'
import UserList from '@components/Admin/UserList'

export const metadata: Metadata = {
  title: 'Users',
}

export default function AdminUsersPage() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-8 md:px-6 md:pt-10 xl:px-8">
      <div className="mb-8">
        <h1 className="sl-page-title">Users</h1>
        <p className="mt-2 text-reading text-muted-foreground">
          Manage all users across the platform
        </p>
      </div>
      <UserList />
    </div>
  )
}
