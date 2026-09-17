import React from 'react'
import Link from 'next/link'
import { ArrowRight, ChartBar, Key, Users } from '@phosphor-icons/react/dist/ssr'

const DESTINATIONS = [
  {
    href: '/admin/users',
    title: 'Users',
    body: 'Find accounts, review roles and manage platform access.',
    Icon: Users,
    tint: 'bg-info-surface text-info',
  },
  {
    href: '/admin/analytics',
    title: 'Platform analytics',
    body: 'Monitor engagement, activity and system-wide metrics.',
    Icon: ChartBar,
    tint: 'bg-selected text-link',
  },
  {
    href: '/admin/developers',
    title: 'Developers',
    body: 'Manage API tokens and developer integrations.',
    Icon: Key,
    tint: 'bg-warning-surface text-warning',
  },
]

export default function AdminPage() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-8 md:px-6 md:pt-10 xl:px-8">
      <header className="max-w-2xl">
        <p className="sl-telemetry text-reward">Administration</p>
        <h1 className="mt-2 sl-page-title">Admin console</h1>
        <p className="mt-2 text-reading text-muted-foreground">
          Choose an area to manage. Changes here apply across the whole platform.
        </p>
      </header>

      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {DESTINATIONS.map(({ href, title, body, Icon, tint }) => (
          <li key={href}>
            <Link href={href} className="sl-card sl-card-interactive group flex h-full flex-col p-6">
              <span className={`grid size-11 place-items-center rounded-[10px] ${tint}`}>
                <Icon size={22} weight="duotone" aria-hidden />
              </span>
              <h2 className="mt-5 flex items-center gap-2 text-card-title font-semibold text-foreground">
                {title}
                <ArrowRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </h2>
              <p className="mt-1 text-ui text-muted-foreground">{body}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
