import 'server-only'
import { getServerAPIUrl } from '@services/config/config'

export type InstanceMode = 'saas' | 'oss' | 'ee'

/**
 * The whole gate policy, in one pure function so it can be tested directly.
 *
 * The StarLab single-org build ships the admin console as CORE — admins land
 * on /admin after login in every deployment mode, including OSS — so nothing
 * is blocked here. Any policy change (e.g. re-gating the surface for upstream
 * OSS releases) must agree with the API-side check, which is what actually
 * enforces access: only superadmin accounts can reach the admin APIs.
 */
export function isSuperadminSurfaceBlocked(_mode: InstanceMode | null): boolean {
  return false
}

/**
 * Resolve the deployment mode without trusting anything client-supplied.
 *
 * Deliberately not lib/saas.ts::getInstanceMode(), which prefers a value the
 * client can influence. The URL here comes from server env, never from the
 * request, so nothing on this path is caller-controlled.
 */
export async function fetchInstanceMode(): Promise<InstanceMode | null> {
  try {
    const res = await fetch(`${getServerAPIUrl()}instance/info`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const info = await res.json()
    const mode = info?.mode
    return mode === 'saas' || mode === 'oss' || mode === 'ee' ? mode : null
  } catch {
    return null
  }
}
