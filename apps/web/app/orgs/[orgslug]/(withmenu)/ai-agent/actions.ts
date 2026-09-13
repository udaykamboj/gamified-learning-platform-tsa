"use server";

import { z } from "zod";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const inputSchema = z.object({
  messages: z.array(messageSchema).min(1).max(20),
});

const SYSTEM_PROMPT = [
  "You are ASTRA, the onboard AI flight companion inside a space-themed AI learning portal for high-school students (grades 9-12).",
  "You explain AI concepts, AI tools and techniques, and responsible/ethical AI use.",
  "Keep answers short (under 120 words unless asked for more), concrete, and encouraging.",
  "Use plain language and space/mission metaphors sparingly. Never invent facts; say when you are unsure.",
].join(" ");

export async function askAgent(data: unknown) {
  try {
    const validated = inputSchema.parse(data);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { reply: "", error: "The agent is not configured yet." };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...validated.messages],
      }),
    });

    if (response.status === 429) {
      return { reply: "", error: "Too many requests right now — try again in a moment." };
    }
    if (response.status === 402) {
      return { reply: "", error: "Usage credits are exhausted for the AI companion." };
    }
    if (!response.ok) {
      return { reply: "", error: "The companion could not reach the network." };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!reply) return { reply: "", error: "The companion sent an empty transmission." };
    return { reply, error: null as string | null };
  } catch (error) {
    return { reply: "", error: "An unexpected error occurred." };
  }
}
