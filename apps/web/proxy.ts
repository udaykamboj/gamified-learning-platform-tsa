import { getAPIUrl } from './services/config/config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isLocalhost as isLocalhostCheck } from './services/utils/ts/hostUtils'
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './services/auth/cookies'

// =============================================================================
// Tenancy
// =============================================================================
//
// Three runtime behaviors selected by `instance.tenancy`:
//
//   1. multi (EE-only):   slug.{STARLAB_DOMAIN} subdomain detection +
//                         per-org custom domains. The detection logic lives in
//                         `./ee/services/tenancy/...` and is dynamic-imported
//                         here — OSS proxy.ts never references subdomain or
//                         custom-domain helpers directly.
//   2. single (localhost): always serves the default org. Host-only cookies.
//   3. single (VPS):       any domain on a self-hosted VPS. Same as #2 — we
//                         trust the incoming Host header.
//
// Modes 2 and 3 share `tenancy === "single"`. The OSS code path returns the
// default org without ever calling subdomain extraction.

interface InstanceInfo {
  multi_org_enabled: boolean
  default_org_slug: string
  mode: 'saas' | 'oss' | 'ee'
  tenancy: 'multi' | 'single'
  frontend_domain: string
  top_domain: string
}

// Cached instance info from backend (30-second TTL)
let _instanceCache: { data: InstanceInfo; ts: number } | null = null
const INSTANCE_CACHE_TTL = 30 * 1000

async function getInstanceInfo(): Promise<InstanceInfo> {
  if (_instanceCache && Date.now() - _instanceCache.ts < INSTANCE_CACHE_TTL) {
    return _instanceCache.data
  }

  try {
    const apiUrl = getAPIUrl()
    const res = await fetch(`${apiUrl}instance/info`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) {
      const raw = await res.json()
      // Older backends only return `multi_org_enabled`; derive `tenancy`.
      const tenancy: 'multi' | 'single' =
        raw.tenancy === 'multi' || raw.multi_org_enabled ? 'multi' : 'single'
      _instanceCache = { data: { ...raw, tenancy }, ts: Date.now() }
      return _instanceCache.data
    }
  } catch {
    // Backend unavailable — use safe defaults
  }
  return {
    multi_org_enabled: false,
    default_org_slug: 'default',
    mode: 'oss' as const,
    tenancy: 'single',
    frontend_domain: 'localhost:3000',
    top_domain: 'localhost',
  }
}

// =============================================================================
// Resolver
// =============================================================================

interface ResolvedTenant {
  slug: string
  customDomain?: string
  source: 'custom-domain' | 'subdomain' | 'cookie' | 'default'
}

/**
 * Resolve the active tenant for this request.
 *
 * In `single` tenancy this is unconditionally the default org — no EE code
 * loaded, no custom-domain lookup, no subdomain extraction. In `multi`
 * tenancy we delegate to the EE resolver via dynamic import; if the import
 * or resolver throws (e.g. EE folder removed at deploy time), we log and
 * fall back to the default org so the site stays up.
 */
async function resolveTenant(req: NextRequest, instance: InstanceInfo): Promise<ResolvedTenant> {
  if (instance.tenancy === 'single') {
    const activeOrg = req.cookies.get('LH_org')?.value
    if (activeOrg && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(activeOrg)) {
      return { slug: activeOrg, source: 'cookie' }
    }
    return { slug: instance.default_org_slug, source: 'default' }
  }

  try {
    const mod = await import('./ee/services/tenancy/resolveMulti.middleware')
    return await mod.resolveMultiFromRequest(req, instance)
  } catch (err) {
    console.warn('[proxy] EE multi-tenant resolver unavailable; falling back to default org', err)
    return { slug: instance.default_org_slug, source: 'default' }
  }
}

/**
 * In `multi` tenancy, ask the EE module whether this Host is a custom domain
 * (used by the `/redirect_from_auth` handler). Always false in `single`.
 */
async function hostIsCustomDomain(host: string | null, instance: InstanceInfo): Promise<boolean> {
  if (instance.tenancy === 'single' || !host) return false
  try {
    const mod = await import('./ee/services/tenancy/resolveMulti.middleware')
    return mod.isCustomDomain(host, instance.frontend_domain)
  } catch {
    return false
  }
}

/**
 * Detect the admin subdomain (multi tenancy only). In single mode there is no
 * admin subdomain — operators reach admin via /admin path.
 */
async function isAdminSubdomain(host: string | null, instance: InstanceInfo): Promise<boolean> {
  if (instance.tenancy === 'single' || !host) return false
  try {
    const mod = await import('./ee/services/tenancy/resolveMulti.middleware')
    return mod.extractOrgSubdomain(host, instance.frontend_domain) === 'admin'
      // The EE helper filters out reserved subdomains; check raw too:
      || host.split(':')[0] === `admin.${instance.frontend_domain.split(':')[0]}`
      || host.startsWith('admin.')
  } catch {
    return host.startsWith('admin.')
  }
}

// =============================================================================
// Cookies
// =============================================================================

/**
 * Compute the cookie `domain` attribute given the current tenant.
 * - single tenancy → '' (host-only cookie)
 * - multi tenancy + custom domain → '' (host-only cookie)
 * - multi tenancy + apex/subdomain → '.{top_domain}' (cross-subdomain auth)
 * - localhost in either mode → '' (browsers refuse `Domain=.localhost`)
 */
function cookieDomainFor(instance: InstanceInfo, customDomain?: string): string {
  if (instance.tenancy === 'single') return ''
  if (customDomain) return ''
  if (instance.top_domain === 'localhost') return ''
  return `.${instance.top_domain}`
}

function setOrgCookies(
  response: NextResponse,
  resolved: ResolvedTenant,
  instance: InstanceInfo,
) {
  const domain = cookieDomainFor(instance, resolved.customDomain)
  response.cookies.set({
    name: 'LH_org',
    value: resolved.slug,
    domain,
    path: '/',
  })
  if (resolved.customDomain) {
    response.cookies.set({
      name: 'LH_custom_domain',
      value: resolved.customDomain,
      path: '/',
    })
    response.headers.set('x-custom-domain', resolved.customDomain)
  }
}

function setInstanceCookies(response: NextResponse, info: InstanceInfo) {
  response.cookies.set({ name: 'LH_tenancy', value: info.tenancy, path: '/' })
  response.cookies.set({ name: 'LH_default_org', value: info.default_org_slug, path: '/' })
  response.cookies.set({ name: 'LH_frontend_domain', value: info.frontend_domain, path: '/' })
  response.cookies.set({ name: 'LH_top_domain', value: info.top_domain, path: '/' })
  response.cookies.set({ name: 'LH_mode', value: info.mode, path: '/' })
  return response
}

/**
 * Build a request-header bag that propagates tenancy context to downstream
 * Server Components on THIS request. Cookies set in the response only become
 * visible to RSC on the *next* request, so server-side helpers like
 * `getCanonicalUrl` can't rely on them on the first cold load. Reading the
 * `x-lh-*` headers via `next/headers` gives them an immediately-available
 * source of truth.
 */
function tenantRequestHeaders(
  req: NextRequest,
  resolved: ResolvedTenant,
  instance: InstanceInfo,
): Headers {
  const headers = new Headers(req.headers)
  headers.set('x-lh-tenancy', instance.tenancy)
  headers.set('x-lh-org', resolved.slug)
  headers.set('x-lh-top-domain', instance.top_domain)
  headers.set('x-lh-frontend-domain', instance.frontend_domain)
  headers.set('x-lh-mode', instance.mode)
  if (resolved.customDomain) {
    headers.set('x-lh-custom-domain', resolved.customDomain)
  }
  return headers
}

// =============================================================================
// Session detection
// =============================================================================
//
// A session is NOT "the LH_session cookie is present". That marker is
// non-httpOnly and lives for the full 30-day refresh window, so it routinely
// outlives the credentials it was minted next to: an expired or revoked refresh
// cookie, a sign-out that only cleared one of the domain-scoped and host-only
// copies, or a browser that kept the marker after the tokens were dropped.
//
// Trusting the marker alone let /dashboard — and every org route behind the
// catch-all — render the whole student application for a visitor with no
// session at all. The client then discovered the truth, tore the page down and
// sent them to /login: a flash of authenticated chrome followed by a redirect,
// which reads as a page that flickers. The dashboard was never actually theirs
// to see.
//
// A real session carries the marker AND at least one httpOnly token cookie —
// /api/auth/* writes them in the same response (app/api/auth/[...path]/route.ts).
// Either token counts: a refresh response re-mints only the access token, so a
// session can legitimately hold LH_access while LH_refresh has expired.
function hasSessionMarkerCookie(req: NextRequest): boolean {
  return !!req.cookies.get('LH_session')?.value
}

function hasUsableSession(req: NextRequest): boolean {
  if (!hasSessionMarkerCookie(req)) return false
  return !!(
    req.cookies.get(ACCESS_TOKEN_COOKIE)?.value
    || req.cookies.get(REFRESH_TOKEN_COOKIE)?.value
  )
}

/**
 * Send an unauthenticated visitor to the login page, remembering where they
 * were headed.
 *
 * An orphaned marker (present, but no token behind it) is expired on the way
 * out. Left in place it is worse than no marker at all: the client polls on it
 * every refetch tick, and — because /login treats any marker as "already
 * signed in" — it bounces the visitor straight back here. Clearing it here ends
 * that loop at the source instead of letting the two pages disagree.
 */
function loginRedirect(
  req: NextRequest,
  instance: InstanceInfo,
): NextResponse {
  const { pathname, search } = req.nextUrl
  const callbackUrl = encodeURIComponent(pathname + search)
  const response = NextResponse.redirect(
    new URL(`/login?callbackUrl=${callbackUrl}`, req.url),
  )
  if (hasSessionMarkerCookie(req)) {
    expireSessionMarker(response, instance)
  }
  return response
}

/** Expire LH_session in both the host-only and domain-scoped variants. */
function expireSessionMarker(response: NextResponse, instance: InstanceInfo): void {
  const domain = cookieDomainFor(instance)
  response.cookies.set({ name: 'LH_session', value: '', path: '/', maxAge: 0 })
  if (domain) {
    response.cookies.set({ name: 'LH_session', value: '', path: '/', maxAge: 0, domain })
  }
}

// =============================================================================
// Middleware
// =============================================================================

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. /fonts (inside /public)
     * 4. Umami Analytics
     * 5. /examples (inside /public)
     * 6. all root files inside /public (e.g. /favicon.ico)
     * 7. /embed (activity embeds)
     * 8. /ingest (PostHog reverse proxy — must reach the next.config rewrite
     *    untouched; otherwise the middleware mis-routes it and ingestion 404s)
     */
    '/((?!api|_next|fonts|umami|ingest|examples|embed|monitoring|[\\w-]+\\.\\w+).*)',
    '/sitemap.xml',
    '/robots.txt',
    '/payments/stripe/connect/oauth',
    '/podcast/:path*/feed',
  ],
}

export default async function proxy(req: NextRequest) {
  const instance = await getInstanceInfo()
  const { pathname, search } = req.nextUrl
  const fullhost = req.headers.get('host')

  // SEO: canonicalize mixed-case top-level route names (/Login → /login). Scoped
  // to KNOWN static routes only so it never lowercases data-bearing segments
  // (org slugs, course/activity UUIDs, media paths).
  const CANONICAL_LOWER = new Set([
    '/login', '/signup', '/forgot', '/reset', '/verify-email',
    '/home', '/billing', '/new', '/account', '/organizations', '/subscriptions',
  ])
  if (pathname !== pathname.toLowerCase() && CANONICAL_LOWER.has(pathname.toLowerCase())) {
    return NextResponse.redirect(new URL(`${pathname.toLowerCase()}${search}`, req.url), 308)
  }

  // -------------------------------------------------------------------------
  // 1. Admin paths do NOT exist in the student application (apps/web).
  //    Seamlessly redirect to the dedicated Admin Portal (apps/admin on port 3020).
  // -------------------------------------------------------------------------
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const adminBase = process.env.ADMIN_PORTAL_URL || 'http://localhost:3020'
    const targetPath = pathname.replace(/^\/admin/, '') || '/'
    return NextResponse.redirect(new URL(`${targetPath}${search}`, adminBase), 307)
  }

  // -------------------------------------------------------------------------
  // 2. Legacy /dashboard/* → hub redirects
  //
  //    The old platform (starlab.app) used /dashboard/{slug}/plan, /dashboard/
  //    new, /dashboard/account, etc. Those paths do NOT exist on .io and would
  //    404. Old bookmarks, emails, and — critically — URLs Stripe has already
  //    stored on live checkout sessions can still point here, so permanently map
  //    them onto the hub instead of dead-ending. SaaS/multi only.
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // 1b. Student dashboard — /dashboard resolves to the organisation's Learning
  //     Universe (the student home), never to the admin surface. In the
  //     single-org model there is exactly one organization, so resolution is
  //     tenant-based: the LH_org cookie (if any) is ignored in favour of the
  //     platform default so a stale cookie can't point a student at the wrong
  //     (or admin) area. Admins land on /admin after login, not here.
  // -------------------------------------------------------------------------
  if (pathname === '/dashboard') {
    if (!hasUsableSession(req)) {
      return loginRedirect(req, instance)
    }
    
    const resolved = await resolveTenant(req, instance)
    const requestHeaders = tenantRequestHeaders(req, resolved, instance)
    const response = NextResponse.rewrite(
      new URL(`/orgs/${resolved.slug}${search}`, req.url),
      { request: { headers: requestHeaders } },
    )
    setOrgCookies(response, resolved, instance)
    setInstanceCookies(response, instance)
    return response
  }

  if (instance.tenancy === 'multi' && pathname.startsWith('/dashboard')) {
    let dest = '/home'
    const planMatch = pathname.match(/^\/dashboard\/([^/]+)\/plan\/?$/)
    if (planMatch && planMatch[1] !== 'new') {
      dest = `/billing?org=${planMatch[1]}`
    } else if (pathname === '/dashboard/new' || pathname.startsWith('/dashboard/new/')) {
      dest = '/new'
    } else if (pathname === '/dashboard/subscriptions') {
      dest = '/subscriptions'
    } else if (pathname === '/dashboard/account' || pathname.startsWith('/dashboard/account/')) {
      dest = '/account'
    }
    // Preserve query markers (checkout=cancelled, session_id, …). /billing?org=
    // already carries a query, so merge with & in that case.
    const extraQuery = search ? (dest.includes('?') ? `&${search.slice(1)}` : search) : ''
    return NextResponse.redirect(new URL(`${dest}${extraQuery}`, req.url), 308)
  }

  // -------------------------------------------------------------------------
  // 2. Standard out-of-org paths (root hub)
  //
  //    These render at the apex/root and must NEVER fall into the tenant
  //    catch-all (which would rewrite them to /orgs/{slug}/...). `/home` is the
  //    org picker and works in every tenancy. The rest form the central
  //    account + org-management hub (create / upgrade / delete an org, billing,
  //    account) and only exist in `multi` tenancy (SaaS); the (hub) route-group
  //    layout additionally enforces SaaS gating. We set instance cookies so the
  //    hub's client components can read tenancy/mode/top-domain.
  // -------------------------------------------------------------------------
  const HUB_ROOT_PATHS = ['/home', '/organizations', '/account', '/billing', '/subscriptions', '/new']
  const isHubRoot = HUB_ROOT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
  // Single-org mode: there is exactly one organization everyone joins, so the
  // org-management hub (org picker, org creation, subscriptions) has nothing to
  // offer — collapse it onto the student dashboard. Account management stays.
  // Multi-tenant (SaaS) deployments keep the full hub below.
  if (
    instance.tenancy !== 'multi'
    && ['/home', '/organizations', '/new', '/subscriptions'].includes(pathname)
  ) {
    const response = NextResponse.redirect(new URL('/dashboard', req.url), 308)
    setInstanceCookies(response, instance)
    return response
  }
  if (pathname === '/home' || pathname === '/new' || (instance.tenancy === 'multi' && isHubRoot)) {
    // `/account/*` ALSO exists as an org-scoped dashboard route
    // (/orgs/{slug}/account/[subpage] — general/security/purchases). On an org
    // subdomain or custom domain it must resolve there, NOT the apex hub (which
    // has no /account subpages), so let it fall through to the tenant catch-all.
    let onOrgHost = false
    if ((pathname === '/account' || pathname.startsWith('/account/')) && instance.tenancy === 'multi') {
      const resolved = await resolveTenant(req, instance)
      onOrgHost = resolved.source === 'subdomain' || resolved.source === 'custom-domain'
    }
    if (!onOrgHost) {
      const response = NextResponse.rewrite(new URL(`${pathname}${search}`, req.url))
      setInstanceCookies(response, instance)
      return response
    }
    // account on an org host → fall through to the tenant-scoped rewrite below.
  }

  // -------------------------------------------------------------------------
  // 3. Auth pages — resolve tenant for cookie context, rewrite to /auth
  // -------------------------------------------------------------------------
  const authPaths = ['/login', '/signup', '/reset', '/forgot', '/verify-email']
  if (authPaths.includes(pathname)) {
    const hasSession = hasUsableSession(req)
    // An orphaned marker (present, but no token behind it) is not a session.
    // These pages are where a visitor bounced off a guarded route ends up, so
    // this is the last place the stale cookie can be dropped before the client
    // starts polling on it — and before /login would bounce them back out.
    const orphanedMarker = !hasSession && hasSessionMarkerCookie(req)

    // A logged-in user has no business on /login — bounce them to the hub (the
    // page itself re-verifies, so this is a best-effort UX shortcut).
    if (pathname === '/login' && hasSession) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    const resolved = await resolveTenant(req, instance)

    // `/signup` is NOT only a signup page: for a signed-in user on an org host
    // it is the JOIN screen (the "Join this organization" banner and every
    // invite link point at it). Bouncing them to /home dropped them on the org
    // picker instead — and silently threw away any ?inviteCode. So only send a
    // signed-in visitor to the hub when there is genuinely no org to join here:
    // the org-less apex, with no invite code in hand.
    if (pathname === '/signup' && hasSession) {
      const onOrgHost =
        instance.tenancy === 'single'
        || resolved.source === 'subdomain'
        || resolved.source === 'custom-domain'
      const hasInviteCode = !!req.nextUrl.searchParams.get('inviteCode')
      if (!onOrgHost && !hasInviteCode) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }

    const requestHeaders = tenantRequestHeaders(req, resolved, instance)
    const response = NextResponse.rewrite(
      new URL(`/auth${pathname}${search}`, req.url),
      { request: { headers: requestHeaders } },
    )
    if (orphanedMarker) expireSessionMarker(response, instance)
    setOrgCookies(response, resolved, instance)
    setInstanceCookies(response, instance)
    return response
  }

  // -------------------------------------------------------------------------
  // 4. Auth callbacks — pass through without org rewrite
  // -------------------------------------------------------------------------
  if (
    pathname.startsWith('/auth/sso/')
    || pathname.startsWith('/auth/callback/')
    || pathname.startsWith('/auth/token-exchange')
  ) {
    const response = NextResponse.rewrite(new URL(`${pathname}${search}`, req.url))
    setInstanceCookies(response, instance)
    return response
  }

  // Magic login links are emailed as /auth/magic?token=… — already the internal
  // path, so it needs a pass-through of its own. Without one it fell to the
  // tenant catch-all, was rewritten to /orgs/{slug}/auth/magic, and every
  // emailed link 404'd. Tenant is resolved (unlike the callbacks above) because
  // the page finishes through /redirect_from_auth, which reads the org cookies
  // to know which host to land on.
  if (pathname === '/auth/magic') {
    const resolved = await resolveTenant(req, instance)
    const requestHeaders = tenantRequestHeaders(req, resolved, instance)
    const response = NextResponse.rewrite(
      new URL(`${pathname}${search}`, req.url),
      { request: { headers: requestHeaders } },
    )
    setOrgCookies(response, resolved, instance)
    setInstanceCookies(response, instance)
    return response
  }

  // -------------------------------------------------------------------------
  // 5. Standalone editors / boards — bypass org rewrite
  // -------------------------------------------------------------------------
  if (pathname.match(/^\/course\/[^/]+\/activity\/[^/]+\/edit$/)) {
    return NextResponse.rewrite(new URL(`/editor${pathname}`, req.url))
  }
  if (pathname.startsWith('/board/')) {
    const response = NextResponse.rewrite(new URL(pathname + search, req.url))
    setInstanceCookies(response, instance)
    return response
  }
  if (pathname.startsWith('/editor/playground/')) {
    const response = NextResponse.rewrite(new URL(pathname + search, req.url))
    setInstanceCookies(response, instance)
    return response
  }

  // -------------------------------------------------------------------------
  // 6. Stripe Connect OAuth callback — preserve search params + add orgslug
  // -------------------------------------------------------------------------
  if (req.nextUrl.pathname.startsWith('/payments/stripe/connect/oauth')) {
    const searchParams = req.nextUrl.searchParams
    const orgslug = searchParams.get('state')?.split('_')[0]
    const redirectUrl = new URL('/payments/stripe/connect/oauth', req.url)
    searchParams.forEach((value, key) => {
      redirectUrl.searchParams.append(key, value)
    })
    if (orgslug) {
      redirectUrl.searchParams.set('orgslug', orgslug)
    }
    return NextResponse.rewrite(redirectUrl)
  }

  // -------------------------------------------------------------------------
  // 7. Health check
  // -------------------------------------------------------------------------
  if (pathname.startsWith('/health')) {
    return NextResponse.rewrite(new URL(`/api/health`, req.url))
  }

  // -------------------------------------------------------------------------
  // 8. Auth redirect bridge (cross-domain return path)
  // -------------------------------------------------------------------------
  if (pathname === '/redirect_from_auth') {
    const params = new URLSearchParams(req.nextUrl.searchParams)

    const rawNext = params.get('next')
    params.delete('next')

    const customDomain = req.cookies.get('LH_custom_domain')?.value
    const base = customDomain
      ? `${req.nextUrl.protocol}//${customDomain}`
      : req.url
    const baseOrigin = new URL(base).origin

    // Every auth flow forwards where the user was headed as ?next. Landing them
    // on "/" instead threw that away, so a deep link that prompted a sign-in
    // always returned to the org picker.
    //
    // Resolve the candidate and compare origins rather than pattern-matching the
    // raw string: this is an open-redirect sink, and a prefix test lets through
    // anything the URL parser later normalises into another origin ("//evil",
    // "/\evil", encoded control characters). Only the path survives.
    let dest = '/'
    if (rawNext) {
      try {
        const candidate = new URL(rawNext, baseOrigin)
        if (candidate.origin === baseOrigin) {
          dest = `${candidate.pathname}${candidate.search}${candidate.hash}`
        }
      } catch {
        // Unparseable — fall back to the root.
      }
    }

    const redirectUrl = new URL(dest, base)
    const remaining = params.toString()
    if (remaining) {
      redirectUrl.search = redirectUrl.search
        ? `${redirectUrl.search}&${remaining}`
        : remaining
    }
    return NextResponse.redirect(redirectUrl)
  }

  // -------------------------------------------------------------------------
  // 9. Per-org metadata endpoints (sitemap, robots, podcast feed)
  // -------------------------------------------------------------------------
  if (pathname.match(/^\/podcast\/([^/]+)\/feed$/)) {
    const resolved = await resolveTenant(req, instance)
    const feedUrl = new URL(`/api${pathname}`, req.url)
    const response = NextResponse.rewrite(feedUrl)
    response.headers.set('X-Feed-Orgslug', resolved.slug)
    return response
  }
  if (pathname.startsWith('/sitemap.xml')) {
    const resolved = await resolveTenant(req, instance)
    const sitemapUrl = new URL(`/api/sitemap`, req.url)
    const response = NextResponse.rewrite(sitemapUrl)
    response.headers.set('X-Sitemap-Orgslug', resolved.slug)
    return response
  }
  if (pathname === '/robots.txt') {
    const resolved = await resolveTenant(req, instance)
    const robotsUrl = new URL(`/api/robots`, req.url)
    const response = NextResponse.rewrite(robotsUrl)
    response.headers.set('X-Robots-Orgslug', resolved.slug)
    return response
  }

  // The apex is the public website. Keep it out of tenant resolution so the
  // marketing page owns `/` in every tenancy mode.
  //
  // It is deliberately NOT redirected to /dashboard on the strength of cookies.
  // Those cookies say a session was minted, not that one is still valid, and the
  // edge cannot tell the difference — only the client can, once it has asked the
  // backend. Redirecting here sent anyone holding a stale session off a public
  // page into the app, which then discovered there was no session and threw
  // them back at /login: / → /dashboard → /login, with the dashboard in between.
  // `ApexSessionGate` (app/apex-session-gate.tsx) makes the same decision on the
  // client, after verification, so no one is ever shown the wrong page.
  if (pathname === '/') {
    const response = NextResponse.next()
    // Clear an orphaned marker on the public site too, so a visitor who lands
    // here first stops the client from polling on a session that isn't there.
    if (hasSessionMarkerCookie(req)) expireSessionMarker(response, instance)
    return response
  }

  // -------------------------------------------------------------------------
  // 10. Apex root (multi tenancy only) — login-first, then org picker.
  //
  //     The bare apex (starlab.io) is NOT org-scoped. An unauthenticated
  //     visitor lands on the login page; once signed in they get the /home org
  //     picker and choose an org — which lives on its own subdomain
  //     ({slug}.starlab.io) or custom domain. Org content is ONLY served on
  //     a subdomain/custom domain, never at the apex. Mirrors the platform's
  //     "log in, then choose an org" flow. We branch on the non-httpOnly
  //     LH_session marker cookie (best-effort; the page itself re-verifies).
  // -------------------------------------------------------------------------
  if (
    instance.tenancy === 'multi'
    && pathname === '/'
    && fullhost
    && !isLocalhostCheck(fullhost)
    && !(await hostIsCustomDomain(fullhost, instance))
  ) {
    const resolved = await resolveTenant(req, instance)
    if (resolved.source === 'default') {
      const hasSession = hasUsableSession(req)
      const target = hasSession ? `/home${search}` : `/auth/login${search}`
      const requestHeaders = tenantRequestHeaders(req, resolved, instance)
      const response = NextResponse.rewrite(new URL(target, req.url), {
        request: { headers: requestHeaders },
      })
      setOrgCookies(response, resolved, instance)
      setInstanceCookies(response, instance)
      return response
    }
  }

  // -------------------------------------------------------------------------
  // 11. Tenant-scoped rewrite — the catch-all that puts us under /orgs/{slug}
  //     All routes at this level belong to the authenticated student application,
  //     so we strictly enforce authentication at the edge.
  // -------------------------------------------------------------------------
  if (!hasUsableSession(req)) {
    // If an unauthenticated user accesses a student route directly (e.g. /courses),
    // redirect them to the login gateway.
    return loginRedirect(req, instance)
  }

  const resolved = await resolveTenant(req, instance)
  const requestHeaders = tenantRequestHeaders(req, resolved, instance)
  // `${search}` is load-bearing: a rewrite destination built from an absolute
  // path drops the base URL's query, and Next treats the destination's search
  // as the request's. Every other branch above appends it; this one did not, so
  // org-scoped pages lost their query string (?page, ?q, ?tab, …).
  const response = NextResponse.rewrite(
    new URL(`/orgs/${resolved.slug}${pathname}${search}`, req.url),
    { request: { headers: requestHeaders } },
  )
  setOrgCookies(response, resolved, instance)
  setInstanceCookies(response, instance)
  return response
}
