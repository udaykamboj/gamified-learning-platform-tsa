"use client";

import Link from "next/link";
import { ArrowLeft, Brain, CheckCircle2, Circle, CircleDot, Compass, FileText, FlaskConical, Info, ListOrdered, Orbit, Rocket, Scale } from "lucide-react";
import RadialOrbitalTimeline, {
  type TimelineItem,
} from "@/components/ui/radial-orbital-timeline";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const journeyData: TimelineItem[] = [
  {
    id: 1,
    title: "AI Foundations",
    date: "Sector 01",
    content:
      "What AI is, how machine learning works, and where it shows up in daily life — from recommendations to voice assistants.",
    category: "Foundations",
    icon: Compass,
    relatedIds: [2],
    status: "completed",
    energy: 100,
  },
  {
    id: 2,
    title: "How Models Learn",
    date: "Sector 02",
    content:
      "Training data, neural networks, and pattern recognition — understand why more good data makes smarter models.",
    category: "Foundations",
    icon: Brain,
    relatedIds: [1, 3],
    status: "completed",
    energy: 90,
  },
  {
    id: 3,
    title: "Prompt Engineering",
    date: "Sector 03",
    content:
      "Techniques for getting useful results from AI tools: clear instructions, context, examples, and iteration.",
    category: "Practical",
    icon: FileText,
    relatedIds: [2, 4],
    status: "in-progress",
    energy: 60,
  },
  {
    id: 4,
    title: "AI Lab Experiments",
    date: "Sector 04",
    content:
      "Hands-on missions in the playground: classify images, generate text, and test the limits of real AI models.",
    category: "Practical",
    icon: FlaskConical,
    relatedIds: [3, 5],
    status: "pending",
    energy: 30,
  },
  {
    id: 5,
    title: "Ethics & Bias",
    date: "Sector 05",
    content:
      "Fairness, bias, misinformation, and responsible use — learn to question and verify what AI produces.",
    category: "Ethics",
    icon: Scale,
    relatedIds: [4, 6],
    status: "pending",
    energy: 10,
  },
  {
    id: 6,
    title: "Capstone Launch",
    date: "Sector 06",
    content:
      "Build your own AI-assisted project and present it to the community to graduate from the academy.",
    category: "Capstone",
    icon: Rocket,
    relatedIds: [5],
    status: "pending",
    energy: 5,
  },
];

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const sync = () => setMatches(m.matches);
    sync();
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

const STATUS = {
  completed: { label: "Completed", Icon: CheckCircle2, badge: "bg-success-surface text-success", node: "border-primary bg-primary text-primary-foreground" },
  "in-progress": { label: "In progress", Icon: CircleDot, badge: "bg-info-surface text-info", node: "border-info bg-info-surface text-info" },
  pending: { label: "Up next", Icon: Circle, badge: "bg-muted text-muted-foreground", node: "border-border bg-card text-muted-foreground" },
} as const;

function MilestoneList({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative">
      {items.map((item, index) => {
        const status = STATUS[item.status];
        const Icon = item.icon;
        const isLast = index === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && <span aria-hidden className="absolute start-[21px] top-12 bottom-0 w-px bg-border" />}
            <span className={cn("relative z-10 grid size-11 shrink-0 place-items-center rounded-full border-2", status.node)}>
              <Icon className="size-5" />
            </span>
            <div className={cn("sl-card flex-1 p-5", item.status === "in-progress" && "border-info/50")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-telemetry font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  {item.date}
                </span>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-meta font-semibold", status.badge)}>
                  <status.Icon className="size-3.5" aria-hidden /> {status.label}
                </span>
                <span className="text-meta text-muted-foreground">{item.category}</span>
              </div>
              <h3 className="mt-2 text-card-title font-semibold text-foreground">{item.title}</h3>
              <p className="mt-1 text-ui text-muted-foreground">{item.content}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function JourneyPage() {
  const wide = useMediaQuery("(min-width: 1024px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [view, setView] = useState<"path" | "orbit">("path");
  // The orbital view moves; mobile and reduced-motion always get the path.
  const canOrbit = wide && !reducedMotion;
  const activeView = canOrbit ? view : "path";
  const current = journeyData.find((item) => item.status === "in-progress");

  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-8 md:px-6 md:pt-10 xl:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden /> Learning universe
        </Link>

        {/* Header anchored by a bounded black-hole illustration */}
        <header className="relative mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div aria-hidden className="pointer-events-none absolute inset-0 sl-atmosphere opacity-70" />
          <div
            aria-hidden
            className="pointer-events-none absolute -end-16 top-1/2 hidden size-72 -translate-y-1/2 rounded-full md:block"
            style={{
              background:
                "radial-gradient(circle, #03060c 0%, #03060c 28%, rgba(244,189,100,0.55) 31%, rgba(139,99,217,0.35) 42%, rgba(80,124,216,0.12) 58%, transparent 70%)",
            }}
          />
          <div className="relative p-6 md:p-10">
            <p className="sl-telemetry text-link">Curriculum path</p>
            <h1 className="mt-2 sl-page-title">Learning journey</h1>
            <p className="mt-2 max-w-xl text-reading text-muted-foreground">
              The ordered milestones of the curriculum, from first concepts to your capstone.
            </p>
            {current && (
              <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground">
                <CircleDot size={16} className="text-info" aria-hidden /> Current step: {current.title}
              </p>
            )}
          </div>
        </header>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="flex items-start gap-2 text-meta text-muted-foreground">
            <Info size={14} className="mt-[3px] shrink-0" aria-hidden />
            Illustrative sample path. Completion shown here is not your personal progress.
          </p>
          {canOrbit && (
            <div role="tablist" aria-label="Journey view" className="inline-flex rounded-[10px] border border-border bg-muted p-1">
              {([
                { key: "path", label: "Path", Icon: ListOrdered },
                { key: "orbit", label: "Orbit", Icon: Orbit },
              ] as const).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activeView === key}
                  onClick={() => setView(key)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-[6px] px-3 text-sm font-semibold transition-colors",
                    activeView === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon size={16} aria-hidden /> {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <section aria-label="Milestones" className="mt-6">
          {activeView === "orbit" ? (
            <div className="sl-card overflow-hidden">
              <RadialOrbitalTimeline timelineData={journeyData} />
              <p className="border-t border-border px-5 py-3 text-center text-meta text-muted-foreground">
                Select a milestone to see its details. Select empty space to resume the orbit.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl">
              <MilestoneList items={journeyData} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

