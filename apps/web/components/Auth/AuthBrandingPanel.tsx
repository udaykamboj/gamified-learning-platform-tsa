'use client'
import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import starlabIcon from 'public/starlab_bigicon_1.png'
import { getOrgLogoMediaDirectory, getOrgAuthBackgroundMediaDirectory } from '@services/media/media'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'
import { StarLabLogo } from '@components/Objects/Menus/StarLabLogo'
import { usePlan } from '@components/Hooks/usePlan'

interface AuthBrandingPanelProps {
  org: any
  welcomeText?: string
  // No-org (apex) panel copy — platform-style title + subtitle shown at the top
  // of the illustration. Falls back to the login wording when omitted.
  title?: string
  subtitle?: string
}

// Decorative observatory backdrop for the default (no custom image) panel.
// Intentionally the dark Deep Orbit art in both themes: it is a bounded
// illustration with its own text layer, not an application surface.
const ORBITAL_OBSERVATORY =
  'radial-gradient(120% 80% at 85% 110%, rgba(139,99,217,0.45) 0%, rgba(139,99,217,0) 55%), radial-gradient(90% 60% at 10% -10%, rgba(77,212,188,0.18) 0%, rgba(77,212,188,0) 60%), linear-gradient(160deg, #0b1424 0%, #172844 55%, #252045 100%)'

export default function AuthBrandingPanel({ org, welcomeText, title, subtitle }: AuthBrandingPanelProps) {
  const authBranding = org?.config?.config?.customization?.auth_branding || org?.config?.config?.general?.auth_branding || {}
  const {
    welcome_message = '',
    background_type = 'gradient',
    background_image = '',
    text_color = 'light',
    unsplash_photographer_name = '',
    unsplash_photographer_url = '',
    unsplash_photo_url = '',
  } = authBranding
  const UNSPLASH_UTM = '?utm_source=StarLab&utm_medium=referral'
  const withUtm = (url: string) => (url ? `${url}${UNSPLASH_UTM}` : '')

  // Check if org has enterprise plan - hide StarLab branding for enterprise users
  // In OSS mode, always show branding regardless of plan
  const plan = usePlan()
  const isEnterprise = plan === 'enterprise'

  // No org context (the generic apex login) → use the platform's auth
  // illustration instead of the flat gradient.
  const noOrg = !org

  const getBackgroundStyle = (): React.CSSProperties => {
    if (noOrg) {
      return {
        backgroundImage: 'url(/auth-default.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }
    if (background_type === 'gradient' || !background_image) {
      // Orbital observatory: deep navy atmosphere with a violet horizon
      return {
        background: ORBITAL_OBSERVATORY,
      }
    }
    if (background_type === 'custom' && background_image) {
      return {
        backgroundImage: `url(${getOrgAuthBackgroundMediaDirectory(org?.org_uuid, background_image)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }
    if (background_type === 'unsplash' && background_image) {
      return {
        backgroundImage: `url(${background_image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }
    return {
      background: ORBITAL_OBSERVATORY,
    }
  }

  const displayMessage = welcome_message || welcomeText || ''
  // No-org platform copy (defaults mirror the platform login illustration).
  const noOrgTitle = title || 'Welcome back to StarLab.'
  const noOrgSubtitle =
    subtitle || 'Pick up where you left off — your courses, students, and tools are waiting.'
  // Treat the no-org illustration like a photo background: dark scrim, no
  // blueprint-grid overlay.
  const hasCustomBackground = noOrg || (background_type !== 'gradient' && background_image)

  return (
    <div className="relative h-full w-full">
      {/* Inset rounded card (platform-style) */}
      <div className="absolute inset-8 xl:inset-12 rounded-3xl overflow-hidden border border-border shadow-overlay">
        {/* Base layer: org's chosen background (gradient | custom | unsplash) */}
        <div className="absolute inset-0" style={getBackgroundStyle()} />

        {/* Blueprint + dot overlays — ONLY for gradient fallback (no photo) */}
        {!hasCustomBackground && (
          <>
            {/* Sparse starfield */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-70"
              style={{
                backgroundImage: `radial-gradient(1px 1px at 12% 18%, rgba(243,246,252,0.9), transparent 60%),
                  radial-gradient(1px 1px at 72% 12%, rgba(243,246,252,0.7), transparent 60%),
                  radial-gradient(1.5px 1.5px at 38% 34%, rgba(154,185,255,0.8), transparent 60%),
                  radial-gradient(1px 1px at 88% 44%, rgba(243,246,252,0.6), transparent 60%),
                  radial-gradient(1px 1px at 22% 62%, rgba(243,246,252,0.5), transparent 60%),
                  radial-gradient(1.5px 1.5px at 60% 78%, rgba(114,227,206,0.7), transparent 60%),
                  radial-gradient(1px 1px at 8% 88%, rgba(243,246,252,0.6), transparent 60%),
                  radial-gradient(1px 1px at 94% 86%, rgba(243,246,252,0.5), transparent 60%)`,
              }}
            />
            {/* Planet horizon with amber rim light and one orbital arc */}
            <div
              aria-hidden
              className="absolute -bottom-[55%] -end-[25%] w-[120%] aspect-square rounded-full"
              style={{
                background: 'radial-gradient(circle at 35% 30%, #315ca8 0%, #17263d 45%, #0b1424 75%)',
                boxShadow: 'inset 18px 18px 60px rgba(244,189,100,0.28), 0 0 80px rgba(80,124,216,0.25)',
              }}
            />
            <div
              aria-hidden
              className="absolute -bottom-[40%] -end-[40%] w-[150%] aspect-square rounded-full border border-[rgba(154,185,255,0.18)]"
            />
          </>
        )}

        {/* Dark scrim for org photo backgrounds (centered text needs it).
            The no-org illustration stays vivid — it's darkened only at the top. */}
        {hasCustomBackground && !noOrg && (
          <div className="absolute inset-0 bg-black/30" />
        )}

        {/* No-org: top blur + darken so the platform-style heading reads over
            the illustration (mirrors the platform login panel). */}
        {noOrg && (
          <>
            <div
              className="absolute top-0 start-0 end-0 h-[38%] z-[5] backdrop-blur-sm"
              style={{
                maskImage: 'linear-gradient(to bottom, black 10%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 10%, transparent 100%)',
              }}
            />
            <div
              className="absolute top-0 start-0 end-0 h-[38%] z-[5] bg-black/35"
              style={{
                maskImage: 'linear-gradient(to bottom, black 10%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 10%, transparent 100%)',
              }}
            />
          </>
        )}

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-10">
          {/* Top bar with StarLab starlab.png logo - hidden for enterprise users
              and for the no-org apex panel (platform shows no logo on the image). */}
          {!isEnterprise && !noOrg && (
            <div className="login-topbar">
              <Link prefetch href="https://starlab.app" target="_blank">
<StarLabLogo className={cn("h-7 w-auto transition-opacity hover:opacity-100", text_color === 'light' ? "text-white opacity-70" : "text-[#0b1424] opacity-60")} />
              </Link>
            </div>
          )}

          {noOrg ? (
            /* No-org apex panel — platform layout: heading at the TOP, no logo
               box, platform copy. */
            <div className="max-w-md text-white">
              <h1 className="font-display font-semibold text-[28px] leading-tight tracking-tight">
                {noOrgTitle}
              </h1>
              <p className="mt-3 text-white/55 text-base font-medium leading-relaxed">
                {noOrgSubtitle}
              </p>
            </div>
          ) : (
            /* Org panel — centered logo + name (unchanged). */
            <>
              <div className="flex-1 flex items-center justify-center">
                <div className={cn(
                  "flex flex-col items-center text-center gap-6",
                    "text-white"
                )}>
                  {/* Organization logo */}
                  <Link prefetch href={getUriWithOrg(org?.slug, '/')}>
                    <div className="w-24 h-24 rounded-2xl ring-1 ring-inset ring-white/15 bg-white flex items-center justify-center overflow-hidden shadow-overlay">
                      {org?.logo_image ? (
                        <img
                          src={getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)}
                          alt={org.name}
                          className="w-full h-full object-contain p-3"
                        />
                      ) : (
                        <Image
                          quality={100}
                          width={96}
                          height={96}
                          src={starlabIcon}
                          alt="StarLab"
                          className="object-contain"
                        />
                      )}
                    </div>
                  </Link>

                  {/* Text content */}
                  <div className="space-y-1">
                    <h1 className="font-display font-semibold text-3xl tracking-tight">{org?.name || 'StarLab'}</h1>
                    {displayMessage && (
                      <p className={cn(
                        "text-lg max-w-sm leading-relaxed",
                        "text-white/70"
                      )}>
                        {displayMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom spacer for visual balance */}
              <div className="h-10" />
            </>
          )}

          {/* Unsplash attribution (required by Unsplash API guidelines) */}
          {background_type === 'unsplash' && background_image && unsplash_photographer_name && (
            <div className={cn(
              "absolute bottom-3 start-4 end-4 z-10 text-[11px] leading-tight",
              "text-white/70"
            )}>
              Photo by{' '}
              <a
                href={withUtm(unsplash_photographer_url) || withUtm(unsplash_photo_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:opacity-100 opacity-90"
              >
                {unsplash_photographer_name}
              </a>
              {' '}on{' '}
              <a
                href={`https://unsplash.com/${UNSPLASH_UTM}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:opacity-100 opacity-90"
              >
                Unsplash
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
