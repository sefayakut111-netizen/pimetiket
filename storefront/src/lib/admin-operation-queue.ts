/**
 * Operasyon kuyruğu — paylaşılan tipler ve SLA yardımcıları.
 */

import { UNASSIGNED_PRODUCTION_STATUSES, type OrderStatus } from "./order";

export type QueueItemType =
  | "ai_qc"
  | "proof_sla"
  | "fason_unassigned"
  | "shipping"
  | "support"
  | "review"
  | "capability";

export type QueueUrgency = "critical" | "warning" | "normal";

export interface QueueItem {
  id: string;
  type: QueueItemType;
  title: string;
  subtitle?: string;
  urgency: QueueUrgency;
  ageHours?: number;
  deadline?: string;
  href: string;
  actionLabel?: string;
}

export interface OperationQueueResponse {
  counts: Record<QueueItemType, number>;
  criticalCount: number;
  items: QueueItem[];
  generatedAt: string;
}

export const QUEUE_TYPE_LABELS: Record<QueueItemType, string> = {
  ai_qc: "AI QC",
  proof_sla: "Prova",
  fason_unassigned: "Fason",
  shipping: "Kargo",
  support: "Destek",
  review: "Yorum",
  capability: "Yetenek",
};

export const PROOF_SLA_HOURS = 36;
export const PROOF_CRITICAL_HOURS = 30;
export const PROOF_WARNING_HOURS = 18;

/** Klasik AI QC — prova üretimi ve baskı incelemesi hariç */
export const AI_QC_QUEUE_STATUSES: readonly OrderStatus[] = [
  "qc_pending",
  "qc_flagged",
  "human_review",
  "human_review_failed",
];

/** Prova SLA — takılan üretim/doğrulama dahil */
export const PROOF_SLA_STATUSES: readonly OrderStatus[] = [
  "proof_generating",
  "proof_validating",
  "proof_pending",
  "operator_print_review",
];

export const FASON_UNASSIGNED_STATUSES: readonly OrderStatus[] =
  UNASSIGNED_PRODUCTION_STATUSES;

/** Kargo etiketi basılmaya hazır */
export const SHIPPING_STATUSES: readonly OrderStatus[] = ["ready_to_ship"];

/** KPI > liste ise tam listeye yönlendirme */
export const QUEUE_MORE_HREFS: Record<QueueItemType, string> = {
  ai_qc: "/admin/ai-qc",
  proof_sla: "/admin/prova",
  fason_unassigned: "/admin/siparisler?view=unassigned",
  shipping: "/admin/kargo",
  support: "/admin/destek",
  review: "/admin/yorumlar",
  capability: "/admin/fason",
};

export function proofSlaTypeLabel(status: string): string {
  switch (status) {
    case "proof_generating":
      return "Prova üretiliyor";
    case "proof_validating":
      return "Prova doğrulanıyor";
    case "operator_print_review":
      return "Baskı incelemesi";
    default:
      return QUEUE_TYPE_LABELS.proof_sla;
  }
}

const URGENCY_RANK: Record<QueueUrgency, number> = {
  critical: 0,
  warning: 1,
  normal: 2,
};

export function proofAgeFromOrder(row: {
  created_at: string;
  sla_proof_deadline: string | null;
}): { ageHours: number; deadline: string } {
  const deadlineMs = row.sla_proof_deadline
    ? new Date(row.sla_proof_deadline).getTime()
    : new Date(row.created_at).getTime() + PROOF_SLA_HOURS * 3_600_000;
  const startMs = deadlineMs - PROOF_SLA_HOURS * 3_600_000;
  const ageHours = (Date.now() - startMs) / 3_600_000;
  return { ageHours, deadline: new Date(deadlineMs).toISOString() };
}

export function proofUrgency(ageHours: number): QueueUrgency {
  if (ageHours > PROOF_CRITICAL_HOURS) return "critical";
  if (ageHours > PROOF_WARNING_HOURS) return "warning";
  return "normal";
}

export function isTestOrderDbRow(row: {
  id: string;
  address?: unknown;
}): boolean {
  let name = "";
  if (row.address && typeof row.address === "object" && row.address !== null) {
    const n = (row.address as { name?: string }).name;
    if (typeof n === "string") name = n.toLowerCase();
  }
  const id = row.id.toLowerCase();
  return name.includes("test") || id.includes("test") || row.id === "00000001";
}

export function formatOrderTitle(
  orderId: string,
  address?: unknown
): string {
  let customer = "";
  if (address && typeof address === "object" && address !== null) {
    const n = (address as { name?: string }).name;
    if (typeof n === "string" && n.trim()) customer = n.trim();
  }
  return customer ? `#${orderId} — ${customer}` : `#${orderId}`;
}

export function sortQueueItems(items: QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => {
    const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (u !== 0) return u;
    return (b.ageHours ?? 0) - (a.ageHours ?? 0);
  });
}

export function emptyQueueCounts(): Record<QueueItemType, number> {
  return {
    ai_qc: 0,
    proof_sla: 0,
    fason_unassigned: 0,
    shipping: 0,
    support: 0,
    review: 0,
    capability: 0,
  };
}
