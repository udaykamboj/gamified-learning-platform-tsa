import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { Books, FolderSimple, Headphones, Cube, MapTrifold, Star, Robot } from '@phosphor-icons/react'
import { menuIcon } from '@components/Objects/Menus/menuIcons'
import Link from 'next/link'
import React from 'react'
import { usePathname } from 'next/navigation'
import { CaretDown } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu'
import { useTranslation } from 'react-i18next'
import { getMenuColorClasses } from '@services/utils/ts/colorUtils'

type Builtin = { feature: string; link: string; labelKey: string; Icon: any; labelText?: string }

const BUILTIN: Record<string, Builtin> = {
  courses: { feature: 'courses', link: '/courses', labelKey: 'courses.courses', Icon: Books },
  journey: { feature: 'journey', link: '/journey', labelKey: '', labelText: 'Journey', Icon: MapTrifold },
  skills: { feature: 'skills', link: '/skills', labelKey: '', labelText: 'Skills', Icon: Star },
  ai_agent: { feature: 'ai_agent', link: '/ai-agent', labelKey: '', labelText: 'Astra AI', Icon: Robot },
  library: { feature: 'folders', link: '/library', labelKey: 'library.library', Icon: FolderSimple },
  podcasts: { feature: 'podcasts', link: '/podcasts', labelKey: 'podcasts.podcasts', Icon: Headphones },
  playgrounds: { feature: 'playgrounds', link: '/playgrounds', labelKey: 'common.playgrounds', Icon: Cube },
}

// Default order when an org has no custom menu config. Communities are not a
// top-level item: Q&A is reached from each course page. No store: learning
// is not sold per course.
const DEFAULT_ORDER = ['ai_agent', 'journey', 'skills', 'courses', 'library', 'podcasts', 'playgrounds']

// How many links stay inline before the rest collapse into "More".
const INLINE_LIMIT = 4

function MenuLinks(props: { orgslug: string; primaryColor?: string; layout?: 'bar' | 'stack' }) {
  const pathname = usePathname() || ''
  const { t } = useTranslation()
  const org = useOrg() as any
  const colors = getMenuColorClasses(props.primaryColor || '')

  const rf = org?.config?.config?.resolved_features
  const isEnabled = (feature: string) => {
    if (['courses', 'skills', 'ai_agent', 'podcasts', 'playgrounds'].includes(feature)) {
      return true
    }
    return rf?.[feature]?.enabled === true
  }

  const configItems: any[] | undefined =
    org?.config?.config?.customization?.menu?.items ?? org?.config?.config?.general?.menu?.items

  // Build the items to render (config-driven, else feature-driven defaults)
  const source =
    configItems && configItems.length
      ? [...configItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : DEFAULT_ORDER.map((type, i) => ({ type, enabled: true, order: i, label: '', url: '' }))

  const rendered = source
    .map((item: any) => {
      if (item.type === 'custom') {
        if (!item.enabled || !item.url) return null
        const external = /^https?:\/\//i.test(item.url)
        return {
          key: `custom-${item.url}`,
          label: item.label || item.url,
          Icon: menuIcon(item.icon),
          href: external ? item.url : getUriWithOrg(props.orgslug, item.url),
          external,
        }
      }
      const meta = BUILTIN[item.type]
      if (!meta) return null
      if (!item.enabled) return null
      if (!isEnabled(meta.feature)) return null // plan/feature gating
      return {
        key: item.type,
        label: item.label || meta.labelText || t(meta.labelKey),
        Icon: meta.Icon,
        href: getUriWithOrg(props.orgslug, meta.link),
        external: false,
      }
    })
    .filter(Boolean) as any[]

  const branded = !!props.primaryColor
  const isActive = (href: string, external: boolean) => {
    if (external) return false
    const path = href.replace(/^https?:\/\/[^/]+/, '').split('?')[0].replace(/\/$/, '')
    if (!path) return false
    return pathname === path || pathname.endsWith(path) || pathname.includes(path + '/')
  }

  const linkClass = (active: boolean) =>
    cn(
      'relative inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-[15px] font-semibold transition-colors',
      branded
        ? cn(colors.text, colors.hoverBg, active && 'bg-black/10')
        : active
          ? 'bg-selected text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
    )

  const renderLink = (it: any, extraClass = '') => {
    const active = isActive(it.href, it.external)
    const body = (
      <>
        <it.Icon size={20} weight={active ? 'fill' : 'regular'} aria-hidden />
        <span>{it.label}</span>
      </>
    )
    return it.external ? (
      <a key={it.key} href={it.href} target="_blank" rel="noopener noreferrer" className={cn(linkClass(false), extraClass)}>
        {body}
      </a>
    ) : (
      <Link key={it.key} href={it.href} aria-current={active ? 'page' : undefined} className={cn(linkClass(active), extraClass)}>
        {body}
      </Link>
    )
  }

  if (props.layout === 'stack') {
    return (
      <ul className="grid w-full gap-1">
        {rendered.map((it) => (
          <li key={it.key}>{renderLink(it, 'w-full justify-start h-11')}</li>
        ))}
      </ul>
    )
  }

  const inline = rendered.slice(0, INLINE_LIMIT)
  const overflow = rendered.slice(INLINE_LIMIT)
  const overflowActive = overflow.some((it) => isActive(it.href, it.external))

  return (
    <ul className="flex items-center gap-1">
      {inline.map((it) => (
        <li key={it.key}>{renderLink(it)}</li>
      ))}
      {overflow.length > 0 && (
        <li>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={linkClass(overflowActive)}>
                <span>{t('common.more', { defaultValue: 'More' })}</span>
                <CaretDown size={14} weight="bold" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {overflow.map((it) => {
                const active = isActive(it.href, it.external)
                return (
                  <DropdownMenuItem key={it.key} asChild className={cn(active && 'bg-selected')}>
                    {it.external ? (
                      <a href={it.href} target="_blank" rel="noopener noreferrer">
                        <it.Icon size={18} aria-hidden />
                        {it.label}
                      </a>
                    ) : (
                      <Link href={it.href} aria-current={active ? 'page' : undefined}>
                        <it.Icon size={18} weight={active ? 'fill' : 'regular'} aria-hidden />
                        {it.label}
                      </Link>
                    )}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      )}
    </ul>
  )
}

export default MenuLinks
