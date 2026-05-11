/**
 * Pim Etiket — Memory katmanı
 *
 * Anonim kullanıcı için localStorage backend. Auth + Supabase
 * geldiğinde aynı interface ile server-side memory'ye geçecek.
 *
 * **Sefa kuralı (11 May):** Pim "Beni hatırla / hatırlama" sormaz.
 * Yapay zeka sessizce localStorage'a yazar — KVKK m.5/2-c sözleşmenin
 * ifası kapsamında, ekstra açık rıza gerekmez. Kullanıcı dilediği an
 * /ayarlar/verilerim → "Pim sohbet geçmişim" granular silme ile siler.
 *
 * Saklanan data:
 *   - userId (UUID, ilk kullanımda generate)
 *   - displayName (varsa)
 *   - facts (key-value, AI çıkardı)
 *   - conversation history (son N mesaj)
 *
 * KVKK aydınlatma metni /kvkk Bölüm 6'da "Pim asistanı sohbet geçmişi"
 * kategorisinde listeli (6 ay anonim, 24 ay sil).
 */

import type { PimPersona } from "./personas";

const STORAGE_KEY = "pim:memory:v1";
const MAX_FACTS = 30;
const MAX_HISTORY = 40;

export interface PimFact {
  key: string;
  value: string;
  /** Hangi sohbette/persona'da öğrenildi. */
  learnedAt: number; // unix ms
  source?: PimPersona;
}

export interface PimMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  persona: PimPersona;
  createdAt: number;
}

export interface PimMemory {
  userId: string;
  /**
   * KVKK m.5/2-c kapsamında hizmetin parçası — varsayılan TRUE.
   * Kullanıcı /ayarlar/verilerim'den granular silebilir. Legacy alan,
   * geriye uyumluluk için tutulur.
   */
  consent: boolean;
  consentAt?: number;
  displayName?: string;
  facts: PimFact[];
  history: PimMessage[];
  /** Son sohbetin AI özeti (her sohbet sonu güncellenir). */
  lastConversationSummary?: string;
}

// ============================================================
// Storage I/O
// ============================================================

function generateUserId(): string {
  // crypto.randomUUID modern browser'larda var
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyMemory(): PimMemory {
  return {
    userId: generateUserId(),
    // KVKK m.5/2-c hizmetin parçası — varsayılan açık. Silmek için
    // /ayarlar/verilerim'den "Pim sohbet geçmişim" granular delete.
    consent: true,
    consentAt: Date.now(),
    facts: [],
    history: [],
  };
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readMemory(): PimMemory {
  if (!isBrowser()) return emptyMemory();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = emptyMemory();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as PimMemory;
    // Defensive defaults — legacy consent=false eski kullanıcı için
    // sessizce true'ya geç (KVKK m.5/2-c). Açık rıza istenmiyor.
    return {
      userId: parsed.userId ?? generateUserId(),
      consent: parsed.consent !== false ? true : true,
      consentAt: parsed.consentAt ?? Date.now(),
      displayName: parsed.displayName,
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      lastConversationSummary: parsed.lastConversationSummary,
    };
  } catch {
    return emptyMemory();
  }
}

export function writeMemory(mem: PimMemory): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mem));
  } catch {
    // localStorage dolmuş olabilir — sessizce geç
  }
}

// ============================================================
// Mutations
// ============================================================

export function setConsent(value: boolean): PimMemory {
  const mem = readMemory();
  mem.consent = value;
  mem.consentAt = value ? Date.now() : undefined;
  writeMemory(mem);
  return mem;
}

export function setDisplayName(name: string): PimMemory {
  const mem = readMemory();
  mem.displayName = name.trim().slice(0, 60) || undefined;
  writeMemory(mem);
  return mem;
}

export function appendMessage(msg: Omit<PimMessage, "id" | "createdAt">): PimMemory {
  const mem = readMemory();
  if (!mem.consent) return mem; // izin yoksa kaydetme
  const next: PimMessage = {
    ...msg,
    id: generateUserId(),
    createdAt: Date.now(),
  };
  mem.history = [...mem.history, next].slice(-MAX_HISTORY);
  writeMemory(mem);
  return mem;
}

export function upsertFact(fact: Omit<PimFact, "learnedAt">): PimMemory {
  const mem = readMemory();
  if (!mem.consent) return mem;
  const existing = mem.facts.findIndex((f) => f.key === fact.key);
  const entry: PimFact = { ...fact, learnedAt: Date.now() };
  if (existing >= 0) {
    mem.facts[existing] = entry;
  } else {
    mem.facts.push(entry);
  }
  // En yeni fact'ler önde, max cap
  mem.facts = mem.facts
    .sort((a, b) => b.learnedAt - a.learnedAt)
    .slice(0, MAX_FACTS);
  writeMemory(mem);
  return mem;
}

export function clearMemory(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
}

// ============================================================
// Read helpers
// ============================================================

/** API'ye gönderilecek memory snapshot — sadece prompt için lazım olanlar. */
export function memorySnapshotForPrompt(mem: PimMemory) {
  return {
    displayName: mem.displayName,
    facts: mem.facts.map(({ key, value }) => ({ key, value })),
    lastConversationSummary: mem.lastConversationSummary,
  };
}

/** Kullanıcı yeni mi? Açılış mesajını farklılaştırmak için. */
export function isReturningUser(mem: PimMemory): boolean {
  return mem.history.length > 0 || !!mem.displayName;
}
