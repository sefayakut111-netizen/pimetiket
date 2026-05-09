/**
 * Audit log store — KVKK + VUK uyumlu append-only log.
 *
 * Hibrit:
 *   - Auth varsa  → Supabase `audit_log` tablosu + `fn_log_audit` RPC
 *   - Auth yoksa  → localStorage (dev/demo)
 *
 * Client-side'dan SADECE auth.* + profile.delete eylemleri loglanabilir
 * (fn_log_audit içinde guard var). Admin eylemleri service_role ile
 * server-side INSERT yapar.
 *
 * Kapsam: tüm admin işlemleri (status update, iade onay, kupon oluşturma,
 * vb) — admin endpoint'leri server-side log atacak.
 */

import { createClient } from "./supabase/client";
import { getCurrentUser } from "./supabase/auth-bridge";

const STORAGE_KEY = "pim_audit_log_v1";
const MAX_ENTRIES = 500;

// ============================================================
// Types
// ============================================================

export type AuditAction =
  | "order.status_change"
  | "order.cancel"
  | "order.refund"
  | "return.approve"
  | "return.reject"
  | "return.refund"
  | "coupon.create"
  | "coupon.update"
  | "coupon.delete"
  | "review.approve"
  | "review.reject"
  | "review.delete"
  | "staff.invite"
  | "staff.remove"
  | "staff.role_change"
  | "settings.update"
  | "design_file.approve"
  | "design_file.reject"
  | "auth.login"
  | "auth.logout"
  | "profile.delete";

export const ACTION_LABEL: Record<AuditAction, string> = {
  "order.status_change": "Sipariş statüsü güncellendi",
  "order.cancel": "Sipariş iptal edildi",
  "order.refund": "Sipariş iade ödemesi",
  "return.approve": "İade onaylandı",
  "return.reject": "İade reddedildi",
  "return.refund": "İade ödemesi yapıldı",
  "coupon.create": "Kupon oluşturuldu",
  "coupon.update": "Kupon güncellendi",
  "coupon.delete": "Kupon silindi",
  "review.approve": "Yorum onaylandı",
  "review.reject": "Yorum reddedildi",
  "review.delete": "Yorum silindi",
  "staff.invite": "Çalışan davet edildi",
  "staff.remove": "Çalışan çıkarıldı",
  "staff.role_change": "Çalışan rolü değişti",
  "settings.update": "Ayar güncellendi",
  "design_file.approve": "Tasarım onaylandı",
  "design_file.reject": "Tasarım reddedildi",
  "auth.login": "Giriş yapıldı",
  "auth.logout": "Çıkış yapıldı",
  "profile.delete": "Hesap silme talebi",
};

export interface AuditEntry {
  id: string;
  action: AuditAction;
  /** Aksiyonu yapan (e-posta veya display name) */
  actor: string;
  targetType?: string;
  targetId?: string;
  summary: string;
  detail?: string;
  ip?: string;
  createdAt: number;
  createdAtIso: string;
}

interface DbRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: AuditAction;
  target_type: string | null;
  target_id: string | null;
  summary: string;
  detail: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

function rowToEntry(r: DbRow): AuditEntry {
  const ts = new Date(r.created_at).getTime();
  return {
    id: r.id,
    action: r.action,
    actor: r.actor_email ?? "—",
    targetType: r.target_type ?? undefined,
    targetId: r.target_id ?? undefined,
    summary: r.summary,
    detail: r.detail ? JSON.stringify(r.detail) : undefined,
    ip: r.ip_address ?? undefined,
    createdAt: ts,
    createdAtIso: r.created_at,
  };
}

// ============================================================
// Cache + helpers
// ============================================================

let cache: AuditEntry[] = [];
let cacheLoaded = false;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function notifyChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("pim_audit_log_updated"));
}

// ============================================================
// localStorage
// ============================================================

function readLocal(): AuditEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuditEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(entries: AuditEntry[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage full
  }
}

// ============================================================
// DB
// ============================================================

async function dbList(): Promise<AuditEntry[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = createClient();
  // RLS: müşteri sadece kendi audit kayıtlarını görür
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(MAX_ENTRIES);
  if (error) {
    console.error("[audit] dbList error:", error);
    return [];
  }
  return (data as DbRow[]).map(rowToEntry);
}

async function dbLog(
  action: AuditAction,
  payload: {
    targetType?: string;
    targetId?: string;
    summary: string;
    detail?: unknown;
  }
): Promise<boolean> {
  const supabase = createClient();
  // SADECE auth.* + profile.delete client-side allowed (fn_log_audit guard)
  const { error } = await supabase.rpc("fn_log_audit" as never, {
    p_action: action,
    p_target_type: payload.targetType ?? null,
    p_target_id: payload.targetId ?? null,
    p_summary: payload.summary,
    p_detail: (payload.detail ?? {}) as never,
  } as never);
  if (error) {
    console.error("[audit] dbLog error:", error);
    return false;
  }
  return true;
}

// ============================================================
// Public API
// ============================================================

export async function refreshAuditLog(): Promise<AuditEntry[]> {
  const user = await getCurrentUser();
  if (user) {
    cache = await dbList();
  } else {
    cache = readLocal();
  }
  cacheLoaded = true;
  notifyChange();
  return cache;
}

export function listAuditEntries(): AuditEntry[] {
  if (!cacheLoaded) {
    cache = readLocal();
    cacheLoaded = true;
  }
  return cache;
}

export async function logAudit(
  payload: Omit<AuditEntry, "id" | "createdAt" | "createdAtIso">
): Promise<AuditEntry> {
  const user = await getCurrentUser();
  const now = Date.now();
  const entry: AuditEntry = {
    ...payload,
    id: generateId(),
    createdAt: now,
    createdAtIso: new Date(now).toISOString(),
  };

  if (user) {
    // Sadece auth.* + profile.delete client-side log atılabilir
    const isClientAllowed =
      payload.action === "auth.login" ||
      payload.action === "auth.logout" ||
      payload.action === "profile.delete";
    if (isClientAllowed) {
      void dbLog(payload.action, {
        targetType: payload.targetType,
        targetId: payload.targetId,
        summary: payload.summary,
        detail: payload.detail,
      });
    } else {
      console.warn(
        `[audit] ${payload.action} client-side log atılmıyor — admin server endpoint kullan.`
      );
    }
  } else {
    // Guest mode → localStorage
    const entries = readLocal();
    entries.unshift(entry);
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
    writeLocal(entries);
    cache = entries;
    notifyChange();
  }

  return entry;
}
