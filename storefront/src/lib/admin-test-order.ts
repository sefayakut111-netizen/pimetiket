/** Admin hesabından verilen test siparişleri — orders.payment jsonb marker. */

export const ADMIN_TEST_ORDER_MARKER = {
  adminTestOrder: true as const,
  source: "admin" as const,
};

export function withAdminTestOrderMarker<T extends Record<string, unknown>>(
  payment: T,
  mark = true
): T & Partial<typeof ADMIN_TEST_ORDER_MARKER> {
  if (!mark) return payment;
  return { ...payment, ...ADMIN_TEST_ORDER_MARKER };
}

export function isAdminTestOrderPayment(payment: unknown): boolean {
  if (!payment || typeof payment !== "object") return false;
  return (payment as { adminTestOrder?: boolean }).adminTestOrder === true;
}
