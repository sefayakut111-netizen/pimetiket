/**
 * Customer return (iade talebi) store — hibrit (auth varsa Supabase,
 * yoksa localStorage).
 *
 * İade durumları:
 *   - pending: müşteri talep oluşturdu, admin inceleyecek
 *   - approved: admin onayladı, ürün kargoyla geri bekleniyor
 *   - rejected: admin reddetti (mesajla sebep)
 *   - refunded: para iade edildi (cüzdana / karta)
 */

import { createClient } from "./supabase/client";
import {
  getCurrentUser,
  isLoggedInSync,
} from "./supabase/auth-bridge";

const STORAGE_KEY = "pim_customer_returns_v1";
const MAX_RETURNS = 100;

export type ReturnStatus = "pending" | "approved" | "rejected" | "refunded";

export type ReturnReason =
  | "yanlis_urun"
  | "uretim_hatasi"
  | "kargo_hasari"
  | "kalite_problemi"
  | "diger";

// Display label'ları artık i18n COPY'de — sayfa kendi locale'ine göre çözer.
// Bu sabit sadece geriye uyumlu kalsın diye duruyor.
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

// ============================================================
// Cache + helpers
// ============================================================

let cache: ReturnRequest[] = [];
let cacheLoaded = false;

function notifyChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("pim_customer_returns_updated"));
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

// ============================================================
// localStorage
// ============================================================

function readLocal(): ReturnRequest[] {
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

function writeLocal(items: ReturnRequest[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage full
  }
}

// ============================================================
// DB
// ============================================================

interface DbRow {
  id: string;
  order_id: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  reason: ReturnReason;
  description: string;
  attachments: string[];
  status: ReturnStatus;
  admin_note: string | null;
  refund_amount: number | null;
  created_at: string;
  updated_at: string;
}

function rowToReturn(r: DbRow): ReturnRequest {
  const ts = new Date(r.created_at).getTime();
  const updTs = new Date(r.updated_at).getTime();
  return {
    id: r.id,
    orderId: r.order_id,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    reason: r.reason,
    description: r.description,
    attachments: r.attachments ?? [],
    status: r.status,
    adminNote: r.admin_note ?? undefined,
    refundAmount: r.refund_amount != null ? Number(r.refund_amount) : undefined,
    createdAt: ts,
    createdAtIso: r.created_at,
    updatedAt: updTs,
    updatedAtIso: r.updated_at,
  };
}

async function dbList(userId: string): Promise<ReturnRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("returns")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[returns] dbList error:", error);
    return [];
  }
  return (data as DbRow[]).map(rowToReturn);
}

async function dbInsert(
  userId: string,
  payload: Omit<
    ReturnRequest,
    "id" | "status" | "createdAt" | "createdAtIso" | "updatedAt" | "updatedAtIso"
  >
): Promise<ReturnRequest | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("returns")
    .insert({
      order_id: payload.orderId,
      user_id: userId,
      customer_name: payload.customerName,
      customer_email: payload.customerEmail,
      reason: payload.reason,
      description: payload.description,
      attachments: payload.attachments,
    } as never)
    .select("*")
    .single();
  if (error) {
    console.error("[returns] dbInsert error:", error);
    return null;
  }
  return rowToReturn(data as DbRow);
}

// ============================================================
// Public API
// ============================================================

export async function refreshReturns(): Promise<ReturnRequest[]> {
  const user = await getCurrentUser();
  if (user) {
    cache = await dbList(user.id);
  } else {
    cache = readLocal();
  }
  cacheLoaded = true;
  notifyChange();
  return cache;
}

export function listReturns(): ReturnRequest[] {
  if (!cacheLoaded && !isLoggedInSync()) {
    cache = readLocal();
    cacheLoaded = true;
  }
  return cache;
}

export async function createReturn(
  payload: Omit<
    ReturnRequest,
    "id" | "status" | "createdAt" | "createdAtIso" | "updatedAt" | "updatedAtIso"
  >
): Promise<ReturnRequest> {
  const user = await getCurrentUser();
  if (user) {
    const created = await dbInsert(user.id, payload);
    if (!created) throw new Error("İade oluşturulamadı, tekrar dene.");
    cache = [created, ...cache];
    notifyChange();
    return created;
  }

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
  const items = readLocal();
  items.unshift(fresh);
  if (items.length > MAX_RETURNS) items.length = MAX_RETURNS;
  writeLocal(items);
  cache = items;
  notifyChange();
  return fresh;
}

export function getReturn(id: string): ReturnRequest | null {
  return cache.find((r) => r.id === id) ?? null;
}

/**
 * Admin tarafı işlem — auth mode'da no-op (service_role gerekir),
 * guest mode'da localStorage'a yazar (mock akış).
 */
export function updateReturnStatus(
  id: string,
  status: ReturnStatus,
  adminNote?: string,
  refundAmount?: number
): void {
  if (isLoggedInSync()) {
    console.warn(
      "[returns] updateReturnStatus: auth mode'da no-op. Admin tarafı service_role ile."
    );
    return;
  }
  const items = readLocal();
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
  writeLocal(items);
  cache = items;
  notifyChange();
}

export function listReturnsByOrder(orderId: string): ReturnRequest[] {
  return cache.filter((r) => r.orderId === orderId);
}
