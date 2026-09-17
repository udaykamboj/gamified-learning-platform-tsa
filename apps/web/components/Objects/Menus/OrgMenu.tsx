'use client'
import React, { useEffect, useState } from 'react'
import CopilotBubble from '@components/Copilot/CopilotBubble'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getUriWithOrg } from '@services/config/config'
import { fetchRAGChatSessions, RAGChatSession } from '@services/ai/ai'
import { HeaderProfileBox } from '@components/Security/HeaderProfileBox'
import MenuLinks from './OrgMenuLinks'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { SearchBar } from '@components/Objects/Search/SearchBar'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import {
  Question,
  Book,
  Globe,
  ChatCircleDots,
  ChatCircle,
  SquaresFour,
  ChalkboardSimple,
  Signpost,
} from '@phosphor-icons/react'
import { StarLabLogo } from '@components/Objects/Menus/StarLabLogo'
import AppearanceToggle from '@components/Objects/Menus/AppearanceToggle'
import { DiscordIcon } from '@components/Objects/Icons/DiscordIcon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { FeedbackModal } from '@components/Objects/Modals/FeedbackModal'
import { DASHBOARD_MENU_ITEMS, DashboardMenuItem } from '@/lib/dashboard-menu-items'
import { isFeatureAvailable } from '@services/plans/plans'
import { getMenuColorClasses } from '@services/utils/ts/colorUtils'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { useJoinBannerVisible, JOIN_BANNER_HEIGHT } from '@components/Objects/Banners/OrgJoinBanner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@components/ui/tooltip'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'

export const OrgMenu = (props: any) => {
  const orgslug = props.orgslug
  const session = useLHSession() as any;
  const _access_token = session?.data?.tokens?.access_token;
  const org = useOrg() as any;
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const pathname = usePathname()
  const { t } = useTranslation()
  const { rights } = useAdminStatus()
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const { isVisible: isJoinBannerVisible } = useJoinBannerVisible()
  const { track } = useLHAnalytics()

  // Copilot bubble state
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const [bubbleSessionToLoad, setBubbleSessionToLoad] = useState<string | null>(null)
  const [isBubbleMode, setIsBubbleMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('copilot-bubble-mode')
    return stored === 'true'
  })

  const toggleBubbleMode = (value: boolean) => {
    setIsBubbleMode(value)
    localStorage.setItem('copilot-bubble-mode', String(value))
    if (!value) setBubbleOpen(false)
  }

  const openBubbleWithSession = (sessionUuid?: string) => {
    if (sessionUuid) setBubbleSessionToLoad(sessionUuid)
    setBubbleOpen(true)
  }
  const topOffset = isJoinBannerVisible ? JOIN_BANNER_HEIGHT : 0

  // Get primary color from org config (v2: customization.general.color, v1: general.color)
  const config = org?.config?.config
  const primaryColor = config?.customization?.general?.color || config?.general?.color || ''
  const colors = getMenuColorClasses(primaryColor)

  // Filter dashboard menu items by resolved_features from API
  const rf = config?.resolved_features
  const visibleDashboardItems = DASHBOARD_MENU_ITEMS.filter((item: DashboardMenuItem) => {
    if (!item.featureKey) return true
    if (rf?.[item.featureKey]) return rf[item.featureKey].enabled
    return isFeatureAvailable(item.featureKey)
  })

  useEffect(() => {
    // Only check focus mode if we're in an activity page
    if (typeof window !== 'undefined' && pathname?.includes('/activity/')) {
      const saved = localStorage.getItem('globalFocusMode');
      setIsFocusMode(saved === 'true');
    } else {
      setIsFocusMode(false);
    }

    // Add storage event listener for cross-window changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'globalFocusMode' && pathname?.includes('/activity/')) {
        setIsFocusMode(e.newValue === 'true');
      }
    };

    // Add custom event listener for same-window changes
    const handleFocusModeChange = (e: CustomEvent) => {
      if (pathname?.includes('/activity/')) {
        setIsFocusMode(e.detail.isFocusMode);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focusModeChange', handleFocusModeChange as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focusModeChange', handleFocusModeChange as EventListener);
    };
  }, [pathname]);

  function toggleMenu() {
    setIsMenuOpen(!isMenuOpen)
  }

  // On the home page (Learning Universe) the nav floats over the full-bleed
  // 3D canvas, so we must NOT render the spacer that compensates for it.
  const isHomePage = pathname !== null && (/\/orgs\/[^/]+\/?$/.test(pathname) || pathname === '/dashboard' || pathname === '/dashboard/')

  // Only hide menu if we're in an activity page and focus mode is enabled
  if (pathname?.includes('/activity/') && isFocusMode) {
    return null;
  }

  return (
    <>
      {!isHomePage && (
        <div aria-hidden className="h-14 md:h-16" style={{ marginTop: topOffset }}></div>
      )}
      <nav
        aria-label="Top navigation"
        className={`fixed start-0 end-0 h-14 md:h-16 border-b ${!primaryColor ? 'bg-background/90 backdrop-blur-md border-border' : 'border-black/10'}`}
        style={{
          zIndex: 'var(--z-nav)',
          backgroundColor: primaryColor || undefined,
          top: topOffset
        }}
      >
        <div className="flex items-center justify-between gap-4 w-full max-w-[1440px] mx-auto px-4 md:px-6 xl:px-8 h-full">
          <div className="flex items-center gap-4 xl:gap-6 min-w-0">
            <div className="logo flex shrink-0">
              <Link href="/dashboard" aria-label={org?.name || 'StarLab'}>
                <div className="flex w-auto h-9 items-center py-1">
                  {!org || (org && !org?.logo_image) ? (
                    <StarLabLogo className={`h-8 w-auto ${!primaryColor ? 'text-foreground' : colors.text}`} />
                  ) : (
                    <img src={getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)} alt={org?.name} className="h-[30px] rounded-sm" />
                  )}
                </div>
              </Link>
            </div>
            <div className="hidden lg:flex">
              <MenuLinks orgslug={orgslug} primaryColor={primaryColor} />
            </div>
          </div>

          {/* Search Section */}
          <div className="hidden lg:flex flex-1 justify-end max-w-xs">
            <SearchBar orgslug={orgslug} className="w-full" primaryColor={primaryColor} />
          </div>

          <div className="flex items-center gap-1">
            {!primaryColor && <AppearanceToggle className="hidden xl:inline-flex me-1" />}
            {/* Progress / Trail */}
            <AuthenticatedClientElement checkMethod="authentication">
              <div className="hidden lg:flex">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={getUriWithOrg(orgslug, '/trail')}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors ${colors.iconBtn}`}
                        aria-label={t('courses.progress')}
                      >
                        <Signpost size={20} />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {t('courses.progress')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </AuthenticatedClientElement>
            {/* Boards */}
            <AuthenticatedClientElement checkMethod="authentication">
              <div className="hidden lg:flex">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={getUriWithOrg(orgslug, '/boards')}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors ${colors.iconBtn}`}
                        aria-label="Boards"
                      >
                        <ChalkboardSimple size={20} />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      Boards
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </AuthenticatedClientElement>
            {/* AI Copilot */}
            {rf?.ai?.enabled && config?.admin_toggles?.ai?.copilot_enabled !== false && (
              <AuthenticatedClientElement checkMethod="authentication">
                <div className="hidden lg:flex">
                  <CopilotMenuButton
                    orgslug={orgslug}
                    iconBtnClass={colors.iconBtn}
                    isBubbleMode={isBubbleMode}
                    onToggleBubbleMode={toggleBubbleMode}
                    bubbleOpen={bubbleOpen}
                    onOpenBubble={openBubbleWithSession}
                  />
                </div>
              </AuthenticatedClientElement>
            )}

            <div className="hidden lg:flex">
              <HeaderProfileBox primaryColor={primaryColor} />
            </div>
            <button
              type="button"
              className={`lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-[10px] ${colors.iconBtn}`}
              onClick={toggleMenu}
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>
      <div
        className={`fixed inset-x-0 bg-popover border-b border-border lg:hidden shadow-overlay transition-all duration-200 ease-out ${
          isMenuOpen ? 'opacity-100' : '-top-full opacity-0'
        }`}
        style={{
          zIndex: 'var(--z-nav-menu)',
          top: isMenuOpen ? topOffset + 56 : undefined
        }}
      >
        <div className="flex flex-col gap-4 px-4 py-4 max-h-[calc(100dvh-56px)] overflow-y-auto">
          {/* Mobile Search */}
          <SearchBar orgslug={orgslug} isMobile={true} />
          <MenuLinks orgslug={orgslug} layout="stack" />
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <HeaderProfileBox />
            <AppearanceToggle />
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        theme="light"
        userName={session?.data?.user?.username}
        userEmail={session?.data?.user?.email}
      />

      {/* Copilot floating bubble */}
      {isBubbleMode && (
        <CopilotBubble
          orgslug={orgslug}
          open={bubbleOpen}
          onOpenChange={setBubbleOpen}
          sessionToLoad={bubbleSessionToLoad}
        />
      )}
    </>
  )
}
const CopilotMenuButton = ({
  orgslug,
  isBubbleMode,
  onToggleBubbleMode,
  bubbleOpen,
  onOpenBubble,
}: {
  orgslug: string
  iconBtnClass: string
  isBubbleMode: boolean
  onToggleBubbleMode: (_v: boolean) => void
  bubbleOpen: boolean
  onOpenBubble: (_sessionUuid?: string) => void
}) => {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [isOpen, setIsOpen] = useState(false)

  // Only fetch when the dropdown is open — avoids firing on every page load
  const { data: sessions } = useQuery<RAGChatSession[]>({
    queryKey: queryKeys.ai.ragSessions(orgslug),
    queryFn: () => fetchRAGChatSessions(accessToken, orgslug),
    enabled: isOpen && !!accessToken && !!orgslug,
    staleTime: 60_000,
  })

  const recentSessions = (sessions || []).slice(0, 5)

  return (
    <DropdownMenu onOpenChange={setIsOpen}>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors hover:bg-accent"
                aria-label="Copilot"
              >
                <ChatCircle size={20} className="text-discovery" />
                {/* Active indicator dot */}
                {isBubbleMode && bubbleOpen && (
                  <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-violet-500 ring-2 ring-white " />
                )}
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Copilot
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <ChatCircle size={16} weight="fill" className="text-violet-500" />
          <span>Copilot</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {recentSessions.length > 0 ? (
          <>
            {recentSessions.map((s) => (
              isBubbleMode ? (
                <DropdownMenuItem
                  key={s.aichat_uuid}
                  onSelect={() => onOpenBubble(s.aichat_uuid)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <ChatCircleDots size={14} weight="fill" className="shrink-0 text-neutral-400" />
                  <span className="truncate text-sm">{s.title || 'Untitled'}</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={s.aichat_uuid} asChild>
                  <Link href={getUriWithOrg(orgslug, `/copilot?chat=${s.aichat_uuid}`)} className="flex items-center gap-2">
                    <ChatCircleDots size={14} weight="fill" className="shrink-0 text-neutral-400" />
                    <span className="truncate text-sm">{s.title || 'Untitled'}</span>
                  </Link>
                </DropdownMenuItem>
              )
            ))}
            <DropdownMenuSeparator />
          </>
        ) : (
          <div className="px-2 py-3 text-center">
            <p className="text-xs text-neutral-400">No conversations yet</p>
          </div>
        )}

        {/* Primary action */}
        {isBubbleMode ? (
          <DropdownMenuItem
            onSelect={() => onOpenBubble()}
            className="flex items-center gap-2 font-medium cursor-pointer"
          >
            <ChatCircle size={14} weight="fill" className="text-violet-500" />
            <span>{recentSessions.length > 0 ? 'New conversation' : 'Start a conversation'}</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link href={getUriWithOrg(orgslug, '/copilot')} className="flex items-center gap-2 font-medium">
              <ChatCircle size={14} weight="fill" className="text-violet-500" />
              <span>{recentSessions.length > 0 ? 'View all conversations' : 'Start a conversation'}</span>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Bubble mode toggle */}
        <button
          onClick={() => onToggleBubbleMode(!isBubbleMode)}
          className="w-full flex items-center justify-between px-2 py-2 rounded-md hover:bg-neutral-50 transition-colors group"
        >
          <span className="text-xs text-neutral-500 group-hover:text-neutral-700 transition-colors">
            Open in bubble
          </span>
          <span
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors flex-shrink-0 ${
              isBubbleMode ? 'bg-violet-500' : 'bg-neutral-200 '
            }`}
          >
            <span
              className={`inline-block h-3 w-3 rounded-full bg-card shadow-sm transition-transform ${
                isBubbleMode ? 'translate-x-3.5 rtl:-translate-x-3.5' : 'translate-x-0.5 rtl:-translate-x-0.5'
              }`}
            />
          </span>
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

