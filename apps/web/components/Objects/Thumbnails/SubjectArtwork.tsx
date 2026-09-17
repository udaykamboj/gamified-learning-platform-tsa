import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Deterministic subject artwork used when content has no thumbnail.
 *
 * A softly lit planet on the Deep Orbit sky. The palette is picked from a
 * stable hash of `seed` (a course/podcast uuid), so the same item always gets
 * the same planet — never random color per render. It stays the dark
 * illustration grade in both themes: it is artwork, not a UI surface.
 */
const PALETTES = [
  { core: '#f4bd64', mid: '#b77716', ring: 'rgba(255,215,140,0.45)' }, // amber — foundations
  { core: '#4dd4bc', mid: '#087f72', ring: 'rgba(114,227,206,0.45)' }, // teal — healthcare
  { core: '#7599ec', mid: '#315ca8', ring: 'rgba(154,185,255,0.45)' }, // blue — business
  { core: '#ff9aaf', mid: '#a82947', ring: 'rgba(255,186,200,0.45)' }, // coral — model building
  { core: '#b8a0ff', mid: '#6941b8', ring: 'rgba(212,193,255,0.45)' }, // violet — arena
]

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export default function SubjectArtwork({ seed, className }: { seed: string; className?: string }) {
  const h = hash(seed || 'starlab')
  const palette = PALETTES[h % PALETTES.length]
  // Small deterministic variation in composition.
  const x = 58 + (h >> 3) % 18
  const y = 48 + (h >> 7) % 14
  const tilt = -24 + ((h >> 11) % 20)

  return (
    <div
      aria-hidden
      className={cn('relative h-full w-full overflow-hidden', className)}
      style={{
        background:
          'radial-gradient(60% 70% at 15% 20%, rgba(139,99,217,0.28) 0%, rgba(139,99,217,0) 70%), linear-gradient(160deg, #0b1424 0%, #111d30 60%, #17263d 100%)',
      }}
    >
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: `radial-gradient(1px 1px at 12% 22%, rgba(243,246,252,0.8), transparent 60%),
            radial-gradient(1px 1px at 34% 70%, rgba(243,246,252,0.5), transparent 60%),
            radial-gradient(1px 1px at 86% 16%, rgba(243,246,252,0.7), transparent 60%),
            radial-gradient(1px 1px at 22% 88%, rgba(243,246,252,0.45), transparent 60%)`,
        }}
      />
      <div
        className="absolute aspect-square rounded-full"
        style={{
          width: '42%',
          left: `${x}%`,
          top: `${y}%`,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle at 32% 28%, ${palette.core} 0%, ${palette.mid} 55%, #0b1424 100%)`,
          boxShadow: `inset -14px -12px 30px rgba(3,8,18,0.55), 0 0 40px ${palette.ring}`,
        }}
      />
      <div
        className="absolute border"
        style={{
          width: '68%',
          height: '16%',
          borderRadius: '50%',
          left: `${x}%`,
          top: `${y}%`,
          transform: `translate(-50%, -50%) rotate(${tilt}deg)`,
          borderColor: palette.ring,
        }}
      />
    </div>
  )
}
