import {
  Users,
  UserPlus,
  ClipboardText,
} from '@phosphor-icons/react'
import type { SearchMeta } from '@/lib/dashboard-search/types'

export const searchMetas: SearchMeta[] = [
  {
    id: 'dash.users.list',
    titleKey: 'dashboard.users.settings.tabs.users',
    descriptionKey: 'dashboard.search.entries.users.description',
    keywordsKey: 'dashboard.search.entries.users.keywords',
    icon: Users,
    href: '/dash/users/settings/users',
    group: 'users',
  },
  {
    id: 'dash.users.signups',
    titleKey: 'dashboard.users.settings.tabs.signups',
    descriptionKey: 'dashboard.search.entries.signups.description',
    keywordsKey: 'dashboard.search.entries.signups.keywords',
    icon: UserPlus,
    href: '/dash/users/settings/signups',
    group: 'users',
  },
  {
    id: 'dash.users.audit_logs',
    titleKey: 'dashboard.users.settings.tabs.audit_logs',
    descriptionKey: 'dashboard.search.entries.users_audit_logs.description',
    keywordsKey: 'dashboard.search.entries.users_audit_logs.keywords',
    icon: ClipboardText,
    href: '/dash/users/settings/audit-logs',
    group: 'users',
  },
]
