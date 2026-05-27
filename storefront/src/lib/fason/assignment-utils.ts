/** Partner/admin panelinde gecikme kontrolü */

const ACTIVE_STATUSES = new Set([
  "assigned",
  "sent",
  "acknowledged",
  "in_production",
  "ready",
  "issue",
]);

export function isAssignmentOverdue(
  status: string,
  estimatedDelivery: string | null | undefined
): boolean {
  if (!estimatedDelivery || !ACTIVE_STATUSES.has(status)) return false;
  return new Date(estimatedDelivery).getTime() < Date.now();
}

export function hoursUntilDelivery(
  estimatedDelivery: string | null | undefined
): number | null {
  if (!estimatedDelivery) return null;
  return Math.round(
    (new Date(estimatedDelivery).getTime() - Date.now()) / (1000 * 60 * 60)
  );
}

export function formatDeliveryCountdown(hoursLeft: number | null): string {
  if (hoursLeft === null) return "—";
  if (hoursLeft < 0) return `Gecikmiş (${Math.abs(hoursLeft)}sa)`;
  if (hoursLeft < 24) return `${hoursLeft}sa kaldı`;
  return `${Math.round(hoursLeft / 24)} gün kaldı`;
}
