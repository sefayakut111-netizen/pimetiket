/**
 * Pim Etiket — Customer-facing status mapping.
 *
 * Sefa 20 May v68 (8-agent denetim P1 #9, ICE 18.7):
 * Internal 16 OrderStatus enum müşteri sayfalarında doğrudan
 * gösteriliyordu — `qc_pending`, `proof_generating`, `human_review_failed`,
 * `ready_to_ship`, `fason_assigned` gibi teknik isimler. Müşteri için
 * 8 anlaşılır gruba indirgenir.
 *
 * Müşteri zihninde 4 ana faz vardır:
 *   1. Tasarım/inceleme (ödeme sonrası ilk aşama)
 *   2. Prova onay (müşteri eylem alacak)
 *   3. Üretim (fason atölye)
 *   4. Teslim (kargo + ev)
 *
 * Bu helper render-only — hiçbir DB veya iş mantığı bağlı değil.
 * Status badge color + Pim mascot pose + isteğe bağlı CTA aksiyon önerisi.
 */

import type { OrderStatus } from "./order";

/** Müşteri sayfalarında gösterilen 9 kategori (16 enum'dan azaltıldı). */
export type CustomerStatusGroup =
  | "paid"
  | "awaiting_upload"
  | "reviewing"
  | "proof_generating"
  | "proof_pending"
  | "pre_print_approval"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface CustomerStatusInfo {
  /** Müşteriye gösterilen TR metin */
  label: string;
  /** EN versiyonu (i18n için) */
  labelEn: string;
  /** Tailwind bg class — pastel arka plan */
  bg: string;
  /** Tailwind text color class */
  color: string;
  /** Müşteri için kısa açıklama (tooltip / alt satır) */
  hint?: string;
  hintEn?: string;
  /** Pim mascot pose önerisi (örn. /panelim'de) */
  pimPose?: "wave" | "inspect" | "wait" | "think" | "happy" | "sad" | "excited";
  /** Müşterinin yapacağı eylem var mı? Varsa CTA label + href */
  action?: { label: string; labelEn: string; hrefTemplate: string };
  /** Müşteri için en kabaca faz (1-4) — progress bar için */
  phase: 1 | 2 | 3 | 4 | 0; // 0 = iptal
  /** Grup adı (filtre chip ID'si için) */
  group: CustomerStatusGroup;
}

/**
 * Internal OrderStatus → müşteri-yüzü grup eşlemesi.
 *
 * 16 enum → 9 grup:
 *   - paid → "Ödeme alındı" (kısa bir bekleyiş, sonra inceleme/upload'a geçer)
 *   - awaiting_upload → "Tasarım bekleniyor" (CTA: /tasarim-yukle)
 *   - qc_*, operator_review, human_review*, proof_approved öncesi → "İnceleniyor"
 *   - proof_generating → "Baskı provası hazırlanıyor" (5dk SLA)
 *   - proof_pending → "Onayını bekliyoruz" (CTA: /onay)
 *   - operator_print_review → "Baskı öncesi onay" (operatör son kontrol)
 *   - proof_approved, ready_to_ship, fason_assigned, in_production → "Üretimde"
 *   - shipped → "Kargoda"
 *   - delivered → "Teslim edildi"
 *   - cancelled → "İptal"
 */
export function getCustomerStatusInfo(
  status: OrderStatus
): CustomerStatusInfo {
  switch (status) {
    case "paid":
      return {
        label: "Ödeme alındı",
        labelEn: "Payment received",
        bg: "bg-yesil-soft",
        color: "text-yesil",
        hint: "Sıradaki adıma geçiyoruz",
        hintEn: "Moving to the next step",
        pimPose: "happy",
        phase: 1,
        group: "paid",
      };
    case "awaiting_upload":
      return {
        label: "Tasarım bekleniyor",
        labelEn: "Design needed",
        bg: "bg-pim-mercan-tint",
        color: "text-pim-mercan",
        hint: "Tasarımını yükle, üretime başlayalım",
        hintEn: "Upload your design to begin production",
        pimPose: "wait",
        action: {
          label: "Tasarımı yükle",
          labelEn: "Upload design",
          hrefTemplate: "/siparis/{orderId}/tasarim-yukle",
        },
        phase: 1,
        group: "awaiting_upload",
      };
    case "qc_pending":
    case "qc_flagged":
    case "operator_review":
    case "human_review":
    case "human_review_failed":
      return {
        label: "İnceleniyor",
        labelEn: "Reviewing",
        bg: "bg-sari-soft",
        color: "text-sari-koyu",
        hint: "Tasarımını ekibimiz inceliyor",
        hintEn: "Our team is reviewing your design",
        pimPose: "inspect",
        phase: 1,
        group: "reviewing",
      };
    case "proof_generating":
      return {
        label: "Baskı provası hazırlanıyor",
        labelEn: "Preparing print proof",
        bg: "bg-gri-100",
        color: "text-lacivert",
        hint: "Yaklaşık 5 dakika içinde onayına sunulacak",
        hintEn: "Will be ready for approval in ~5 minutes",
        pimPose: "think",
        phase: 2,
        group: "proof_generating",
      };
    case "proof_validating":
      return {
        label: "Düzenlemenizi kontrol ediyoruz",
        labelEn: "Checking your edit",
        bg: "bg-gri-100",
        color: "text-lacivert",
        hint: "Birkaç saniye",
        hintEn: "Just a few seconds",
        pimPose: "think",
        phase: 2,
        group: "proof_generating",
      };
    case "proof_pending":
      return {
        label: "Onayını bekliyoruz",
        labelEn: "Waiting for your approval",
        bg: "bg-pim-mercan-tint",
        color: "text-pim-mercan",
        hint: "36 saat içinde onayla, yoksa otomatik iade",
        hintEn: "Approve within 36 hours or auto-refund",
        pimPose: "wait",
        action: {
          label: "Provayı incele",
          labelEn: "Review proof",
          hrefTemplate: "/onay/{orderId}",
        },
        phase: 2,
        group: "proof_pending",
      };
    case "proof_approved":
      return {
        label: "Onayın alındı",
        labelEn: "Approval received",
        bg: "bg-gri-100",
        color: "text-lacivert",
        hint: "Baskı öncesi son kontrole geçiyor",
        hintEn: "Moving to final pre-print check",
        pimPose: "happy",
        phase: 2,
        group: "pre_print_approval",
      };
    case "operator_print_review":
      return {
        label: "Baskı öncesi onay",
        labelEn: "Pre-print approval",
        bg: "bg-mavi-soft",
        color: "text-mavi-koyu",
        hint: "Operatör baskı öncesi son kontrolü yapıyor",
        hintEn: "Final pre-print check in progress",
        pimPose: "inspect",
        phase: 3,
        group: "pre_print_approval",
      };
    case "ready_to_ship":
    case "fason_assigned":
    case "in_production":
      return {
        label: "Üretimde",
        labelEn: "In production",
        bg: "bg-mavi-soft",
        color: "text-mavi-koyu",
        hint: "Atölyemiz siparişini hazırlıyor",
        hintEn: "Your order is being printed",
        pimPose: "excited",
        phase: 3,
        group: "in_production",
      };
    case "shipped":
      return {
        label: "Kargoda",
        labelEn: "Shipping",
        bg: "bg-mavi-soft",
        color: "text-mavi-koyu",
        hint: "Kargoya verildi, takip et",
        hintEn: "Handed to courier — track now",
        pimPose: "wave",
        phase: 4,
        group: "shipped",
      };
    case "delivered":
      return {
        label: "Teslim edildi",
        labelEn: "Delivered",
        bg: "bg-yesil-soft",
        color: "text-yesil",
        hint: "Beğendiysen yorum bırak",
        hintEn: "Leave a review if you liked it",
        pimPose: "happy",
        phase: 4,
        group: "delivered",
      };
    case "cancelled":
      return {
        label: "İptal",
        labelEn: "Cancelled",
        bg: "bg-gri-100",
        color: "text-kirmizi",
        hint: "Sipariş iptal edildi (ödeme iade edildi)",
        hintEn: "Order cancelled (payment refunded)",
        pimPose: "sad",
        phase: 0,
        group: "cancelled",
      };
    default: {
      // Bilinmeyen status — fallback (yeni enum eklenirse buraya düşer)
      const _exhaustive: never = status;
      void _exhaustive;
      return {
        label: "İşleniyor",
        labelEn: "Processing",
        bg: "bg-gri-100",
        color: "text-gri-700",
        pimPose: "think",
        phase: 1,
        group: "reviewing",
      };
    }
  }
}

/**
 * Müşteri tarafı filtre chip'leri için kullanılan 6 ana grup
 * (paid, reviewing ve proof_* tek "Devam ediyor" altında birleşir
 * isterse). Aksi takdirde 9 grup ayrı chip.
 */
export const CUSTOMER_STATUS_FILTER_GROUPS: Array<{
  id: CustomerStatusGroup | "all";
  labelTr: string;
  labelEn: string;
}> = [
  { id: "all", labelTr: "Tümü", labelEn: "All" },
  { id: "awaiting_upload", labelTr: "Tasarım bekleniyor", labelEn: "Design needed" },
  { id: "reviewing", labelTr: "İnceleniyor", labelEn: "Reviewing" },
  { id: "proof_pending", labelTr: "Onayını bekliyoruz", labelEn: "Pending approval" },
  {
    id: "pre_print_approval",
    labelTr: "Baskı öncesi onay",
    labelEn: "Pre-print approval",
  },
  { id: "in_production", labelTr: "Üretimde", labelEn: "In production" },
  { id: "shipped", labelTr: "Kargoda", labelEn: "Shipping" },
  { id: "delivered", labelTr: "Teslim edildi", labelEn: "Delivered" },
  { id: "cancelled", labelTr: "İptal", labelEn: "Cancelled" },
];

/** Phase progress için yardımcı — /siparis/[id]'de breadcrumb ilerleme barı */
export const PHASE_LABELS: Record<1 | 2 | 3 | 4, { tr: string; en: string }> = {
  1: { tr: "İnceleme", en: "Review" },
  2: { tr: "Onay", en: "Approval" },
  3: { tr: "Üretim", en: "Production" },
  4: { tr: "Teslim", en: "Delivery" },
};
