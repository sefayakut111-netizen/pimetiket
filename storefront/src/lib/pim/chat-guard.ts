/**
 * Pim chat güvenlik katmanı — prompt injection + output sızıntısı.
 */

import { MAX_MESSAGE_CHARS } from "@/lib/pim/memory-clamp";

const INJECTION_PATTERNS: RegExp[] = [
  /sistem\s*prompt/i,
  /system\s*prompt/i,
  /geliştirici\s*mod/i,
  /developer\s*mode/i,
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /önceki\s+talimatları\s+unut/i,
  /tüm\s+kuralları\s+yok\s*say/i,
  /rolünü\s+unut/i,
  /you\s+are\s+now\s+/i,
  /jailbreak/i,
  /DAN\s+mode/i,
];

const OUTPUT_LEAK_PATTERNS: RegExp[] = [
  /SES\s+VE\s+ÜSLUP\s+KURALLARI/i,
  /BRAND_VOICE/i,
  /YASAKLAR:/i,
  /PROMPT\s+INJECTION\s+DEFANSI/i,
  /KNOWLEDGE_BASE/i,
  /POZİTİF\s+AÇILIŞ\s+KURALI/i,
];

export function clampUserText(text: string): string {
  return text.slice(0, MAX_MESSAGE_CHARS);
}

export function looksLikePromptInjection(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return false;
  return INJECTION_PATTERNS.some((p) => p.test(t));
}

export function looksLikeSystemPromptLeak(text: string): boolean {
  if (!text || text.length < 40) return false;
  return OUTPUT_LEAK_PATTERNS.some((p) => p.test(text));
}
