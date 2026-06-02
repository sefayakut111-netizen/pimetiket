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

// ============================================================
// Memory providers — anonim localStorage vs üye server-side
// ============================================================

export interface PimMemoryProvider {
  read(): Promise<PimMemory>;
  appendMessage(msg: Omit<PimMessage, "id" | "createdAt">): Promise<void>;
  upsertFact(fact: Omit<PimFact, "learnedAt">): Promise<void>;
  setSummary(summary: string): Promise<void>;
  setDisplayName(name: string): Promise<void>;
  clearHistory(): Promise<void>;
  /** Server provider: bekleyen yazımları hemen gönder (logout öncesi). */
  flush?(): Promise<void>;
}

interface MemoryApiPayload {
  displayName?: string | null;
  facts?: PimFact[];
  history?: PimMessage[];
  lastSummary?: string | null;
}

function apiPayloadToMemory(
  userId: string,
  payload: MemoryApiPayload
): PimMemory {
  return {
    userId,
    consent: true,
    consentAt: Date.now(),
    displayName: payload.displayName ?? undefined,
    facts: Array.isArray(payload.facts) ? payload.facts : [],
    history: Array.isArray(payload.history) ? payload.history : [],
    lastConversationSummary: payload.lastSummary ?? undefined,
  };
}

function memoryToApiPayload(mem: PimMemory): MemoryApiPayload {
  return {
    displayName: mem.displayName ?? null,
    facts: mem.facts,
    history: mem.history,
    lastSummary: mem.lastConversationSummary ?? null,
  };
}

export class LocalMemoryProvider implements PimMemoryProvider {
  async read(): Promise<PimMemory> {
    return readMemory();
  }

  async appendMessage(
    msg: Omit<PimMessage, "id" | "createdAt">
  ): Promise<void> {
    appendMessage(msg);
  }

  async upsertFact(fact: Omit<PimFact, "learnedAt">): Promise<void> {
    upsertFact(fact);
  }

  async setSummary(summary: string): Promise<void> {
    const mem = readMemory();
    mem.lastConversationSummary = summary.slice(0, 2000);
    writeMemory(mem);
  }

  async setDisplayName(name: string): Promise<void> {
    setDisplayName(name);
  }

  async clearHistory(): Promise<void> {
    const mem = readMemory();
    mem.history = [];
    mem.lastConversationSummary = undefined;
    writeMemory(mem);
  }
}

export class ServerMemoryProvider implements PimMemoryProvider {
  private cache: PimMemory | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      void this.flush();
    }, 1000);
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (!this.cache) return;
    try {
      const res = await fetch("/api/pim/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memoryToApiPayload(this.cache)),
      });
      if (!res.ok && process.env.NODE_ENV !== "production") {
        console.warn("[pim/memory] flush failed:", res.status);
      }
    } catch {
      /* ağ hatası — sessiz; bir sonraki flush dener */
    }
  }

  async read(): Promise<PimMemory> {
    const res = await fetch("/api/pim/memory");
    if (!res.ok) {
      return {
        userId: this.userId,
        consent: true,
        facts: [],
        history: [],
      };
    }
    const payload = (await res.json()) as MemoryApiPayload;
    this.cache = apiPayloadToMemory(this.userId, payload);
    return this.cache;
  }

  async appendMessage(
    msg: Omit<PimMessage, "id" | "createdAt">
  ): Promise<void> {
    const mem = this.cache ?? (await this.read());
    const next: PimMessage = {
      ...msg,
      id: generateUserId(),
      createdAt: Date.now(),
    };
    mem.history = [...mem.history, next].slice(-MAX_HISTORY);
    this.cache = mem;
    this.scheduleFlush();
  }

  async upsertFact(fact: Omit<PimFact, "learnedAt">): Promise<void> {
    const mem = this.cache ?? (await this.read());
    const existing = mem.facts.findIndex((f) => f.key === fact.key);
    const entry: PimFact = { ...fact, learnedAt: Date.now() };
    if (existing >= 0) {
      mem.facts[existing] = entry;
    } else {
      mem.facts.push(entry);
    }
    mem.facts = mem.facts
      .sort((a, b) => b.learnedAt - a.learnedAt)
      .slice(0, MAX_FACTS);
    this.cache = mem;
    this.scheduleFlush();
  }

  async setSummary(summary: string): Promise<void> {
    const mem = this.cache ?? (await this.read());
    mem.lastConversationSummary = summary.slice(0, 2000);
    this.cache = mem;
    this.scheduleFlush();
  }

  async setDisplayName(name: string): Promise<void> {
    const mem = this.cache ?? (await this.read());
    mem.displayName = name.trim().slice(0, 60) || undefined;
    this.cache = mem;
    this.scheduleFlush();
  }

  async clearHistory(): Promise<void> {
    const mem = this.cache ?? (await this.read());
    mem.history = [];
    mem.lastConversationSummary = undefined;
    this.cache = mem;
    await this.flush();
  }
}

export function getPimMemoryProvider(
  isAuthenticated: boolean,
  userId?: string
): PimMemoryProvider {
  if (isAuthenticated && userId) {
    return new ServerMemoryProvider(userId);
  }
  return new LocalMemoryProvider();
}
