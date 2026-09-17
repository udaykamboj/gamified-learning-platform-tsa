'use client'
import React from 'react'
import LanguageSwitcher from '@components/Utils/LanguageSwitcher'
import AuthBrandingPanel from '@components/Auth/AuthBrandingPanel'
import AuthMobileHeader from '@components/Auth/AuthMobileHeader'
import { AuthFooter } from '@components/Footers/LegalFooters'

interface AuthLayoutProps {
  org: any
  welcomeText?: string
  // No-org (apex) branding copy — platform-style title + subtitle.
  title?: string
  subtitle?: string
  children: React.ReactNode
}

export default function AuthLayout({ org, welcomeText, title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen lg:h-screen bg-background flex flex-col lg:flex-row relative overflow-hidden">
      {/* Soft atmospheric light, bottom-anchored */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none z-0 sl-atmosphere opacity-70"
        style={{
          maskImage: 'linear-gradient(to top, black 0%, transparent 55%)',
          WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 55%)',
        }}
      />

      {/* Language switcher — must sit ABOVE the right-hand branding panel
          (z-10), otherwise the panel intercepts its clicks. `z-dropdown`
          resolves to z-index:auto here, so use a concrete z-50. */}
      <div className="absolute top-4 end-4 z-50">
        <LanguageSwitcher />
      </div>

      {/* Mobile Header - visible only on small screens */}
      <div className="lg:hidden relative z-10">
        <AuthMobileHeader org={org} />
      </div>

      {/* Left Panel - Content / form */}
      <div className="relative z-10 flex flex-col flex-1 lg:h-full overflow-auto bg-transparent">
        <div className="flex-1 flex flex-col">{children}</div>
        {/* Terms footer (platform-style) */}
        <AuthFooter className="shrink-0" />
      </div>

      {/* Right Panel - Branding (hidden on mobile) */}
      <div className="hidden lg:block w-[48%] relative z-10 shrink-0">
        <AuthBrandingPanel
          org={org}
          welcomeText={welcomeText}
          title={title}
          subtitle={subtitle}
        />
      </div>
    </div>
  )
}
