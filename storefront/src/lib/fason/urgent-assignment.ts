/** Acil atama tespiti — SLA (48 saat kala) */

export type UrgentReason = "sla";

const SLA_URGENT_MS = 48 * 60 * 60 * 1000;

export function getUrgentReason(
  slaDeadline: string | null | undefined
): UrgentReason | null {
  if (!slaDeadline) return null;
  const remaining = new Date(slaDeadline).getTime() - Date.now();
  if (remaining > 0 && remaining < SLA_URGENT_MS) return "sla";
  return null;
}

export function isUrgentAssignment(
  slaDeadline: string | null | undefined
): boolean {
  return getUrgentReason(slaDeadline) !== null;
}

export function urgentReasonLabel(reason: UrgentReason): string {
  return "Son 48 saat";
}

/** sla_deadline yoksa estimated_delivery kullan */
export function resolveSlaDeadline(
  estimatedDelivery: string | null | undefined
): string | null {
  return estimatedDelivery ?? null;
}
