/**
 * Audience-aware status etiketleri.
 *
 * Sefa kararı (Marka Sesi denetimi P0):
 *   - Müşteri "fason" kelimesini ASLA görmemeli (operasyon arka plan).
 *   - Admin teknik durumu görür.
 *   - Fason'a 3 buton, kendi statüsü.
 *
 * Her assignment_status için 3 etiket: customer / admin / fason.
 *
 * **Konsolidasyon (Denetim P1):** /admin/fason ve /admin/siparisler
 * eskiden lokal `STATUS_LABEL` map'leri tutuyordu — DRY ihlali. Artık
 * `getAdminPillClasses()` helper'ı tek kaynaktan Tailwind chip
 * sınıflarını döner.
 */

export type AssignmentStatus =
  | "assigned"
  | "sent"
  | "acknowledged"
  | "in_production"
  | "ready"
  | "shipped"
  | "issue"
  | "cancelled";

export type Audience = "customer" | "admin" | "fason";

interface StatusMeta {
  label: string;
  /** Pim için kısa açıklama (chip bg) */
  hint?: string;
  /** Tailwind text color class */
  color: string;
  /** Tailwind bg color class */
  bg: string;
}

const STATUS_MAP: Record<
  AssignmentStatus,
  Record<Audience, StatusMeta>
> = {
  assigned: {
    customer: {
      label: "Üretim hazırlanıyor",
      hint: "Sıraya alındı, yakında işlemeye başlanacak",
      color: "text-pim-mercan",
      bg: "bg-pim-mercan-tint",
    },
    admin: {
      label: "Fason'a atandı",
      hint: "Mail kuyruğuna alındı, henüz gönderilmedi",
      color: "text-pim-mercan",
      bg: "bg-pim-mercan-tint",
    },
    fason: {
      label: "Yeni iş — bekliyor",
      color: "text-pim-mercan",
      bg: "bg-pim-mercan-tint",
    },
  },
  sent: {
    customer: {
      label: "Üretim hazırlanıyor",
      hint: "Sıraya alındı",
      color: "text-pim-mercan",
      bg: "bg-pim-mercan-tint",
    },
    admin: {
      label: "Mail gönderildi",
      hint: "Fason henüz açmadı",
      color: "text-pim-mercan",
      bg: "bg-pim-mercan-tint",
    },
    fason: {
      label: "Yeni iş",
      color: "text-pim-mercan",
      bg: "bg-pim-mercan-tint",
    },
  },
  acknowledged: {
    customer: {
      label: "Üretim hazırlanıyor",
      color: "text-pim-mercan",
      bg: "bg-pim-mercan-tint",
    },
    admin: {
      label: "Fason gördü",
      hint: "Dosyaya tıkladı, henüz üretime almadı",
      color: "text-sari",
      bg: "bg-sari-soft",
    },
    fason: {
      label: "Açıldı — onaylamayı bekliyor",
      color: "text-sari",
      bg: "bg-sari-soft",
    },
  },
  in_production: {
    customer: {
      label: "Basılıyor",
      hint: "Tasarımın üretim hattında",
      color: "text-yesil",
      bg: "bg-yesil-soft",
    },
    admin: {
      label: "Fason üretiyor",
      color: "text-yesil",
      bg: "bg-yesil-soft",
    },
    fason: {
      label: "Üretimde",
      color: "text-yesil",
      bg: "bg-yesil-soft",
    },
  },
  ready: {
    customer: {
      label: "Kargoya hazırlanıyor",
      color: "text-lacivert",
      bg: "bg-gri-100",
    },
    admin: {
      label: "Üretim hazır",
      hint: "Fason kargoya verecek",
      color: "text-lacivert",
      bg: "bg-gri-100",
    },
    fason: {
      label: "Hazır — kargoya",
      color: "text-lacivert",
      bg: "bg-gri-100",
    },
  },
  shipped: {
    customer: {
      label: "Kargoda",
      color: "text-lacivert",
      bg: "bg-gri-100",
    },
    admin: {
      label: "Kargoya verildi",
      color: "text-lacivert",
      bg: "bg-gri-100",
    },
    fason: {
      label: "Gönderildi",
      color: "text-yesil",
      bg: "bg-yesil-soft",
    },
  },
  issue: {
    customer: {
      label: "Üretim hatta küçük bir gecikme",
      hint: "Hemen bakıyoruz",
      color: "text-sari",
      bg: "bg-sari-soft",
    },
    admin: {
      label: "🚨 Fason sorun bildirdi",
      color: "text-kirmizi",
      bg: "bg-kirmizi/10",
    },
    fason: {
      label: "Sorun bildirildi",
      color: "text-kirmizi",
      bg: "bg-kirmizi/10",
    },
  },
  cancelled: {
    customer: {
      label: "İptal",
      color: "text-gri-500",
      bg: "bg-gri-100",
    },
    admin: {
      label: "Atama iptal",
      color: "text-gri-500",
      bg: "bg-gri-100",
    },
    fason: {
      label: "İptal — durduruldu",
      color: "text-gri-500",
      bg: "bg-gri-100",
    },
  },
};

/**
 * Audience'a göre etiket dön.
 * Customer perspektifinden "fason" kelimesi YASAK.
 */
export function getAssignmentStatusLabel(
  status: AssignmentStatus,
  audience: Audience
): StatusMeta {
  return STATUS_MAP[status][audience];
}

/**
 * Fason buton metinleri — esnaf samimiyeti.
 * Marka Sesi denetimi önerisi.
 */
export const FASON_ACTION_LABELS = {
  acknowledge: "Aldım, başlıyorum",
  inProduction: "Üretime aldım",
  ready: "Hazır, kargoya veriyorum",
  shipped: "Kargoya verdim",
  issue: "Bir terslik var",
} as const;

export const ISSUE_CATEGORIES = [
  { id: "dosya", label: "Dosya bozuk veya eksik" },
  { id: "malzeme", label: "Malzeme bitti / yetmedi" },
  { id: "sure", label: "Süre yetmiyor" },
  { id: "diger", label: "Diğer (açıklama yazacağım)" },
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number]["id"];

/**
 * Admin tablosu/atama geçmişi gibi yerlerde kullanılan kompakt chip
 * sınıfı dönerü. Tailwind ile `inline-flex ...` chip'te kullanılır.
 *
 * Audience hep `"admin"` — özel UI bileşenleri için.
 */
export function getAdminPillClasses(status: AssignmentStatus): {
  label: string;
  className: string;
} {
  const meta = STATUS_MAP[status]?.admin;
  if (!meta) {
    return { label: status, className: "bg-gri-100 text-gri-700" };
  }
  return {
    label: meta.label,
    className: `${meta.bg} ${meta.color}`,
  };
}
