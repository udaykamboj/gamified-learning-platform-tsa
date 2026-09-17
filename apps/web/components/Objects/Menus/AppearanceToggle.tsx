'use client'
import React from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useTheme, type AppearancePreference } from '@components/Contexts/ThemeContext'

const OPTIONS: { value: AppearancePreference; icon: typeof Sun; labelKey: string; fallback: string }[] = [
  { value: 'light', icon: Sun, labelKey: 'common.appearance_light', fallback: 'Light' },
  { value: 'dark', icon: Moon, labelKey: 'common.appearance_dark', fallback: 'Dark' },
  { value: 'system', icon: Monitor, labelKey: 'common.appearance_system', fallback: 'System' },
]

/**
 * Appearance control — Light / Dark / System as a keyboard-operable radio
 * group. `showLabels` renders text beside each icon (settings pages); the
 * compact form is icon-only with accessible names (headers and menus).
 */
export default function AppearanceToggle({
  showLabels = false,
  className,
}: {
  showLabels?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const { preference, setPreference } = useTheme()

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const index = OPTIONS.findIndex((o) => o.value === preference)
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const next = OPTIONS[(index + (forward ? 1 : OPTIONS.length - 1)) % OPTIONS.length]
    setPreference(next.value)
    const target = event.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)
    target?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('common.appearance', { defaultValue: 'Appearance' })}
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[10px] border border-border bg-muted p-0.5',
        className
      )}
    >
      {OPTIONS.map(({ value, icon: Icon, labelKey, fallback }) => {
        const selected = preference === value
        const label = t(labelKey, { defaultValue: fallback })
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={showLabels ? undefined : label}
            title={showLabels ? undefined : label}
            data-value={value}
            tabIndex={selected ? 0 : -1}
            onClick={() => setPreference(value)}
            className={cn(
              'inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] text-meta font-semibold transition-colors',
              showLabels ? 'px-3' : 'w-8',
              selected
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            <Icon size={16} strokeWidth={1.9} aria-hidden />
            {showLabels && <span>{label}</span>}
          </button>
        )
      })}
    </div>
  )
}
