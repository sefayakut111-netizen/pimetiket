import type { UIMessage } from "ai";
import type { PimFact, PimMessage } from "./memory";

export const MAX_FACTS = 30;
export const MAX_HISTORY = 40;
export const MAX_SUMMARY_CHARS = 2000;
export const MAX_MESSAGE_CHARS = 4000;

export interface PimMemoryPayload {
  displayName?: string | null;
  facts?: PimFact[];
  history?: PimMessage[];
  lastSummary?: string | null;
}

function clampMessageContent(content: string): string {
  return content.slice(0, MAX_MESSAGE_CHARS);
}

export function clampFacts(facts: PimFact[] | undefined): PimFact[] {
  if (!Array.isArray(facts)) return [];
  return facts
    .slice(-MAX_FACTS)
    .map((f) => ({
      ...f,
      key: String(f.key ?? "").slice(0, 80),
      value: String(f.value ?? "").slice(0, 500),
    }));
}

export function clampHistory(history: PimMessage[] | undefined): PimMessage[] {
  if (!Array.isArray(history)) return [];
  return history.slice(-MAX_HISTORY).map((m) => ({
    ...m,
    content: clampMessageContent(String(m.content ?? "")),
    role: m.role === "assistant" ? "assistant" : "user",
  }));
}

export function clampMemoryPayload(input: PimMemoryPayload): PimMemoryPayload {
  return {
    displayName: input.displayName?.trim().slice(0, 60) || null,
    facts: clampFacts(input.facts),
    history: clampHistory(input.history),
    lastSummary: input.lastSummary
      ? input.lastSummary.slice(0, MAX_SUMMARY_CHARS)
      : null,
  };
}

export function extractTextFromUIMessage(msg: UIMessage): string {
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p) => p.type === "text")
      .map((p) => String((p as { text?: string }).text ?? ""))
      .join("");
  }
  const legacy = (msg as { content?: unknown }).content;
  if (typeof legacy === "string") return legacy;
  return "";
}

function withClampedText(msg: UIMessage, text: string): UIMessage {
  if (Array.isArray(msg.parts)) {
    return {
      ...msg,
      parts: [{ type: "text", text }],
    } as UIMessage;
  }
  return { ...msg, content: text } as UIMessage;
}

/** Chat API — OpenAI'a gitmeden önce mesaj listesini sınırla. */
export function clampChatMessages(messages: UIMessage[]): UIMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-MAX_HISTORY).map((msg) => {
    if (msg.role !== "user" && msg.role !== "assistant") return msg;
    const text = clampMessageContent(extractTextFromUIMessage(msg));
    return withClampedText(msg, text);
  });
}
