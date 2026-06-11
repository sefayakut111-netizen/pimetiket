/**
 * Admin panel — sipariş durumu Türkçe etiketleri (tek kaynak).
 * Teknik enum değerleri kullanıcıya gösterilmez.
 */

import type { OrderStatus } from "./order";

export const ADMIN_STATUS_LABELS: Record<OrderStatus, string> = {
  paid: "Ödendi",
  awaiting_upload: "Tasarım bekleniyor",
  qc_pending: "AI kontrol bekliyor",
  qc_flagged: "AI uyarı verdi",
  human_review: "Operatör inceliyor",
  human_review_failed: "Operatör reddetti",
  operator_review: "Operatör kuyruğunda",
  proof_generating: "Bıçak hazırlanıyor",
  proof_pending: "Müşteri onayı bekliyor",
  proof_validating: "Prova kontrol ediliyor",
  proof_approved: "Prova onaylandı",
  operator_print_review: "Baskı onayı bekliyor",
  ready_to_ship: "Üretime hazır",
  fason_assigned: "Partnere atandı",
  in_production: "Üretimde",
  shipped: "Kargoda",
  delivered: "Teslim edildi",
  cancelled: "İptal edildi",
};

const ADMIN_STATUS_STYLES: Record<
  OrderStatus,
  { color: string; bg: string; hex?: string }
> = {
  paid: { color: "text-pim-mercan", bg: "bg-pim-mercan-tint", hex: "#ef3e56" },
  awaiting_upload: { color: "text-pim-mercan", bg: "bg-pim-mercan-tint", hex: "#FB923C" },
  qc_pending: { color: "text-pim-mercan", bg: "bg-pim-mercan-tint", hex: "#ef3e56" },
  qc_flagged: { color: "text-sari-koyu", bg: "bg-sari-soft", hex: "#FFC53D" },
  operator_review: { color: "text-pim-mercan", bg: "bg-pim-mercan-tint", hex: "#ef3e56" },
  human_review: { color: "text-pim-mercan", bg: "bg-pim-mercan-tint", hex: "#ef3e56" },
  human_review_failed: { color: "text-kirmizi-koyu", bg: "bg-kirmizi-soft", hex: "#DC2626" },
  proof_generating: { color: "text-lacivert", bg: "bg-gri-100", hex: "#64748B" },
  proof_pending: { color: "text-lacivert", bg: "bg-gri-100", hex: "#64748B" },
  proof_validating: { color: "text-lacivert", bg: "bg-gri-100", hex: "#64748B" },
  proof_approved: { color: "text-yesil", bg: "bg-yesil-soft", hex: "#16A34A" },
  operator_print_review: { color: "text-sari-koyu", bg: "bg-sari-soft", hex: "#CA8A04" },
  ready_to_ship: { color: "text-mavi-koyu", bg: "bg-mavi-soft", hex: "#1D4ED8" },
  fason_assigned: { color: "text-mavi-koyu", bg: "bg-mavi-soft", hex: "#1D4ED8" },
  in_production: { color: "text-yesil", bg: "bg-yesil-soft", hex: "#16A34A" },
  shipped: { color: "text-lacivert", bg: "bg-gri-100", hex: "#64748B" },
  delivered: { color: "text-yesil", bg: "bg-yesil-soft", hex: "#16A34A" },
  cancelled: { color: "text-kirmizi", bg: "bg-gri-100", hex: "#94A3B8" },
};

export interface AdminStatusMeta {
  label: string;
  color: string;
  bg: string;
  hex?: string;
}

export function getAdminStatusLabel(status: string): string {
  if (status in ADMIN_STATUS_LABELS) {
    return ADMIN_STATUS_LABELS[status as OrderStatus];
  }
  return status;
}

export function getAdminStatusMeta(status: OrderStatus): AdminStatusMeta {
  const styles = ADMIN_STATUS_STYLES[status];
  return {
    label: ADMIN_STATUS_LABELS[status],
    color: styles?.color ?? "text-gri-700",
    bg: styles?.bg ?? "bg-gri-100",
    hex: styles?.hex,
  };
}
