/**
 * PimChat KVKK açık rıza (m.9 sınır ötesi veri aktarımı) helper'ı.
 *
 * Pim sohbeti OpenAI (ABD) altyapısını kullandığı için KVKK madde 9'a
 * göre "açık rıza" gerektirir. İlk sohbet açılışında modal gösterilir,
 * kullanıcı kabul edene kadar chat panel render olmaz.
 *
 * Versiyonlama: v1 — ilk sürüm. Yasal metin değişirse v2'ye geçilir,
 * kullanıcılardan tekrar onay alınır.
 */

const STORAGE_KEY = "pim_ai_chat_consent_v1";

export type ChatConsentValue = "accepted" | "declined";

export interface ChatConsentRecord {
  value: ChatConsentValue;
  /** ISO timestamp — Kurul denetiminde "ne zaman onaylandı" sorusu için */
  decidedAt: string;
}

/** localStorage'dan oku — null = henüz karar verilmemiş */
export function readChatConsent(): ChatConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChatConsentRecord>;
    if (parsed.value !== "accepted" && parsed.value !== "declined") return null;
    if (typeof parsed.decidedAt !== "string") return null;
    return parsed as ChatConsentRecord;
  } catch {
    return null;
  }
}

/** Karar kaydet */
export function writeChatConsent(value: ChatConsentValue): void {
  if (typeof window === "undefined") return;
  const record: ChatConsentRecord = {
    value,
    decidedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* localStorage dolu / private mode — sessizce başarısız */
  }
}

/** "Sıfırla" — kullanıcı KVKK haklarını kullanırsa silme talebi için */
export function clearChatConsent(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
