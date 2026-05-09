/**
 * Audit log store — KVKK gereği kim ne zaman ne yaptı.
 * localStorage demo; backend swap'te (Faz 2) `audit_log` tablosuna geçer.
 *
 * Kapsam: tüm admin işlemleri (status update, iade onay, kupon oluşturma, vb)
 */

const STORAGE_KEY = "pim_audit_log_v1";
const MAX_ENTRIES = 500;

export type AuditAction =
  | "order.status_change"
  | "order.cancel"
  | "return.approve"
  | "return.reject"
  | "return.refund"
  | "coupon.create"
  | "coupon.delete"
  | "settings.update"
  | "staff.invite"
  | "staff.remove"
  | "review.approve"
  | "review.reject"
  | "auth.login"
  | "auth.logout";

export const ACTION_LABEL: Record<AuditAction, string> = {
  "order.status_change": "Sipariş statüsü güncelledi",
  "order.cancel": "Sipariş iptal etti",
  "return.approve": "İade onayladı",
  "return.reject": "İade reddetti",
  "return.refund": "İade ödemesi yaptı",
  "coupon.create": "Kupon oluşturdu",
  "coupon.delete": "Kupon sildi",
  "settings.update": "Ayar güncelledi",
  "staff.invite": "Çalışan davet etti",
  "staff.remove": "Çalışan çıkardı",
  "review.approve": "Yorum onayladı",
  "review.reject": "Yorum reddetti",
  "auth.login": "Giriş yaptı",
  "auth.logout": "Çıkış yaptı",
};

export interface AuditEntry {
  id: string;
  /** Aksiyon tipi */
  action: AuditAction;
  /** Aksiyonu yapan (auth gelene kadar default "Sefa") */
  actor: string;
  /** Aksiyona konu olan entity (sipariş id, iade id, vs) */
  targetId?: string;
  /** İnsana okunabilir özet */
  summary: string;
  /** Ek detay (JSON string) */
  detail?: string;
  /** İstemci IP — placeholder, backend'de gerçek */
  ip?: string;
  createdAt: number;
  createdAtIso: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function listAuditEntries(): AuditEntry[] {
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

function writeAuditEntries(entries: AuditEntry[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent("pim_audit_log_updated"));
  } catch {
    // localStorage full
  }
}

export function logAudit(
  payload: Omit<AuditEntry, "id" | "createdAt" | "createdAtIso">
): AuditEntry {
  const now = Date.now();
  const entry: AuditEntry = {
    ...payload,
    id: `aud-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
    createdAtIso: new Date(now).toISOString(),
  };
  const entries = listAuditEntries();
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  writeAuditEntries(entries);
  return entry;
}
