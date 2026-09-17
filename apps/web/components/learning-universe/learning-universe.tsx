"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, Sparkles } from "@react-three/drei";
import Link from "next/link";
import { getUriWithOrg } from "@services/config/config";
import {
  ArrowRight,
  BookOpen,
  Info,
  LayoutGrid,
  Lock,
  Orbit,
  Pause,
  Play,
  Target,
} from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useLHSession } from "@components/Contexts/LHSessionContext";
import { cn } from "@/lib/utils";

/**
 * Learning Universe — learner home (template B, "Navigate" intensity).
 *
 * The destinations below are the conceptual subject identities from the
 * existing universe. They are NOT live learner records, so every place that
 * shows them is labelled as a preview and no XP, level or launch action is
 * implied. Real course navigation goes to the existing /courses catalog.
 */

type Destination = {
  id: string;
  name: string;
  discipline: string;
  summary: string;
  sampleProgress: number;
  color: string;
  position: [number, number, number];
  size: number;
  locked?: boolean;
  lockedReason?: string;
};

const DESTINATIONS: [Destination, ...Destination[]] = [
  {
    id: "foundations",
    name: "AI Foundations",
    discipline: "Core path",
    summary: "The shared starting point: how modern AI works, where it fails, and how to use it responsibly.",
    sampleProgress: 68,
    color: "#f4bd64",
    position: [0, 0.25, 0],
    size: 1.3,
  },
  {
    id: "healthcare",
    name: "AI for Healthcare",
    discipline: "Applied intelligence",
    summary: "Clinical data, diagnostic models and the questions to ask before trusting a prediction.",
    sampleProgress: 24,
    color: "#4dd4bc",
    position: [-4.6, 1.8, -1.2],
    size: 0.66,
  },
  {
    id: "business",
    name: "AI for Business",
    discipline: "Applied intelligence",
    summary: "Map real workflows, spot automation opportunities and measure their impact.",
    sampleProgress: 11,
    color: "#7599ec",
    position: [4.8, 1.55, -0.9],
    size: 0.75,
  },
  {
    id: "model",
    name: "Train Your Own Model",
    discipline: "Builder path",
    summary: "Collect data, train a small model and evaluate it honestly.",
    sampleProgress: 0,
    color: "#d95c79",
    position: [-3.8, -2.25, -0.3],
    size: 0.57,
    locked: true,
    lockedReason: "Opens after AI Foundations is complete.",
  },
  {
    id: "arena",
    name: "Prompt Arena",
    discipline: "Challenge sector",
    summary: "Put your prompting skills against timed challenges.",
    sampleProgress: 0,
    color: "#b8a0ff",
    position: [4.1, -2.15, -0.6],
    size: 0.61,
    locked: true,
    lockedReason: "Opens after an applied course is complete.",
  },
];

/* ─── Motion + capability hooks ──────────────────────────────────────────── */

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

function useWebGLAvailable() {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setAvailable(!!(canvas.getContext("webgl2") || canvas.getContext("webgl")));
    } catch {
      setAvailable(false);
    }
  }, []);
  return available;
}

/* ─── 3D scene ───────────────────────────────────────────────────────────── */

function Planet({
  destination,
  selected,
  animate,
  onSelect,
}: {
  destination: Destination;
  selected: boolean;
  animate: boolean;
  onSelect: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const planet = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }, rawDelta) => {
    if (!animate) return;
    const dt = Math.min(rawDelta, 0.05);
    // Roughly one turn every ~60–90 seconds.
    if (planet.current) planet.current.rotation.y += dt * 0.08;
    if (group.current) {
      group.current.position.y =
        destination.position[1] + Math.sin(clock.elapsedTime * 0.35 + destination.position[0]) * 0.04;
    }
  });

  const base = destination.locked ? "#34496a" : destination.color;
  const scale = selected ? 1.08 : hovered ? 1.04 : 1;

  return (
    <group ref={group} position={destination.position}>
      <mesh
        ref={planet}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPointerEnter={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerLeave={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
        scale={scale}
      >
        <sphereGeometry args={[destination.size, 64, 64]} />
        <meshStandardMaterial
          color={base}
          emissive={base}
          emissiveIntensity={selected ? 0.26 : 0.08}
          metalness={0.15}
          roughness={0.72}
        />
      </mesh>
      <mesh rotation-x={Math.PI / 2.5}>
        <torusGeometry args={[destination.size * 1.42, destination.size * 0.03, 16, 100]} />
        <meshBasicMaterial color={destination.locked ? "#657d9e" : destination.color} transparent opacity={selected ? 0.8 : 0.35} />
      </mesh>
      {selected && (
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[destination.size * 1.85, 0.014, 8, 120]} />
          <meshBasicMaterial color="#72e3ce" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

function OrbitalScene({
  selectedId,
  animate,
  onSelect,
}: {
  selectedId: string;
  animate: boolean;
  onSelect: (id: string) => void;
}) {
  const constellation = useRef<THREE.Group>(null);

  useFrame((_, rawDelta) => {
    if (!constellation.current || !animate) return;
    constellation.current.rotation.y += Math.min(rawDelta, 0.05) * 0.012;
  });

  return (
    <>
      <color attach="background" args={["#0b1424"]} />
      <fogExp2 attach="fog" args={["#0b1424", 0.03]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 8, 7]} intensity={2.2} color="#ffd78c" />
      <pointLight position={[-5, -1, 3]} intensity={12} distance={18} color="#4dd4bc" />
      <Sparkles count={180} scale={[22, 13, 10]} size={1.2} speed={animate ? 0.12 : 0} opacity={0.55} color="#dce8ff" />
      <group ref={constellation} rotation-x={-0.08}>
        {[3.1, 5.4, 7.4].map((radius) => (
          <mesh key={radius} rotation-x={Math.PI / 2} position-y={0.12}>
            <torusGeometry args={[radius, 0.01, 8, 180]} />
            <meshBasicMaterial color="#8c9fbc" transparent opacity={0.16} />
          </mesh>
        ))}
        {DESTINATIONS.map((destination) => (
          <Planet
            key={destination.id}
            destination={destination}
            selected={selectedId === destination.id}
            animate={animate}
            onSelect={() => onSelect(destination.id)}
          />
        ))}
      </group>
      <Environment>
        <Lightformer intensity={2} position={[0, 5, 2]} scale={[10, 10, 1]} color="#d7e4ff" />
        <Lightformer intensity={1.1} position={[-5, 1, -2]} rotation-y={Math.PI / 2} scale={[12, 2, 1]} color="#4dd4bc" />
      </Environment>
    </>
  );
}

/* ─── Static planet (thumbnails + WebGL fallback) ────────────────────────── */

function PlanetSwatch({ destination, size = 44 }: { destination: Destination; size?: number }) {
  const color = destination.locked ? "#657d9e" : destination.color;
  return (
    <span
      aria-hidden
      className="relative inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 32% 28%, ${color} 0%, ${color}cc 38%, #17263d 100%)`,
        boxShadow: `inset -${size / 8}px -${size / 10}px ${size / 4}px rgba(3,8,18,0.45), 0 0 0 1px rgba(154,185,255,0.12)`,
      }}
    >
      <span
        className="absolute left-1/2 top-1/2 rounded-[50%] border"
        style={{
          width: size * 1.55,
          height: size * 0.42,
          transform: "translate(-50%, -50%) rotate(-18deg)",
          borderColor: `${color}66`,
        }}
      />
    </span>
  );
}

function StaticUniverse({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="grid grid-cols-3 gap-8 p-8">
        {DESTINATIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(d.id)}
            className={cn(
              "grid place-items-center rounded-full p-3 transition-shadow",
              selectedId === d.id && "shadow-[0_0_0_2px_#72e3ce]"
            )}
            aria-label={d.name}
          >
            <PlanetSwatch destination={d} size={d.id === "foundations" ? 88 : 60} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── UI pieces ──────────────────────────────────────────────────────────── */

function StatusBadge({ destination }: { destination: Destination }) {
  if (destination.locked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-meta font-semibold text-muted-foreground">
        <Lock size={12} aria-hidden /> Locked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-surface px-2.5 py-0.5 text-meta font-semibold text-success">
      <Orbit size={12} aria-hidden /> Available
    </span>
  );
}

function PreviewNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 text-meta text-muted-foreground", className)}>
      <Info size={14} className="mt-[3px] shrink-0" aria-hidden />
      Preview destinations with sample progress. Your real courses are in the catalog.
    </p>
  );
}

function DestinationDetail({ destination, orgslug }: { destination: Destination; orgslug: string }) {
  return (
    <div className="sl-card flex h-full flex-col p-5 md:p-6" aria-live="polite">
      <div className="flex items-start gap-4">
        <PlanetSwatch destination={destination} size={52} />
        <div className="min-w-0 flex-1">
          <p className="sl-telemetry text-muted-foreground">{destination.discipline}</p>
          <h2 className="mt-1 font-display text-section font-semibold tracking-tight text-foreground">{destination.name}</h2>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusBadge destination={destination} />
        <span className="rounded-full border border-border px-2.5 py-0.5 text-meta font-semibold text-muted-foreground">Preview</span>
      </div>
      <p className="mt-4 text-ui text-muted-foreground">{destination.summary}</p>

      {destination.locked ? (
        <div className="mt-5 flex items-start gap-3 rounded-[10px] border border-border bg-muted p-4">
          <Lock size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-ui text-foreground">{destination.lockedReason}</p>
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex items-center justify-between text-meta">
            <span className="font-semibold text-foreground">Sample progress</span>
            <span className="font-mono tabular-nums text-muted-foreground">{destination.sampleProgress}%</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={destination.sampleProgress}
            aria-label={`Sample progress for ${destination.name}`}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${destination.sampleProgress}%` }} />
          </div>
        </div>
      )}

      <div className="mt-auto pt-6">
        <Link href={getUriWithOrg(orgslug, "/courses")} className="sl-btn sl-btn-primary w-full">
          <BookOpen size={18} aria-hidden />
          Browse courses
        </Link>
      </div>
    </div>
  );
}

function DestinationList({
  selectedId,
  onSelect,
  orgslug,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  orgslug: string;
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {DESTINATIONS.map((d) => {
        const selected = d.id === selectedId;
        return (
          <li key={d.id}>
            <div
              className={cn(
                "sl-card sl-card-interactive flex h-full flex-col p-5",
                selected && "border-primary shadow-glow"
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(d.id)}
                aria-pressed={selected}
                className="flex items-start gap-4 text-start"
              >
                <PlanetSwatch destination={d} />
                <span className="min-w-0 flex-1">
                  <span className="block text-meta text-muted-foreground">{d.discipline}</span>
                  <span className="mt-0.5 block text-card-title font-semibold text-foreground">{d.name}</span>
                </span>
              </button>
              <p className="mt-3 line-clamp-2 text-ui text-muted-foreground">{d.summary}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <StatusBadge destination={d} />
                {d.locked ? (
                  <span className="text-meta text-muted-foreground">{d.lockedReason}</span>
                ) : (
                  <span className="font-mono text-meta tabular-nums text-muted-foreground">Sample {d.sampleProgress}%</span>
                )}
              </div>
            </div>
          </li>
        );
      })}
      <li className="sm:col-span-2 xl:col-span-3">
        <Link href={getUriWithOrg(orgslug, "/courses")} className="sl-btn sl-btn-secondary">
          See all courses <ArrowRight size={16} aria-hidden />
        </Link>
      </li>
    </ul>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export function LearningUniverse({ orgslug }: { orgslug: string }) {
  const session = useLHSession() as any;
  const [selectedId, setSelectedId] = useState("foundations");
  const narrow = useMediaQuery("(max-width: 767px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const webgl = useWebGLAvailable();
  const [view, setView] = useState<"map" | "list" | null>(null);
  const [motionPaused, setMotionPaused] = useState(false);

  // Mobile defaults to the list; desktop to the map. An explicit choice wins.
  const activeView = view ?? (narrow ? "list" : "map");
  const animate = !reducedMotion && !motionPaused;
  const selected = useMemo(
    () => DESTINATIONS.find((d) => d.id === selectedId) ?? DESTINATIONS[0],
    [selectedId]
  );

  const user = session?.data?.user;
  const firstName = user?.first_name || user?.username;

  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-8 md:px-6 md:pt-10 xl:px-8">
        {/* Greeting + next action */}
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="sl-telemetry text-link">Learning universe</p>
            <h1 className="mt-2 sl-page-title">{firstName ? `Welcome back, ${firstName}` : "Welcome back"}</h1>
            <p className="mt-2 text-reading text-muted-foreground">
              Choose a destination to explore, or jump straight into your courses.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div role="tablist" aria-label="Universe view" className="inline-flex rounded-[10px] border border-border bg-muted p-1">
              {([
                { key: "map", label: "Map", icon: Orbit },
                { key: "list", label: "List", icon: LayoutGrid },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  role="tab"
                  type="button"
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
            <Link href={getUriWithOrg(orgslug, "/courses")} className="sl-btn sl-btn-primary">
              <BookOpen size={18} aria-hidden /> My courses
            </Link>
          </div>
        </header>

        {activeView === "map" ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Bounded scene */}
            <section aria-label="Destination map" className="flex min-w-0 flex-col gap-4">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-border bg-[#0b1424] shadow-card md:aspect-video">
                {webgl === false ? (
                  <StaticUniverse selectedId={selected.id} onSelect={setSelectedId} />
                ) : webgl ? (
                  <Canvas
                    dpr={[1, 1.5]}
                    frameloop={animate ? "always" : "demand"}
                    camera={{ position: [0, 1.2, 10.5], fov: 48 }}
                    gl={{ antialias: true }}
                    aria-hidden
                  >
                    <Suspense fallback={null}>
                      <OrbitalScene selectedId={selected.id} animate={animate} onSelect={setSelectedId} />
                    </Suspense>
                  </Canvas>
                ) : null}

                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
                  <span className="rounded-full border border-white/15 bg-[#111d30]/85 px-2.5 py-1 text-meta font-semibold text-[#b7c5da]">
                    Preview map
                  </span>
                  {!reducedMotion && webgl && (
                    <button
                      type="button"
                      onClick={() => setMotionPaused((p) => !p)}
                      className="pointer-events-auto inline-flex h-9 items-center gap-2 rounded-[10px] border border-white/15 bg-[#111d30]/85 px-3 text-meta font-semibold text-[#f3f6fc] transition-colors hover:bg-[#20324b]"
                    >
                      {motionPaused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
                      {motionPaused ? "Play motion" : "Pause motion"}
                    </button>
                  )}
                </div>
              </div>

              {/* Accessible destination labels (DOM, outside the canvas) */}
              <div role="radiogroup" aria-label="Destinations" className="flex flex-wrap gap-2">
                {DESTINATIONS.map((d) => {
                  const isSelected = d.id === selected.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedId(d.id)}
                      className={cn(
                        "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors",
                        isSelected
                          ? "border-primary bg-selected text-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: d.locked ? "#8c9fbc" : d.color }} />
                      {d.name}
                      {d.locked && <Lock size={13} aria-label="Locked" />}
                    </button>
                  );
                })}
              </div>
              <PreviewNote />
            </section>

            <aside aria-label="Selected destination">
              <DestinationDetail destination={selected} orgslug={orgslug} />
            </aside>
          </div>
        ) : (
          <section aria-label="Destinations" className="mt-8 space-y-4">
            <PreviewNote />
            <DestinationList selectedId={selected.id} onSelect={setSelectedId} orgslug={orgslug} />
          </section>
        )}

        {/* Next steps */}
        <section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Next steps">
          {[
            { href: "/courses", icon: BookOpen, title: "Continue a course", body: "Open the catalog to resume or start a course." },
            { href: "/trail", icon: Target, title: "Check your progress", body: "See the courses you are enrolled in and what is left." },
            { href: "/skills", icon: Orbit, title: "Explore skills", body: "Pick the disciplines you want to focus on next." },
          ].map(({ href, icon: Icon, title, body }) => (
            <Link key={href} href={getUriWithOrg(orgslug, href)} className="sl-card sl-card-interactive group flex items-start gap-4 p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-selected text-link">
                <Icon size={20} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-card-title font-semibold text-foreground">
                  {title}
                  <ArrowRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
                <span className="mt-1 block text-ui text-muted-foreground">{body}</span>
              </span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
