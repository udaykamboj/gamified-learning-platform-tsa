'use client'
import { ChartBar, Key, SignOut, User, Users } from '@phosphor-icons/react'
import { signOut } from '@components/Contexts/AuthContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { StarLabLogo } from '@components/Objects/Menus/StarLabLogo'
import AppearanceToggle from '@components/Objects/Menus/AppearanceToggle'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

const NAV = [
  { href: '/admin/users', label: 'Users', Icon: Users },
  { href: '/admin/analytics', label: 'Analytics', Icon: ChartBar },
  { href: '/admin/developers', label: 'Developers', Icon: Key },
]

function AdminTopMenu() {
  const session = useLHSession() as any
  const pathname = usePathname() || ''

  async function logOutUI() {
    await signOut({ redirect: true, callbackUrl: '/admin/login' })
  }

  if (!session) return null

  const user = session?.data?.user
  const avatarUrl = user?.avatar_image
    ? user.avatar_image.startsWith('http')
      ? user.avatar_image
      : getUserAvatarMediaDirectory(user.user_uuid, user.avatar_image)
    : null

  return (
    <>
      {/* Spacer to push content below the fixed menu */}
      <div aria-hidden className="h-16" />
      <header
        className="fixed top-0 start-0 end-0 h-16 border-b border-border bg-background/90 backdrop-blur-md"
        style={{ zIndex: 'var(--z-nav)' }}
      >
        <div className="mx-auto flex h-full w-full max-w-[1440px] items-center gap-4 px-4 md:px-6 xl:px-8">
          <Link className="flex shrink-0 items-center gap-3 text-foreground" href="/admin" aria-label="StarLab Admin home">
            <StarLabLogo className="h-8 w-auto" />
            <span className="rounded-[6px] border border-border bg-muted px-2 py-0.5 text-meta font-semibold text-reward">
              Admin
            </span>
          </Link>

          <nav aria-label="Admin" className="ms-2 hidden items-center gap-1 md:flex">
            {NAV.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-[15px] font-semibold transition-colors',
                    active ? 'bg-selected text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon size={18} weight={active ? 'fill' : 'regular'} aria-hidden />
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="flex-1" />

          <AppearanceToggle className="hidden sm:inline-flex" />

          <div className="flex items-center gap-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-8 rounded-full bg-muted object-cover" />
            ) : (
              <span className="grid size-8 place-items-center rounded-full bg-muted">
                <User size={16} weight="fill" className="text-muted-foreground" aria-hidden />
              </span>
            )}
            <span className="hidden text-sm font-semibold text-foreground lg:inline">{user?.username}</span>
          </div>
          <button
            type="button"
            onClick={logOutUI}
            className="sl-btn sl-btn-ghost min-h-10 px-3 text-error"
          >
            <SignOut size={18} data-dir-flip aria-hidden />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
        {/* Mobile nav */}
        <nav aria-label="Admin" className="flex items-center gap-1 overflow-x-auto border-b border-border bg-background px-4 py-2 md:hidden">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] px-3 text-sm font-semibold',
                  active ? 'bg-selected text-foreground' : 'text-muted-foreground'
                )}
              >
                <Icon size={16} aria-hidden />
                {label}
              </Link>
            )
          })}
        </nav>
      </header>
    </>
  )
}

export default AdminTopMenu
