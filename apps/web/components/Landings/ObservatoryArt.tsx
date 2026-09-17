/**
 * ObservatoryArt — the landing hero's bounded artwork region.
 *
 * A static poster composition (softly lit blue planet, amber rim light,
 * restrained violet nebula, sparse stars, one orbital arc). It deliberately
 * stays the dark Deep Orbit grade in both themes: it is a framed illustration
 * with its own text layer, not an application surface.
 *
 * The region reserves a fixed aspect ratio so a future looping video
 * (orbital-hero-*.webm/mp4, see STARLAB-REDESIGN-PROMPT.md §8) can replace the
 * poster layer without restructuring the page. No motion ships today, so no
 * pause control is needed yet.
 *
 * The overlay card is a visibly labelled preview, not learner data.
 */
export default function ObservatoryArt() {
  return (
    <figure className="relative mx-auto w-full max-w-[640px] lg:max-w-none">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border shadow-overlay">
        {/* Poster layer */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(70% 55% at 18% 22%, rgba(139,99,217,0.38) 0%, rgba(139,99,217,0) 70%), radial-gradient(50% 40% at 92% 8%, rgba(77,212,188,0.16) 0%, rgba(77,212,188,0) 70%), linear-gradient(165deg, #0b1424 0%, #111d30 50%, #1b2140 100%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-80"
          style={{
            backgroundImage: `radial-gradient(1px 1px at 8% 14%, rgba(243,246,252,0.9), transparent 60%),
              radial-gradient(1px 1px at 26% 40%, rgba(243,246,252,0.55), transparent 60%),
              radial-gradient(1.5px 1.5px at 44% 12%, rgba(154,185,255,0.85), transparent 60%),
              radial-gradient(1px 1px at 58% 30%, rgba(243,246,252,0.6), transparent 60%),
              radial-gradient(1px 1px at 78% 18%, rgba(243,246,252,0.8), transparent 60%),
              radial-gradient(1.5px 1.5px at 90% 36%, rgba(114,227,206,0.7), transparent 60%),
              radial-gradient(1px 1px at 14% 70%, rgba(243,246,252,0.5), transparent 60%),
              radial-gradient(1px 1px at 36% 86%, rgba(243,246,252,0.45), transparent 60%)`,
          }}
        />
        {/* Orbital arc */}
        <div
          aria-hidden
          className="absolute -end-[22%] top-[14%] aspect-square w-[118%] rounded-full border border-[rgba(154,185,255,0.22)]"
          style={{ transform: 'rotateX(64deg) rotateZ(-14deg)' }}
        />
        {/* Planet with amber rim light */}
        <div
          aria-hidden
          className="absolute -bottom-[34%] -end-[14%] aspect-square w-[78%] rounded-full"
          style={{
            background:
              'radial-gradient(circle at 32% 28%, #507cd8 0%, #315ca8 22%, #17263d 58%, #0b1424 82%)',
            boxShadow:
              'inset 22px 18px 50px rgba(244,189,100,0.34), inset -40px -30px 80px rgba(3,8,18,0.6), 0 0 90px rgba(80,124,216,0.28)',
          }}
        />
        {/* Moon */}
        <div
          aria-hidden
          className="absolute end-[46%] top-[20%] aspect-square w-[9%] rounded-full"
          style={{
            background: 'radial-gradient(circle at 35% 30%, #ffd78c 0%, #b77716 60%, #5e3b06 100%)',
            boxShadow: '0 0 30px rgba(244,189,100,0.35)',
          }}
        />

        {/* Preview card */}
        <div className="absolute bottom-5 start-5 w-[min(78%,300px)] rounded-2xl border border-white/10 bg-[#111d30]/92 p-4 text-[#f3f6fc] shadow-[0_20px_60px_rgba(0,0,0,0.4)] md:bottom-8 md:start-8 md:p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-telemetry font-medium uppercase tracking-[0.06em] text-[#95a8c4]">
              Course route
            </span>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[12px] font-semibold text-[#b7c5da]">
              Preview
            </span>
          </div>
          <ol className="mt-4 space-y-3">
            {[
              { label: 'Foundations', state: 'Completed', color: '#f4bd64' },
              { label: 'Practice set', state: 'In progress', color: '#4dd4bc' },
              { label: 'Unit test', state: 'Up next', color: '#8c9fbc' },
            ].map((step) => (
              <li key={step.label} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: step.color, boxShadow: `0 0 0 4px ${step.color}22` }}
                />
                <span className="flex-1 text-sm font-semibold">{step.label}</span>
                <span className="text-meta text-[#95a8c4]">{step.state}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <figcaption className="sr-only">
        Illustration of a softly lit planet in an observatory sky, with a preview of a course route.
      </figcaption>
    </figure>
  )
}
