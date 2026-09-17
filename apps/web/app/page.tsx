import Link from 'next/link'
import { ArrowRight, BookOpen, Compass, Orbit, Sparkles, Target, TrendingUp } from 'lucide-react'
import { StarLabLogo } from '@components/Objects/Menus/StarLabLogo'
import AppearanceToggle from '@components/Objects/Menus/AppearanceToggle'
import ObservatoryArt from '@components/Landings/ObservatoryArt'

const BENEFITS = [
  {
    icon: BookOpen,
    title: 'Courses that feel like destinations',
    body: 'Every course is a place you travel to, with a clear route of chapters and lessons to follow.',
  },
  {
    icon: Target,
    title: 'Practice that checks your understanding',
    body: 'Practice sets and unit tests sit right beside the lesson, so you can apply an idea while it is fresh.',
  },
  {
    icon: TrendingUp,
    title: 'Progress you can actually see',
    body: 'Pick up exactly where you left off and watch completed lessons trace your path forward.',
  },
]

const STEPS = [
  { icon: Compass, label: 'Choose a destination', body: 'Browse the courses your learning space offers and pick where to begin.' },
  { icon: Orbit, label: 'Follow the orbit', body: 'Move through chapters in order. Each lesson brings you closer to the goal.' },
  { icon: Sparkles, label: 'Earn the milestone', body: 'Complete the course, then choose your next frontier.' },
]

export default function PublicLandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <nav className="mx-auto flex h-14 w-full max-w-[1280px] items-center justify-between gap-4 px-4 md:h-16 md:px-8">
          <Link href="/" className="flex items-center text-foreground" aria-label="StarLab home">
            <StarLabLogo className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            <AppearanceToggle className="hidden sm:inline-flex" />
            <Link href="/login" className="sl-btn sl-btn-ghost min-h-10 px-3 md:px-4">
              Log in
            </Link>
            <Link href="/signup" className="sl-btn sl-btn-primary min-h-10 px-4">
              Sign up
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero — copy 45%, art 55% */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 sl-atmosphere opacity-80" />
          <div className="relative mx-auto grid w-full max-w-[1280px] items-center gap-10 px-4 pb-16 pt-12 md:px-8 md:pb-24 md:pt-16 lg:grid-cols-[45fr_55fr] lg:gap-12 lg:pt-20">
            <div className="max-w-xl">
              <p className="sl-telemetry text-link">Your learning observatory</p>
              <h1 className="mt-4 font-display text-[2.5rem] font-semibold leading-[2.75rem] tracking-[-0.03em] text-foreground md:text-[3.25rem] md:leading-[3.5rem] xl:text-hero">
                Find your next learning frontier.
              </h1>
              <p className="mt-6 max-w-[34rem] text-reading text-muted-foreground">
                StarLab brings courses, practice, and progress into one calm place to learn, so you always know where
                you are and where to go next.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/signup" className="sl-btn sl-btn-primary min-h-12 px-6 text-[15px]">
                  Start learning
                  <ArrowRight size={18} aria-hidden />
                </Link>
                <Link href="/login" className="sl-btn sl-btn-secondary min-h-12 px-6 text-[15px]">
                  Log in to your space
                </Link>
              </div>
            </div>

            <ObservatoryArt />
          </div>
        </section>

        {/* Benefits */}
        <section className="border-t border-border bg-card">
          <div className="mx-auto w-full max-w-[1280px] px-4 py-16 md:px-8 md:py-20">
            <div className="max-w-2xl">
              <p className="sl-telemetry text-discovery">What you get</p>
              <h2 className="mt-3 sl-section-title">Everything you need to keep learning, in one place.</h2>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {BENEFITS.map(({ icon: Icon, title, body }) => (
                <article key={title} className="sl-card p-6">
                  <span className="grid size-11 place-items-center rounded-[10px] bg-selected text-link">
                    <Icon size={22} strokeWidth={1.8} aria-hidden />
                  </span>
                  <h3 className="mt-5 text-card-title font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-ui text-muted-foreground">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-border">
          <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-4 py-16 md:px-8 md:py-20 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <div>
              <p className="sl-telemetry text-reward">How it works</p>
              <h2 className="mt-3 sl-section-title">How a course becomes a destination.</h2>
              <p className="mt-4 max-w-md text-ui text-muted-foreground">
                Your learning space arranges its courses as a map. Choose one, follow its route, and mark the milestone
                when you arrive.
              </p>
            </div>
            <ol className="relative grid gap-4">
              {STEPS.map(({ icon: Icon, label, body }, index) => (
                <li key={label} className="sl-card flex items-start gap-4 p-5 md:p-6">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-muted text-foreground">
                    <Icon size={20} strokeWidth={1.8} aria-hidden />
                  </span>
                  <div>
                    <p className="font-mono text-telemetry font-medium tabular-nums text-muted-foreground">
                      Step {String(index + 1).padStart(2, '0')}
                    </p>
                    <h3 className="mt-1 text-card-title font-semibold text-foreground">{label}</h3>
                    <p className="mt-1 text-ui text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Next action */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-[1280px] px-4 py-16 md:px-8 md:py-20">
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-card md:p-12">
              <div aria-hidden className="pointer-events-none absolute inset-0 sl-atmosphere opacity-60" />
              <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <h2 className="sl-section-title">Ready to choose a destination?</h2>
                  <p className="mt-2 text-ui text-muted-foreground">Create an account or log in to your learning space.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/signup" className="sl-btn sl-btn-primary">
                    Start learning
                  </Link>
                  <Link href="/login" className="sl-btn sl-btn-secondary">
                    Log in
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col items-start justify-between gap-4 px-4 py-8 md:flex-row md:items-center md:px-8">
          <StarLabLogo className="h-7 w-auto text-muted-foreground" />
          <div className="flex items-center gap-4">
            <AppearanceToggle className="sm:hidden" />
            <p className="text-meta text-muted-foreground">© {new Date().getFullYear()} StarLab</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
