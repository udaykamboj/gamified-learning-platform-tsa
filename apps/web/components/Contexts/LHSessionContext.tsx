'use client'
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { useSession, UseSessionReturn } from '@components/Contexts/AuthContext';
import React, { useContext, createContext, useEffect } from 'react'
import { hasSessionMarker } from '@services/auth/sessionMarker'
import { useRouter } from 'next/navigation'

export const SessionContext = createContext<UseSessionReturn | null>(null)

/**
 * Provides session context to all children. Does NOT block rendering —
 * children receive session data (including loading state) and decide
 * how to handle it themselves.
 */
function LHSessionProvider({ children }: { children: React.ReactNode }) {
    const session = useSession();

    return (
        <SessionContext.Provider value={session}>
            {children}
        </SessionContext.Provider>
    )
}

/**
 * Gates the authenticated application: nothing behind it renders for a visitor
 * who has no session.
 *
 * Two states are held back, and the second is why this is a gate and not just a
 * spinner:
 *
 *   1. `loading` — we have not asked the backend yet. Show the loader, so the
 *      page behind never paints on a half-known identity.
 *   2. `unauthenticated` with no session marker — the answer came back and it is
 *      "no". This used to fall through and render `children`, flashing the full
 *      dashboard chrome at a signed-out visitor for a frame before the page's own
 *      401 handling navigated them to /login. That flash is the flicker. The
 *      redirect is a `replace`, so Back cannot return to a page they were never
 *      authorized for.
 *
 * A session marker still present is deliberately NOT treated as signed out.
 * AuthContext settles on `unauthenticated` for transient failures too (backend
 * down, 502, timeout) and keeps the cookie so the tab can heal itself; signing
 * people out over a server blip is exactly the failure that policy exists to
 * prevent. The edge (proxy.ts) has already refused entry to anyone without a
 * token cookie, so this branch is the in-session case — a session that died
 * while the tab was open.
 */
export function SessionGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
    const session = useContext(SessionContext)
    const router = useRouter()
    const needsLogin = !!session && session.status === 'unauthenticated' && !hasSessionMarker()

    useEffect(() => {
        if (!needsLogin) return
        const { pathname, search } = window.location
        const callbackUrl = encodeURIComponent(`${pathname}${search}`)
        router.replace(`/login?callbackUrl=${callbackUrl}`)
    }, [needsLogin, router])

    if (session && session.status === 'loading') {
        return fallback ? <>{fallback}</> : <PageLoading />
    }

    // Render nothing: redirecting alone still paints one frame of the page we
    // are leaving.
    if (needsLogin) return null

    return <>{children}</>
}

export function useLHSession() {
    return useContext(SessionContext)
}

export default LHSessionProvider
