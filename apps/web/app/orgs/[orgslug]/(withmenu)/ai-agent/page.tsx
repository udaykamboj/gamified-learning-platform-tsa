"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
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
        "Hi, I'm Astra. Ask me anything about AI concepts, the tools you're using, or how to stay honest while using them.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  // Only follow new messages when the reader is already near the bottom, so
  // nobody is pulled away from an older answer they are reading.
  const stickToBottom = useRef(true);

  useEffect(() => {
    const log = logRef.current;
    if (log && stickToBottom.current) log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    stickToBottom.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await askAgent({
        messages: next.filter((m) => m.content).slice(-12),
      });
      if (result.error || !result.reply) {
        setError(result.error ?? "Astra did not respond.");
        // Restore the draft so Send retries it without duplicating the bubble.
        setMessages(messages);
        setInput(trimmed);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
      }
    } catch {
      setError("The message could not be sent. Check your connection and try again.");
      setMessages(messages);
      setInput(trimmed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[860px] flex-col px-4 pb-10 pt-8 md:px-6 md:pt-10">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden /> Learning universe
        </Link>

        {/* Companion identity — bounded shader accent, never behind the transcript */}
        <header className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-3xl border border-border bg-[#0b1424] shadow-card">
            <AtcShader className="opacity-80" />
            <span className="absolute inset-0 grid place-items-center text-white">
              <Bot size={28} aria-hidden />
            </span>
          </div>
          <div>
            <p className="sl-telemetry flex items-center gap-1.5 text-discovery">
              <Sparkles size={14} aria-hidden /> AI companion
            </p>
            <h1 className="mt-1 sl-page-title">Astra, your flight companion</h1>
            <p className="mt-1 max-w-xl text-ui text-muted-foreground">
              Explains concepts, reviews your prompts, and helps keep your work honest.
            </p>
          </div>
        </header>

        {/* Conversation */}
        <section aria-label="Conversation with Astra" className="sl-card mt-8 flex min-h-[420px] flex-col overflow-hidden">
          <div
            ref={logRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            className="flex max-h-[55vh] flex-1 flex-col gap-5 overflow-y-auto p-5 md:p-6"
            aria-live="polite"
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn("flex max-w-[85%] flex-col gap-1.5", msg.role === "user" ? "self-end items-end" : "self-start")}
              >
                <span className="text-meta font-semibold text-muted-foreground">
                  {msg.role === "user" ? "You" : "Astra"}
                </span>
                <div
                  className={cn(
                    "whitespace-pre-wrap rounded-2xl px-4 py-3 text-ui select-text",
                    msg.role === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border border-border bg-muted text-foreground"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex items-center gap-2 self-start rounded-2xl border border-border bg-muted px-4 py-3 text-meta text-muted-foreground">
                <Loader2 size={16} className="animate-spin text-discovery" aria-hidden />
                Astra is thinking…
              </div>
            )}
          </div>

          <div className="border-t border-border bg-card p-4 md:p-5">
            {error && (
              <p role="alert" className="mb-3 rounded-[10px] border border-error/30 bg-error-surface px-3 py-2 text-ui text-error">
                {error}
              </p>
            )}

            {/* Starter questions */}
            <div className="mb-3 flex flex-wrap gap-2">
              {starters.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => void send(s)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-start text-meta font-medium text-muted-foreground transition-colors hover:border-line-control hover:bg-accent hover:text-foreground disabled:opacity-60"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Composer */}
            <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-center gap-2">
              <label className="sr-only" htmlFor="agent-prompt">Ask Astra</label>
              <input
                id="agent-prompt"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="How do I know if an AI answer is trustworthy?"
                className="sl-input flex-1"
                autoComplete="off"
              />
              <button type="submit" disabled={pending || !input.trim()} className="sl-btn sl-btn-primary">
                <Send size={16} aria-hidden /> Send
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
