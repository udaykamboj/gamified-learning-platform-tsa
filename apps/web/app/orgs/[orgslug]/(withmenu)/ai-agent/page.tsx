"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Send,
  Sparkles,
  Bot,
} from "lucide-react";

import { AtcShader } from "@/components/ui/atc-shader";
import { askAgent } from "./actions";

const starters = [
  "Explain what a neural network is like I'm 15.",
  "Review this prompt: write me an essay about WW2.",
  "Is it cheating to use AI for homework?",
];

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function AiAgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "ASTRA online. Ask me anything about AI concepts, the tools you're using, or how to stay honest while using them.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setPending(true);
    setError(null);
    try {
      const result = await askAgent({
        messages: next.filter((m) => m.content).slice(-12),
      });
      if (result.error || !result.reply) {
        setError(result.error ?? "The companion did not respond.");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
      }
    } catch {
      setError("The transmission failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ background: "#050810", minHeight: "100svh", display: "flex", flexDirection: "column", color: "#f0f4ff" }}>
      {/* Background shader */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, opacity: 0.6 }}>
        <AtcShader />
      </div>
      {/* Radial vignette */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 1,
        background: "radial-gradient(circle at 50% 45%, transparent 10%, #050810 92%)"
      }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", flex: 1, maxWidth: 860, margin: "0 auto", width: "100%", padding: "3rem 1.25rem 2rem" }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2.5rem" }}>
          <Link href="/" style={{
            display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.6)",
            textDecoration: "none", fontSize: 13, fontFamily: "var(--font-mono, monospace)",
            letterSpacing: "0.05em", textTransform: "uppercase"
          }}>
            <ArrowLeft size={14} /> Command deck
          </Link>
          <span style={{
            border: "1px solid rgba(78,214,198,0.4)", color: "#4ed6c6", padding: "4px 12px",
            borderRadius: 4, fontSize: 11, fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.1em", textTransform: "uppercase"
          }}>
            ASTRA — online
          </span>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <p style={{ color: "#4ed6c6", fontFamily: "var(--font-mono, monospace)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 12 }}>
            <Sparkles size={12} /> Onboard companion
          </p>
          <h1 style={{ fontFamily: "Space Grotesk, var(--font-display, sans-serif)", fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 600, margin: 0, color: "#fff", lineHeight: 1.1 }}>
            Your flight companion
          </h1>
          <p style={{ marginTop: 16, color: "rgba(240,244,255,0.55)", fontSize: 14, lineHeight: 1.8, maxWidth: 520, margin: "16px auto 0" }}>
            A guide that travels with you through the learning universe — explaining concepts,
            reviewing your prompts, and keeping your work honest.
          </p>
        </div>

        {/* Chat card */}
        <div style={{
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden"
        }}>
          {/* Card header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(78,214,198,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ed6c6" }}>
              <Bot size={16} />
            </div>
            <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 14, fontWeight: 500, color: "#f0f4ff" }}>Ask anything about AI</span>
          </div>

          {/* Messages */}
          <div ref={logRef} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16, maxHeight: "35vh", overflowY: "auto" }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                <p style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(240,244,255,0.4)", marginBottom: 6 }}>
                  {msg.role === "user" ? "You" : "Astra"}
                </p>
                <div style={{
                  fontSize: 13, lineHeight: 1.7, color: msg.role === "user" ? "#fff" : "rgba(240,244,255,0.8)",
                  ...(msg.role === "assistant" ? { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "10px 14px" } : {})
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {pending && (
              <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "10px 14px" }}>
                <Loader2 size={14} style={{ color: "#4ed6c6", animation: "spin 1s linear infinite" }} />
                <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(240,244,255,0.4)" }}>Transmitting...</span>
              </div>
            )}
          </div>

          {/* Bottom section */}
          <div style={{ padding: "12px 20px 20px", background: "linear-gradient(to top, rgba(0,0,0,0.4), transparent)" }}>
            {error && <p style={{ color: "#f87171", fontSize: 12, marginBottom: 10 }}>{error}</p>}

            {/* Starter chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {starters.map((s) => (
                <button
                  key={s}
                  disabled={pending}
                  onClick={() => void send(s)}
                  style={{
                    fontFamily: "monospace", fontSize: 10, letterSpacing: "0.05em", color: "rgba(240,244,255,0.5)",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 6, padding: "6px 12px", cursor: "pointer", textAlign: "left",
                    transition: "all 0.15s"
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Input row */}
            <form
              onSubmit={(e) => { e.preventDefault(); void send(input); }}
              style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 8px 6px 16px" }}
            >
              <label className="sr-only" htmlFor="agent-prompt">Ask ASTRA</label>
              <input
                id="agent-prompt"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="How do I know if an AI answer is trustworthy?"
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: "#f0f4ff", fontSize: 14, fontFamily: "Space Grotesk, sans-serif",
                  padding: "6px 0"
                }}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={pending || !input.trim()}
                style={{
                  background: pending || !input.trim() ? "rgba(255,255,255,0.08)" : "#4ed6c6",
                  color: pending || !input.trim() ? "rgba(255,255,255,0.3)" : "#050810",
                  border: "none", borderRadius: 6, padding: "8px 16px", cursor: pending || !input.trim() ? "not-allowed" : "pointer",
                  fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
                  display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s"
                }}
              >
                <Send size={12} /> Send
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(240,244,255,0.3) !important; }
      `}</style>
    </div>
  );
}
