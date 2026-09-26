import Link from "next/link";
import { ArrowLeft, Hexagon } from "lucide-react";
import { getUriWithOrg } from "@services/config/config";
import SkillsEnrollment from "./enrollment";

export const metadata = {
  title: "Skills & Disciplines — Choose Your Learning Path",
  description: "Choose the courses you want to learn and enroll at your own pace.",
};

type PageParams = Promise<{ orgslug: string }>;

export default async function SkillsPage({ params }: { params: PageParams }) {
  const { orgslug } = await params;

  return (
    <div style={{ background: "#050810", minHeight: "100svh", color: "#f0f4ff", fontFamily: "Manrope, sans-serif" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "4rem 1.25rem" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3rem" }}>
          <Link href={getUriWithOrg(orgslug, "/dashboard")} style={{
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
          <Hexagon size={12} /> Enrollment
        </p>
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 600, margin: "0 0 16px", color: "#fff" }}>
          Skills &amp; Disciplines
        </h1>
        <p style={{ color: "rgba(240,244,255,0.5)", fontSize: 14, lineHeight: 1.8, maxWidth: 520, marginBottom: "3rem" }}>
          Choose the courses that join your learning universe. Enroll in as many as you like,
          learn at your own pace, and leave a course whenever you want.
        </p>

        <SkillsEnrollment orgslug={orgslug} />
      </div>
    </div>
  );
}
