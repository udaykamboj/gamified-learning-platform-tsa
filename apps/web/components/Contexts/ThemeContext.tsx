'use client'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// Single owner of the Light / Dark / System appearance preference.
//
// public/theme-init.js applies the resolved theme before first paint using the
// same storage key and class contract; this provider takes over after
// hydration, persists explicit choices and follows OS changes while "system"
// is selected. Theme changes only toggle a class on <html>, so nothing
// remounts and no form or chat state is lost.

export type AppearancePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'starlab-appearance'

interface ThemeContextValue {
  preference: AppearancePreference
  resolvedTheme: ResolvedTheme
  setPreference: (preference: AppearancePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredPreference(): AppearancePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    /* storage unavailable */
  }
  return 'system'
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initial values match what theme-init.js already painted, read lazily on
  // the client. The server renders with 'system'/'light'; the <html> class is
  // owned by the pre-paint script, so there is no visual mismatch.
  const [preference, setPreferenceState] = useState<AppearancePreference>('system')
  const [systemDark, setSystemDark] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setPreferenceState(readStoredPreference())
    setSystemDark(systemPrefersDark())
    setHydrated(true)

    let media: MediaQueryList | null = null
    try {
      media = window.matchMedia('(prefers-color-scheme: dark)')
    } catch {
      return
    }
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media?.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme: ResolvedTheme =
    preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(() => {
    // Until the stored preference is read, theme-init.js owns <html>.
    if (hydrated) applyTheme(resolvedTheme)
  }, [hydrated, resolvedTheme])

  const setPreference = useCallback((next: AppearancePreference) => {
    setPreferenceState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage unavailable: the choice still applies for this visit */
    }
  }, [])

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return { preference: 'system', resolvedTheme: 'light', setPreference: () => {} }
  }
  return ctx
}
