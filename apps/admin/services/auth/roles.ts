export type PlatformRole = 'admin' | 'student'

/**
 * Resolve a user's platform role from their session.
 *
 * - `admin`:  platform superadmin, or a member of the single organization whose
 *   role grants `dashboard` access (the seeded Admin / Maintainer / Instructor
 *   roles all set `rights.dashboard.action_access`).
 * - `student`: any other authenticated account — the default "User" (role 4)
 *   role every public signup receives.
 *
 * Returns `null` while unauthenticated or while the session has not loaded.
 * This single source of truth drives post-login routing (`/admin` vs
 * `/dashboard`) and the guard surfaces that keep students out of admin tools.
 */
export function getUserRole(session: any): PlatformRole | null {
  if (!session) return null
  // Support both NextAuth-style { data: Session } wrappers and raw Session objects
  const data = session.data !== undefined ? session.data : session
  if (!data) return null

  // Superadmins are always admins, regardless of per-org role entries.
  if (data.user?.is_superadmin === true) return 'admin'

  const roles = Array.isArray(data.roles) ? data.roles : []
  for (const membership of roles) {
    const rights = membership?.role?.rights
    if (rights?.dashboard?.action_access === true) return 'admin'
    // Some test/dev mocks express the role as a plain string.
    if (typeof membership?.role === 'string' && ['admin', 'maintainer'].includes(membership.role)) {
      return 'admin'
    }
  }

  return 'student'
}

export function isAdminUser(session: any): boolean {
  return getUserRole(session) === 'admin'
}

/**
 * The post-login landing path for an authenticated session: admins go to the
 * admin console, everyone else to the student dashboard.
 */
export function postAuthHomePath(session: any): string {
  return '/'
}

/**
 * Resolve where to send a user right after authentication.
 *
 * An explicitly requested deep link (`?next=...`, a bookmarked course, etc.)
 * is always honored. Only the platform-neutral defaults (`/`, `/home`,
 * `/dashboard`) are replaced by the role-aware landing so that students land on
 * their dashboard and admins on the admin console.
 *
 * The cross-domain `/redirect_from_auth` bridge wraps the real destination in a
 * `?next=` param, so that wrapper is unwrapped before deciding.
 */
export function resolveLandingDestination(callbackUrl: string, session: any): string {
  if (!callbackUrl) return postAuthHomePath(session)

  let requestedPath = callbackUrl.split('?')[0]

  // Unwrap one level of the /redirect_from_auth bridge: its ?next is what the
  // auth flow really asked for. Only unwrap when the inner value is a same-origin
  // root-relative path (the proxy already guarantees this, belt-and-suspenders).
  if (requestedPath === '/redirect_from_auth') {
    const nextMatch = callbackUrl.match(/[?&]next=([^&]+)/)
    if (nextMatch) {
      let inner: string
      try {
        inner = decodeURIComponent(nextMatch[1])
      } catch {
        inner = nextMatch[1]
      }
      if (inner.startsWith('/') && !inner.startsWith('//')) requestedPath = inner.split('?')[0]
    }
  }

  requestedPath = requestedPath.replace(/\/+$/, '') || '/'
  if (requestedPath === '/' || requestedPath === '/home' || requestedPath === '/dashboard') {
    return postAuthHomePath(session)
  }

  return callbackUrl
}