'use client'
import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@components/Contexts/AuthContext'
import { hasSessionMarker } from '@services/auth/sessionMarker'
import { postAuthHomePath } from '@services/auth/roles'

/**
 * Decides what the apex (`/`) shows, once the session question has an answer.
 *
 * The apex is the public marketing page, but a signed-in visitor belongs on
 * their dashboard. The proxy used to make that call from cookies alone, which is
 * a guess: the cookies prove a session was minted, not that one is still valid.
 * A stale session therefore dragged the visitor off a public page into the app,
 * where the client discovered the truth and redirected to /login — / → /dashboard
 * → /login, with the app in between. That is the flicker.
 *
 * So the decision waits for verification, and the frame waits with it:
 *
 *   - No session marker → nothing to verify. The marketing page renders
 *     immediately; the common anonymous case costs no round trip and no layout
 *     shift.
 *   - Marker, still checking → render nothing. Showing the marketing page would
 *     flash it at someone about to be sent to their dashboard; showing the
 *     dashboard would flash it at someone about to be sent back here.
 *   - Marker, confirmed → role-aware landing (`/admin` for admins, else
 *     `/dashboard`), matching post-login routing everywhere else.
 *   - Marker, rejected → the marketing page, which is where they asked to be. A
 *     terminal rejection has already cleared the marker, so this does not
 *     oscillate.
 */
// The marker is a browser-only value that changes as a side effect of auth
// calls, not of React rendering, so it is read as an external store rather than
// copied into state. The server snapshot is `false`: `document.cookie` does not
// exist during SSR, and a render-time read there would disagree with the server
// HTML on exactly the visits this component exists to handle. Nothing to
// subscribe to — a marker change always arrives with a navigation that re-renders
// this tree anyway.
const subscribeToNothing = () => () => {}

export default function ApexSessionGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { status, data } = useSession()
  const hasMarker = useSyncExternalStore(
    subscribeToNothing,
    hasSessionMarker,
    () => false,
  )

  useEffect(() => {
    if (status !== 'authenticated') return
    router.replace(postAuthHomePath(data))
  }, [status, data, router])

  // Verified, and there was a session to verify. While it is loading or already
  // confirmed we are navigating away, so hold the frame rather than paint the
  // page we are leaving.
  if (hasMarker && status !== 'unauthenticated') return null

  return <>{children}</>
}
