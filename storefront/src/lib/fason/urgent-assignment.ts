/** Acil atama tespiti — admin işareti veya SLA (48 saat) */

export type UrgentReason = "admin" | "sla";

const SLA_URGENT_MS = 48 * 60 * 60 * 1000;

export function getUrgentReason(
  isUrgent: boolean,
  slaDeadline: string | null | undefined
): UrgentReason | null {
  if (isUrgent) return "admin";
  if (!slaDeadline) return null;
  const remaining = new Date(slaDeadline).getTime() - Date.now();
  if (remaining > 0 && remaining < SLA_URGENT_MS) return "sla";
  return null;
}

export function isUrgentAssignment(
  isUrgent: boolean,
  slaDeadline: string | null | undefined
): boolean {
  return getUrgentReason(isUrgent, slaDeadline) !== null;
}

export function urgentReasonLabel(reason: UrgentReason): string {
  return reason === "admin" ? "Admin acil işaretledi" : "Son 48 saat";
}

/** sla_deadline yoksa estimated_delivery kullan */
export function resolveSlaDeadline(
  estimatedDelivery: string | null | undefined
): string | null {
  return estimatedDelivery ?? null;
}
