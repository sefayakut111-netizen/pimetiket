/**
 * Customer return (iade talebi) store — localStorage bazlı.
 * Backend swap'te (Faz 1.2) Supabase `returns` tablosuna geçer.
 *
 * İade durumları:
 *   - pending: müşteri talep oluşturdu, admin inceleyecek
 *   - approved: admin onayladı, ürün kargoyla geri bekleniyor
 *   - rejected: admin reddetti (mesajla sebep)
 *   - refunded: para iade edildi (cüzdana / karta)
 */

const STORAGE_KEY = "pim_customer_returns_v1";
const MAX_RETURNS = 100;

export type ReturnStatus = "pending" | "approved" | "rejected" | "refunded";

export type ReturnReason =
  | "yanlis_urun"
  | "uretim_hatasi"
  | "kargo_hasari"
  | "kalite_problemi"
  | "diger";

export const RETURN_REASON_LABEL: Record<ReturnReason, string> = {
  yanlis_urun: "Yanlış ürün geldi",
  uretim_hatasi: "Üretim hatası (renk/baskı bozuk)",
  kargo_hasari: "Kargo hasarı",
  kalite_problemi: "Kalite problemi",
  diger: "Diğer",
};

export const STATUS_LABEL: Record<ReturnStatus, string> = {
  pending: "İncelemede",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  refunded: "İade tamamlandı",
};

export interface ReturnRequest {
  id: string;
  /** Sipariş ID — orders.id'ye foreign key */
  orderId: string;
  /** Müşteri (auth gelene kadar email) */
  customerName: string;
  customerEmail: string;
  reason: ReturnReason;
  description: string;
  /** Müşterinin yüklediği görseller — şu an sadece dosya adları (gerçek upload Faz 2) */
  attachments: string[];
  status: ReturnStatus;
  /** Admin notu (red mesajı, onay açıklaması) */
  adminNote?: string;
  /** İade tutarı */
  refundAmount?: number;
  createdAt: number;
  createdAtIso: string;
  updatedAt: number;
  updatedAtIso: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ret-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listReturns(): ReturnRequest[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReturnRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReturns(items: ReturnRequest[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("pim_customer_returns_updated"));
  } catch {
    // localStorage full
  }
}

export function createReturn(
  payload: Omit<
    ReturnRequest,
    "id" | "status" | "createdAt" | "createdAtIso" | "updatedAt" | "updatedAtIso"
  >
): ReturnRequest {
  const now = Date.now();
  const fresh: ReturnRequest = {
    ...payload,
    id: generateId(),
    status: "pending",
    createdAt: now,
    createdAtIso: new Date(now).toISOString(),
    updatedAt: now,
    updatedAtIso: new Date(now).toISOString(),
  };
  const items = listReturns();
  items.unshift(fresh);
  if (items.length > MAX_RETURNS) items.length = MAX_RETURNS;
  writeReturns(items);
  return fresh;
}

export function getReturn(id: string): ReturnRequest | null {
  return listReturns().find((r) => r.id === id) ?? null;
}

export function updateReturnStatus(
  id: string,
  status: ReturnStatus,
  adminNote?: string,
  refundAmount?: number
): void {
  const items = listReturns();
  const idx = items.findIndex((r) => r.id === id);
  if (idx === -1) return;
  const now = Date.now();
  items[idx] = {
    ...items[idx],
    status,
    adminNote: adminNote ?? items[idx].adminNote,
    refundAmount: refundAmount ?? items[idx].refundAmount,
    updatedAt: now,
    updatedAtIso: new Date(now).toISOString(),
  };
  writeReturns(items);
}

export function listReturnsByOrder(orderId: string): ReturnRequest[] {
  return listReturns().filter((r) => r.orderId === orderId);
}
