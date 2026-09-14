"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, Sparkles } from "@react-three/drei";
import { useRouter } from "next/navigation";
import { getUriWithOrg } from "@services/config/config";
import {
  Bell,
  BookOpen,
  Bot,
  ChevronDown,
  Flame,
  Gamepad2,
  Hexagon,
  Lock,
  Medal,
  Mic,
  Milestone,
  Orbit,
  Play,
  Settings,
  ShieldCheck,
  Sparkles as SparklesIcon,
  Target,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import Dock from "@/components/ui/Dock";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";
import { cn } from "@/lib/utils";


type Course = {
  id: string;
  name: string;
  shortName: string;
  discipline: string;
  progress: number;
  xp: number;
  level: number;
  next: string;
  color: string;
  position: [number, number, number];
  size: number;
  locked?: boolean;
};

const COURSES: [Course, ...Course[]] = [
  {
    id: "foundations",
    name: "AI Foundations",
    shortName: "Foundation Prime",
    discipline: "Main Quest · 3 Core Modules",
    progress: 68,
    xp: 1240,
    level: 7,
    next: "Complete: Ethics in the Wild",
    color: "#edb45c",
    position: [0, 0.25, 0],
    size: 1.35,
  },
  {
    id: "healthcare",
    name: "AI for Healthcare",
    shortName: "Helix",
    discipline: "Applied Intelligence",
    progress: 24,
    xp: 320,
    level: 2,
    next: "Decode a diagnostic model",
    color: "#4ed6c6",
    position: [-4.6, 1.8, -1.2],
    size: 0.66,
  },
  {
    id: "business",
    name: "AI for Business",
    shortName: "Venture",
    discipline: "Applied Intelligence",
    progress: 11,
    xp: 145,
    level: 1,
    next: "Map an automation workflow",
    color: "#89a6ff",
    position: [4.8, 1.55, -0.9],
    size: 0.75,
  },
  {
    id: "model",
    name: "Train Your Own Model",
    shortName: "Forge",
    discipline: "Builder Path",
    progress: 0,
    xp: 0,
    level: 0,
    next: "Unlock after Foundation Prime",
    color: "#e97687",
    position: [-3.8, -2.25, -0.3],
    size: 0.57,
    locked: true,
  },
  {
    id: "arena",
    name: "PvP Prompt Arena",
    shortName: "Arena",
    discipline: "Challenge Sector",
    progress: 0,
    xp: 0,
    level: 0,
    next: "Unlock at Level 10",
    color: "#b88cff",
    position: [4.1, -2.15, -0.6],
    size: 0.61,
    locked: true,
  },
];

function Planet({ course, selected, onSelect }: { course: Course; selected: boolean; onSelect: () => void }) {
  const group = useRef<THREE.Group>(null);
  const planet = useRef<THREE.Mesh>(null);
  const { gl } = useThree();

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    if (planet.current) planet.current.rotation.y += dt * (course.id === "foundations" ? 0.12 : 0.2);
    if (group.current) group.current.position.y = course.position[1] + Math.sin(clock.elapsedTime * 0.55 + course.position[0]) * 0.08;
  });

  return (
    <group ref={group} position={course.position}>
      <mesh
        ref={planet}
        onClick={(event) => {
          event.stopPropagation();
          if (!course.locked) onSelect();
        }}
        onPointerEnter={() => {
          if (!course.locked) gl.domElement.style.cursor = "pointer";
        }}
        onPointerLeave={() => {
          gl.domElement.style.cursor = "default";
        }}
        scale={selected ? 1.08 : 1}
      >
        <sphereGeometry args={[course.size, 64, 64]} />
        <meshStandardMaterial
          color={course.locked ? "#353b4f" : course.color}
          emissive={course.locked ? "#10131c" : course.color}
          emissiveIntensity={selected ? 0.33 : 0.12}
          metalness={0.28}
          roughness={0.66}
        />
      </mesh>
      <mesh rotation-x={Math.PI / 2.5}>
        <torusGeometry args={[course.size * 1.42, course.size * 0.035, 16, 100]} />
        <meshBasicMaterial color={course.locked ? "#50586f" : course.color} transparent opacity={selected ? 0.85 : 0.42} />
      </mesh>
      {selected && (
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[course.size * 1.82, 0.015, 8, 120]} />
          <meshBasicMaterial color={course.color} transparent opacity={0.75} />
        </mesh>
      )}
    </group>
  );
}

function OrbitalScene({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const constellation = useRef<THREE.Group>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useFrame((_, rawDelta) => {
    if (!constellation.current || reducedMotion.current) return;
    constellation.current.rotation.y += Math.min(rawDelta, 0.05) * 0.018;
  });

  return (
    <>
      <color attach="background" args={["#050810"]} />
      <fogExp2 attach="fog" args={["#050810", 0.035]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 8, 7]} intensity={2.4} color="#ffd993" />
      <pointLight position={[-5, -1, 3]} intensity={15} distance={18} color="#54d9d3" />
      <Sparkles count={260} scale={[22, 13, 10]} size={1.4} speed={0.18} opacity={0.65} color="#dce8ff" />
      <group ref={constellation} rotation-x={-0.08}>
        {[3.1, 5.4, 7.4].map((radius) => (
          <mesh key={radius} rotation-x={Math.PI / 2} position-y={0.12}>
            <torusGeometry args={[radius, 0.012, 8, 180]} />
            <meshBasicMaterial color="#7584a5" transparent opacity={0.19} />
          </mesh>
        ))}
        {COURSES.map((course) => (
          <Planet key={course.id} course={course} selected={selectedId === course.id} onSelect={() => onSelect(course.id)} />
        ))}
      </group>
      <Environment>
        <Lightformer intensity={2} position={[0, 5, 2]} scale={[10, 10, 1]} color="#d7e4ff" />
        <Lightformer intensity={1.2} position={[-5, 1, -2]} rotation-y={Math.PI / 2} scale={[12, 2, 1]} color="#44cfc1" />
      </Environment>
    </>
  );
}

const navItems = [
  { label: "Learning Universe", icon: Orbit, to: "/" as const },
  { label: "Skills Page", icon: Hexagon, to: "/skills" as const },
  { label: "AI Agent", icon: Bot, to: "/ai-agent" as const },
  { label: "Journey", icon: Milestone, to: "/journey" as const },
  { label: "Missions", icon: Target },
  { label: "Achievements", icon: Medal },
  { label: "Podcasts", icon: Mic },
  { label: "Communities", icon: Users },
  { label: "Playground", icon: Gamepad2 },
];

function CourseSelectionModal({
  isOpen,
  onClose,
  selectedId,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (!isOpen) return null;

  // Group courses by discipline
  const groupedCourses = COURSES.reduce((acc, course) => {
    if (!acc[course.discipline]) acc[course.discipline] = [];
    acc[course.discipline].push(course);
    return acc;
  }, {} as Record<string, Course[]>);

  const groups = Object.entries(groupedCourses);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto pointer-events-auto">
        <div className="flex items-center justify-between p-8 pb-6">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">My courses</h2>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">
            Edit Courses
          </button>
        </div>

        <div className="p-8 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
            {groups.map(([discipline, disciplineCourses]) => (
              <div key={discipline}>
                <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
                  <h3 className="text-lg font-bold text-gray-800">{discipline}</h3>
                  <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    See all ({disciplineCourses.length})
                  </button>
                </div>
                
                <div className="relative pl-6 space-y-8 mt-6">
                  {/* Vertical line connecting nodes */}
                  <div className="absolute left-[19px] top-[24px] bottom-[24px] w-px bg-gray-200" />
                  
                  {disciplineCourses.map((course) => (
                    <div key={course.id} className="relative flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        {/* Circular Icon */}
                        <div 
                          className="absolute -left-6 flex items-center justify-center w-10 h-10 rounded-full text-white z-10 shadow-sm"
                          style={{ backgroundColor: course.color }}
                        >
                          <BookOpen className="size-5" />
                        </div>
                        
                        <div className="pl-6">
                          <button 
                            onClick={() => {
                              onSelect(course.id);
                              onClose();
                            }}
                            className="text-blue-600 hover:text-blue-800 font-medium text-[15px] text-left"
                          >
                            {course.name}
                          </button>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {course.locked ? "Mastery unavailable" : `${course.progress}% Proficient`}
                          </p>
                        </div>
                      </div>
                      
                      {!course.locked && (
                        <button
                          onClick={() => {
                            onSelect(course.id);
                            onClose();
                          }}
                          className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                        >
                          {course.progress > 0 ? "Resume" : "Start"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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

export function LearningUniverse({ orgslug }: { orgslug: string }) {
  const [selectedId, setSelectedId] = useState("foundations");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const selected = useMemo(() => COURSES.find((course) => course.id === selectedId) ?? COURSES[0], [selectedId]);
  const narrow = useNarrow();
  const router = useRouter();

  return (
    <main className="relative flex-1 min-h-0 overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 z-0">
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.2, 10.5], fov: 48 }} gl={{ antialias: true }}>
          <Suspense fallback={null}>
            <OrbitalScene selectedId={selected.id} onSelect={setSelectedId} />
          </Suspense>
        </Canvas>
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_28%,var(--background)_120%)]" />

      {/* Course Selection Trigger */}
      <div className="pointer-events-auto absolute top-6 right-6 md:top-8 md:right-10 z-40">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2 bg-white text-gray-900 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          <BookOpen className="size-4" />
          My Courses
        </button>
      </div>

      <CourseSelectionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        selectedId={selectedId} 
        onSelect={setSelectedId} 
      />

      <div className="pointer-events-auto absolute bottom-0 left-1/2 z-30 -translate-x-1/2 md:bottom-auto md:left-6 md:top-1/2 md:translate-x-0 md:-translate-y-1/2">
        <Dock
          items={navItems.map((item) => ({
            icon: <item.icon size={18} />,
            label: item.label,
            onClick: item.to 
              ? () => router.push(getUriWithOrg(orgslug, item.to))
              : () => toast(`${item.label} — coming in the next transmission`),
          }))}
          direction={narrow ? "horizontal" : "vertical"}
          panelSize={56}
          baseItemSize={40}
          magnification={56}
        />
      </div>

      <section className="pointer-events-none absolute left-4 top-12 z-20 md:left-32 md:top-16 max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-2">
          <span className="size-1 rounded-full bg-primary" /> {selected.discipline}
          {selected.locked && <Badge variant="outline" className="pointer-events-auto ml-2 h-5 text-[9px] border-primary/20">LOCKED</Badge>}
        </p>
        <h1 className="mt-4 font-display text-5xl font-light tracking-tight text-foreground md:text-7xl lg:text-8xl">
          {selected.name}
        </h1>
        <p className="mt-6 max-w-sm text-base leading-relaxed text-muted-foreground">
          {selected.id === "foundations" 
            ? "Explore new disciplines, complete missions, and turn knowledge into momentum." 
            : `Inspect progress and objectives for ${selected.name}.`}
        </p>
      </section>

      <section className="pointer-events-auto absolute bottom-12 left-4 right-4 z-20 sm:left-auto sm:right-12 md:bottom-12 sm:w-[22rem] transition-all duration-300" aria-live="polite">
        <div style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <p style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "#4ed6c6", marginBottom: 4 }}>Selected World</p>
              <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 22, fontWeight: 600, color: "#fff", margin: 0 }}>{selected.name}</h2>
              <p style={{ fontSize: 11, color: "rgba(240,244,255,0.5)", marginTop: 4 }}>{selected.discipline}</p>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(78,214,198,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ed6c6", flexShrink: 0 }}>
              <SparklesIcon className="size-4" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24, marginBottom: 20 }}>
            <div>
              <p style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(240,244,255,0.4)", marginBottom: 6 }}>Level</p>
              <p style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 26, fontWeight: 300, color: "#fff", margin: 0 }}>{selected.level}</p>
            </div>
            <div>
              <p style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(240,244,255,0.4)", marginBottom: 6 }}>Earned XP</p>
              <p style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 26, fontWeight: 300, color: "#fff", margin: 0 }}>{selected.xp}</p>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(240,244,255,0.4)", margin: 0 }}>World explored</p>
              <p style={{ fontFamily: "monospace", fontSize: 11, color: "#4ed6c6", margin: 0 }}>{selected.progress}%</p>
            </div>
            <div style={{ height: 4, width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${selected.progress}%`, background: "#4ed6c6", borderRadius: 2 }} />
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
            <p style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#4ed6c6", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Target className="size-3" /> Next Objective
            </p>
            <p style={{ fontSize: 13, color: "rgba(240,244,255,0.85)", fontWeight: 500, margin: 0 }}>{selected.next}</p>
          </div>

          <div className="pt-1 flex justify-center">
            {selected.locked ? (
              <button disabled style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "12px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "not-allowed" }}>
                <Lock className="size-4" /> Sector Locked
              </button>
            ) : (
              <LiquidMetalButton
                label="LAUNCH MISSION"
                onClick={() => toast.success(`Mission launch queued: ${selected.name}`, { icon: <Zap className="size-4" /> })}
              />
            )}
          </div>
        </div>
      </section>

      <section className="pointer-events-none absolute bottom-12 left-24 z-20 hidden max-w-sm md:left-32 lg:flex flex-col gap-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-2">
          <span className="size-1 rounded-full bg-primary animate-pulse" /> Active Mission
        </p>
        <p className="text-sm text-foreground/80 tracking-wide">Ethics in the Wild · Checkpoint 3/5</p>
      </section>

    </main>
  );

}