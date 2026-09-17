import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Home } from 'lucide-react'
import { StarLabLogo } from '@components/Objects/Menus/StarLabLogo'

export const metadata: Metadata = {
  title: 'Page not found',
}

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 sl-atmosphere opacity-60" />

      <header className="relative mx-auto flex h-16 w-full max-w-[1280px] items-center px-4 md:px-8">
        <Link href="/" aria-label="StarLab home" className="text-foreground">
          <StarLabLogo className="h-8 w-auto" />
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-12">
        <div className="sl-card w-full max-w-lg overflow-hidden text-center">
          {/* Lost-signal illustration */}
          <div
            aria-hidden
            className="relative h-40 overflow-hidden"
            style={{
              background:
                'radial-gradient(60% 80% at 20% 10%, rgba(139,99,217,0.35) 0%, rgba(139,99,217,0) 70%), linear-gradient(160deg, #0b1424 0%, #111d30 60%, #17263d 100%)',
            }}
          >
            <div
              className="absolute left-1/2 top-[62%] size-28 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: 'radial-gradient(circle at 32% 28%, #8c9fbc 0%, #315ca8 50%, #0b1424 100%)',
                boxShadow: 'inset -12px -10px 26px rgba(3,8,18,0.55), 0 0 40px rgba(80,124,216,0.3)',
              }}
            />
            <div
              className="absolute left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-dashed"
              style={{ width: 220, height: 56, borderColor: 'rgba(154,185,255,0.45)', transform: 'translate(-50%, -50%) rotate(-12deg)' }}
            />
          </div>

          <div className="p-6 md:p-8">
            <p className="sl-telemetry text-muted-foreground">Error 404 · Signal lost</p>
            <h1 className="mt-2 sl-page-title">We couldn&apos;t find that page</h1>
            <p className="mx-auto mt-3 max-w-sm text-ui text-muted-foreground">
              The link may be broken, or the page may have been moved or deleted.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/dashboard" className="sl-btn sl-btn-primary">
                <Home size={18} aria-hidden />
                Go to your dashboard
              </Link>
              <Link href="/" className="sl-btn sl-btn-secondary">
                <ArrowLeft size={18} aria-hidden />
                StarLab home
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
