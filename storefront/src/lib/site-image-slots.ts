/**
 * Site Image Slot Catalog — admin panelinde yönetilebilen sabit slot'lar.
 *
 * Her slot:
 *   - id: DB'deki `site_images.slot` ile birebir eşleşir
 *   - label: Admin panelinde gösterilen Türkçe ad
 *   - description: Sefa için açıklama (nerede görünür, ne işe yarar)
 *   - aspectRatio: Önerilen oran (yükleme sırasında bilgi verir)
 *   - dimensions: İdeal piksel boyutu
 *   - category: Admin UI'da grupla
 *
 * Yeni slot eklerken: bu catalog'u güncelle + frontend'de getSiteImage(slot)
 * çağrısını ekle. DB tarafına yeni satır yazmaya gerek yok (slot otomatik
 * kayıt olur ilk upload'da).
 */

export type SlotCategory =
  | "anasayfa"
  | "sayfalar"
  | "sosyal"
  | "blog"
  | "diger";

export interface SiteImageSlot {
  id: string;
  label: string;
  description: string;
  aspectRatio: string; // "16:9", "1:1", "4:3" vs.
  dimensions: { width: number; height: number };
  category: SlotCategory;
  /** Görsel kullanılacağı sayfa (admin paneli linki için) */
  previewPath?: string;
}

export const SITE_IMAGE_SLOTS: SiteImageSlot[] = [
  // ============ Anasayfa ============
  {
    id: "home_hero",
    label: "Anasayfa Hero",
    description:
      "Anasayfa üst alanında — Pim mascot yanında veya yerine gösterilecek ana görsel. Marka kimliğini belirler.",
    aspectRatio: "4:5",
    dimensions: { width: 800, height: 1000 },
    category: "anasayfa",
    previewPath: "/",
  },
  {
    id: "home_etiket_card",
    label: "Anasayfa Etiket Kartı",
    description:
      "Anasayfa ürün kartları bölümünde 'Etiket' kartının arka plan/ön plan görseli.",
    aspectRatio: "4:3",
    dimensions: { width: 800, height: 600 },
    category: "anasayfa",
    previewPath: "/etiket",
  },
  {
    id: "home_sticker_card",
    label: "Anasayfa Sticker Kartı",
    description:
      "Anasayfa ürün kartları bölümünde 'Sticker' kartının arka plan/ön plan görseli.",
    aspectRatio: "4:3",
    dimensions: { width: 800, height: 600 },
    category: "anasayfa",
    previewPath: "/sticker",
  },
  {
    id: "home_instagram_1",
    label: "Anasayfa Instagram 1",
    description: "Anasayfa Instagram bölümünde 1. kare (küçük grid).",
    aspectRatio: "1:1",
    dimensions: { width: 600, height: 600 },
    category: "anasayfa",
    previewPath: "/",
  },
  {
    id: "home_instagram_2",
    label: "Anasayfa Instagram 2",
    description: "Anasayfa Instagram bölümünde 2. kare (küçük grid).",
    aspectRatio: "1:1",
    dimensions: { width: 600, height: 600 },
    category: "anasayfa",
    previewPath: "/",
  },
  {
    id: "home_instagram_3",
    label: "Anasayfa Instagram 3",
    description: "Anasayfa Instagram bölümünde 3. kare (küçük grid).",
    aspectRatio: "1:1",
    dimensions: { width: 600, height: 600 },
    category: "anasayfa",
    previewPath: "/",
  },
  {
    id: "home_instagram_4",
    label: "Anasayfa Instagram 4",
    description: "Anasayfa Instagram bölümünde 4. kare (küçük grid).",
    aspectRatio: "1:1",
    dimensions: { width: 600, height: 600 },
    category: "anasayfa",
    previewPath: "/",
  },
  {
    id: "home_instagram_5",
    label: "Anasayfa Instagram 5",
    description: "Anasayfa Instagram bölümünde 5. kare (küçük grid).",
    aspectRatio: "1:1",
    dimensions: { width: 600, height: 600 },
    category: "anasayfa",
    previewPath: "/",
  },
  {
    id: "home_instagram_6",
    label: "Anasayfa Instagram 6",
    description: "Anasayfa Instagram bölümünde 6. kare (küçük grid).",
    aspectRatio: "1:1",
    dimensions: { width: 600, height: 600 },
    category: "anasayfa",
    previewPath: "/",
  },

  // ============ Sayfalar ============
  {
    id: "sablonlar_hero",
    label: "Şablonlar Hero",
    description:
      "/sablonlar lead magnet sayfasının hero görseli (Pim mascot yerine konacak ana görsel).",
    aspectRatio: "1:1",
    dimensions: { width: 720, height: 720 },
    category: "sayfalar",
    previewPath: "/sablonlar",
  },
  {
    id: "auth_hero",
    label: "Giriş Sayfası Hero",
    description:
      "/auth sayfasının yan panelindeki büyük görsel (login + signup ekranı).",
    aspectRatio: "4:5",
    dimensions: { width: 600, height: 750 },
    category: "sayfalar",
    previewPath: "/auth",
  },
  {
    id: "demo_hero",
    label: "Demo Sayfası Hero",
    description:
      "/demo sayfasında 90sn tanıtım video placeholder'ında gösterilecek görsel (video gelmeden önce).",
    aspectRatio: "16:9",
    dimensions: { width: 1280, height: 720 },
    category: "sayfalar",
    previewPath: "/demo",
  },

  // ============ Sosyal medya / SEO ============
  {
    id: "og_default",
    label: "Open Graph (Sosyal Paylaşım) — Default",
    description:
      "Facebook/X/WhatsApp link paylaşımlarında gösterilecek varsayılan görsel. Sayfa-spesifik og:image yoksa bu kullanılır.",
    aspectRatio: "1.91:1",
    dimensions: { width: 1200, height: 630 },
    category: "sosyal",
    previewPath: "/",
  },
  {
    id: "og_home",
    label: "Open Graph — Anasayfa",
    description:
      "Anasayfa link paylaşımı için özel og:image (default yerine bu çekilir, varsa).",
    aspectRatio: "1.91:1",
    dimensions: { width: 1200, height: 630 },
    category: "sosyal",
    previewPath: "/",
  },

  // ============ Blog ============
  {
    id: "blog_default_hero",
    label: "Blog — Varsayılan Yazı Hero",
    description:
      "Blog yazılarında özel kapak görseli yoksa gösterilecek varsayılan görsel.",
    aspectRatio: "16:9",
    dimensions: { width: 1280, height: 720 },
    category: "blog",
    previewPath: "/blog",
  },
];

/** Slot id → meta lookup */
export function getSlotMeta(slotId: string): SiteImageSlot | undefined {
  return SITE_IMAGE_SLOTS.find((s) => s.id === slotId);
}

/** Kategori bazlı gruplama (admin UI için) */
export function groupSlotsByCategory(): Record<SlotCategory, SiteImageSlot[]> {
  const groups: Record<SlotCategory, SiteImageSlot[]> = {
    anasayfa: [],
    sayfalar: [],
    sosyal: [],
    blog: [],
    diger: [],
  };
  for (const slot of SITE_IMAGE_SLOTS) {
    groups[slot.category].push(slot);
  }
  return groups;
}

/** Kategori Türkçe label */
export const CATEGORY_LABEL: Record<SlotCategory, string> = {
  anasayfa: "Anasayfa",
  sayfalar: "Sayfalar",
  sosyal: "Sosyal medya / SEO",
  blog: "Blog",
  diger: "Diğer",
};
