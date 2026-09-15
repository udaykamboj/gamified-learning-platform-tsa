import { redirect } from 'next/navigation'

// Defensive fallback only. The proxy rewrites `/dashboard` to the student
// Landing/Universe (`/orgs/{slug}/`) before any request reaches the app router,
// so this route is never served in practice. If it ever is (proxy bypassed),
// bounce to the apex — the proxy or the org catch-all turns `/` into the
// student home.
export default function DashboardEntryPage() {
  redirect('/')
}