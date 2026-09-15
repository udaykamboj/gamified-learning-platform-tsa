import Link from 'next/link'

export default function PublicLandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f1ea] text-[#18231f]">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="StarLab home">
          <img src="/starlab-black.svg" alt="StarLab" className="h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-[#183f35] transition hover:bg-white/70">Log in</Link>
          <Link href="/signup" className="rounded-full bg-[#e8794f] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(232,121,79,0.22)] transition hover:-translate-y-0.5 hover:bg-[#d96840]">Sign up</Link>
        </div>
      </nav>

      <section className="relative mx-auto grid min-h-[calc(100vh-96px)] w-full max-w-7xl items-center gap-14 px-6 pb-16 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pb-24">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-6 text-xs font-bold uppercase tracking-[0.22em] text-[#e8794f]">A calmer way to learn together</p>
          <h1 className="max-w-xl text-6xl font-semibold leading-[0.96] tracking-[-0.07em] sm:text-7xl lg:text-[6.5rem]">Make space for meaningful progress.</h1>
          <p className="mt-8 max-w-lg text-lg leading-8 text-[#51615a]">StarLab brings courses, practice, and shared momentum into one focused learning home. This is the beginning of something useful.</p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/signup" className="rounded-full bg-[#183f35] px-6 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#245d4d]">Start learning</Link>
            <Link href="/login" className="rounded-full border border-[#b8c1b9] px-6 py-3.5 text-sm font-semibold text-[#183f35] transition hover:border-[#183f35] hover:bg-white/50">Log in to your space</Link>
          </div>
        </div>

        <div className="relative min-h-[420px] lg:min-h-[560px]" aria-hidden="true">
          <div className="absolute end-0 top-8 h-[72%] w-[78%] rotate-[-7deg] rounded-[2rem] bg-[#d5e1d5] shadow-[0_30px_80px_rgba(24,63,53,0.12)]" />
          <div className="absolute bottom-5 start-0 h-[72%] w-[82%] rotate-[5deg] rounded-[2rem] bg-[#183f35] p-8 text-[#f4f1ea] shadow-[0_30px_80px_rgba(24,63,53,0.2)] sm:p-12">
            <div className="flex items-center justify-between border-b border-white/20 pb-5 text-xs uppercase tracking-[0.18em] text-white/60"><span>Your learning rhythm</span><span>01 / 04</span></div>
            <div className="mt-20 max-w-xs"><div className="mb-5 h-2 w-16 rounded-full bg-[#e8794f]" /><p className="text-4xl font-medium leading-tight tracking-[-0.05em]">Small steps. Real momentum.</p></div>
            <div className="absolute bottom-8 start-8 end-8 flex items-end justify-between sm:bottom-12 sm:start-12 sm:end-12"><span className="text-sm text-white/60">Courses · Practice · Progress</span><span className="grid size-12 place-items-center rounded-full bg-[#e8794f] text-xl text-white">↗</span></div>
          </div>
        </div>
      </section>
    </main>
  )
}