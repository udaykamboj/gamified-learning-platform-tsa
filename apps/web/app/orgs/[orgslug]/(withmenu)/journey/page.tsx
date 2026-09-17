"use client";

import Link from "next/link";
import { ArrowLeft, Brain, Compass, FileText, FlaskConical, Rocket, Scale } from "lucide-react";
import RadialOrbitalTimeline, {
  type TimelineItem,
} from "@/components/ui/radial-orbital-timeline";
import { Button } from "@/components/ui/button";
import BlackHoleHeroSection from "@/components/ui/blackhole-hero-section";
import { useState, useEffect } from "react";

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

function useNarrow(query = "(max-width: 767px)") {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const sync = () => setNarrow(m.matches);
    sync();
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, [query]);
  return narrow;
}

export default function JourneyPage() {
  const narrow = useNarrow();

  return (
    <main className="relative flex min-h-svh flex-col text-foreground">
      <BlackHoleHeroSection
        focus={narrow ? [0.5, 0.76] : [0.72, 0.46]}
        scrim={narrow ? "top" : "left"}
        scrimStrength={0.9}
        distance={24}
        elevation={narrow ? -7 : -5.5}
        fov={narrow ? 58 : 42}
        glow={narrow ? 0.85 : 1}
        steps={narrow ? 200 : 300}
        resolution={narrow ? 0.6 : 0.7}
      >
        <div className="flex h-full min-h-svh flex-col text-white">
          <header className="flex h-16 items-center justify-between border-b border-white/10 px-4 md:px-8 shrink-0">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild aria-label="Back to learning universe" className="text-white hover:bg-white/10 hover:text-white">
                <Link href="/dashboard">
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <div>
                <h1 className="font-display text-lg font-semibold leading-none">Learning Journey</h1>
                <p className="mt-1 font-mono text-[11px] uppercase text-white/60">
                  Your path through the curriculum
                </p>
              </div>
            </div>
          </header>

          <div className="flex flex-1 items-center px-4 md:px-8">
            <section className="flex flex-col items-center justify-center w-full md:w-1/2 pt-10 pb-8">
              <RadialOrbitalTimeline timelineData={journeyData} />
              <p className="text-center text-xs text-white/60 mt-8">
                Select a node to inspect the mission. Select empty space to resume the orbit.
              </p>
            </section>
          </div>
        </div>
      </BlackHoleHeroSection>
    </main>
  );
}

