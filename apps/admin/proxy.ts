import { getAPIUrl } from './services/config/config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

interface InstanceInfo {
  multi_org_enabled: boolean
  default_org_slug: string
  mode: 'saas' | 'oss' | 'ee'
  tenancy: 'multi' | 'single'
  frontend_domain: string
  top_domain: string
}

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

function setInstanceCookies(response: NextResponse, info: InstanceInfo) {
  response.cookies.set({ name: 'LH_tenancy', value: info.tenancy, path: '/' })
  response.cookies.set({ name: 'LH_default_org', value: info.default_org_slug, path: '/' })
  response.cookies.set({ name: 'LH_frontend_domain', value: info.frontend_domain, path: '/' })
  response.cookies.set({ name: 'LH_top_domain', value: info.top_domain, path: '/' })
  response.cookies.set({ name: 'LH_mode', value: info.mode, path: '/' })
  return response
}

export const config = {
  matcher: [
    '/((?!api|_next|fonts|umami|ingest|examples|embed|monitoring|[\\w-]+\\.\\w+).*)',
  ],
}

export default async function proxy(req: NextRequest) {
  const instance = await getInstanceInfo()
  const { pathname, search } = req.nextUrl

  // 1. Backward Compatibility: legacy /admin prefix
  //    Redirect /admin -> /dash and /admin/:path* -> /dash/:path*
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const sub = pathname.replace(/^\/admin/, '') || ''
    const target = sub.startsWith('/dash') ? sub : `/dash${sub}`
    return NextResponse.redirect(new URL(`${target}${search}`, req.url), 307)
  }

  // 1b. Redirect /courses to /dash/courses
  if (pathname === '/courses' || pathname.startsWith('/courses/')) {
    const target = `/dash${pathname}`
    return NextResponse.redirect(new URL(`${target}${search}`, req.url), 307)
  }

  // 1c. Root / redirects to /dash
  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/dash${search}`, req.url), 307)
  }


  const hasAdminSession = !!req.cookies.get('LH_admin_session')?.value

  // 2. Auth Gateway
  // If user is accessing /login
  if (pathname === '/login') {
    if (hasAdminSession) {
      const response = NextResponse.redirect(new URL(`/${search}`, req.url), 307)
      return setInstanceCookies(response, instance)
    }
    const response = NextResponse.next()
    return setInstanceCookies(response, instance)
  }

  // If user is accessing protected admin pages without an active session
  if (!hasAdminSession) {
    const callbackUrl = encodeURIComponent(pathname + search)
    const response = NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, req.url), 307)
    return setInstanceCookies(response, instance)
  }

  // 3. Authorized request - pass through
  const response = NextResponse.next()
  return setInstanceCookies(response, instance)
}
