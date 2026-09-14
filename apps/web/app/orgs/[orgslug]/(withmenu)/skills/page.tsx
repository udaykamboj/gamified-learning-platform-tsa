import Link from "next/link";
import { ArrowLeft, Hexagon, Lock } from "lucide-react";

export const metadata = {
  title: "Skills & Disciplines — Choose Your Learning Path",
  description: "Browse the Astra Academy skill tree and choose which AI learning worlds join your journey.",
};

const branches = [
  {
    title: "Core Path",
    copy: "AI concepts, practical tools, ethical use",
    color: "#4ed6c6",
    status: "available",
  },
  {
    title: "Applied Worlds",
    copy: "Healthcare, business, creative work",
    color: "#89a6ff",
    status: "available",
  },
  {
    title: "Builder Path",
    copy: "Train your own model, data literacy",
    color: "#e97687",
    status: "locked",
  },
  {
    title: "Challenge Sector",
    copy: "Prompt arena, boss challenges",
    color: "#b88cff",
    status: "locked",
  },
];

export default function SkillsPage() {
  return (
    <div style={{ background: "#050810", minHeight: "100svh", color: "#f0f4ff", fontFamily: "Manrope, sans-serif" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "4rem 1.25rem" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3rem" }}>
          <Link href="/dashboard" style={{
            display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.5)",
            textDecoration: "none", fontSize: 12, fontFamily: "monospace",
            letterSpacing: "0.1em", textTransform: "uppercase"
          }}>
            <ArrowLeft size={14} /> Command deck
          </Link>
          <span style={{
            border: "1px solid rgba(78,214,198,0.4)", color: "#4ed6c6", padding: "4px 12px",
            borderRadius: 4, fontSize: 10, fontFamily: "monospace", letterSpacing: "0.15em", textTransform: "uppercase"
          }}>
            Skill Tree
          </span>
        </div>

        {/* Heading */}
        <p style={{ color: "#4ed6c6", fontFamily: "monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <Hexagon size={12} /> Skill tree
        </p>
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 600, margin: "0 0 16px", color: "#fff" }}>
          Skills &amp; Disciplines
        </h1>
        <p style={{ color: "rgba(240,244,255,0.5)", fontSize: 14, lineHeight: 1.8, maxWidth: 500, marginBottom: "3rem" }}>
          Choose the worlds that join your learning universe. Locked branches unlock as you progress through Core Path.
        </p>

        {/* Branch cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {branches.map(({ title, copy, color, status }) => (
            <div
              key={title}
              style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "24px", position: "relative", overflow: "hidden",
                opacity: status === "locked" ? 0.55 : 1,
                transition: "background 0.2s"
              }}
            >
              {/* Color accent bar */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color, borderRadius: "12px 12px 0 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 17, fontWeight: 600, color: "#fff", margin: "0 0 8px" }}>{title}</h2>
                {status === "locked" && <Lock size={14} color="rgba(255,255,255,0.35)" />}
              </div>
              <p style={{ fontSize: 13, color: "rgba(240,244,255,0.5)", lineHeight: 1.7, margin: 0 }}>{copy}</p>
              {status !== "locked" && (
                <div style={{ marginTop: 16 }}>
                  <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.15em", textTransform: "uppercase", color, border: `1px solid ${color}40`, padding: "3px 8px", borderRadius: 4 }}>
                    Available
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
