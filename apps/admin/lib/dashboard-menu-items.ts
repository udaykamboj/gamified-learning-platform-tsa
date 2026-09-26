export interface DashboardMenuItem {
  key: string
  label: string
  iconName: string
  href: string
  badge?: string
  featureFlag?: string
}

export const DASHBOARD_MENU_ITEMS: DashboardMenuItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    iconName: 'LayoutDashboard',
    href: '/dashboard',
  },
  {
    key: 'courses',
    label: 'Courses',
    iconName: 'BookOpen',
    href: '/courses',
  },
  {
    key: 'skills',
    label: 'Skills',
    iconName: 'Award',
    href: '/skills',
  },
  {
    key: 'podcasts',
    label: 'Podcasts',
    iconName: 'Headphones',
    href: '/podcasts',
  },
  {
    key: 'library',
    label: 'Library',
    iconName: 'Folder',
    href: '/library',
  },
  {
    key: 'playgrounds',
    label: 'Playgrounds',
    iconName: 'Code',
    href: '/playgrounds',
  },
  {
    key: 'boards',
    label: 'Boards',
    iconName: 'Kanban',
    href: '/boards',
  },
  {
    key: 'community',
    label: 'Community',
    iconName: 'MessageSquare',
    href: '/communities',
  },
  {
    key: 'ai-agent',
    label: 'AI Agent',
    iconName: 'Sparkles',
    href: '/ai-agent',
  },
]
