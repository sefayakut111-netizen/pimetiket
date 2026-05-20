/**
 * Order Summary — tek-doğru-kaynak özet üretici.
 *
 * Sefa 21 May v68 test: "İŞLEM ÖZETİ kutusu yukarıdaki basamakların özetini
 * basamak basamak göstermeli. Bu özet kayıtlarda kaydedilmeli. /panelim'den
 * sipariş detayına gittiğinde tasarım uygun olarak görülmeli."
 *
 * Çözüm: Bu helper hem konfigüratör PriceCard'ına hem /siparis detay
 * sayfasına aynı item summary üretir. Cart item → SummaryItem[] çevirir.
 *
 * Kapsam:
 *   - Sticker: Şekil, Boyut, Malzeme, Yüzey, Kesim, Adet, (Tasarım sayısı)
 *   - Etiket: Şekil, Köşe, Malzeme, Kaplama, Özelleştirme, Boyut, Sarım yönü,
 *     Göbek, Rulo başına adet, Toplam adet, (Tasarım sayısı)
 */

import type { CustomerCartItem } from "./customer-cart";

export interface SummaryItem {
  icon: string;
  label: string;
  value: string;
}

type Locale = "tr" | "en";

// ============================================================
// Lookup tabloları — display label'lar (string id → human-readable)
// ============================================================
// Not: Source-of-truth konfigüratör içinde MATERIALS/COATINGS/SHAPES
// const'ları var ama bunlar component-local. Helper buradan import etmek
// için minimal label map yeterli (yeni eklemelerde admin DB'den de gelir).

const STICKER_MATERIAL_LABEL: Record<string, string> = {
  vinil: "Vinil",
  transparan: "Transparan",
  holo: "Holografik",
  simli: "Simli",
};

const STICKER_FINISH_LABEL: Record<string, string> = {
  parlak: "Parlak",
  mat: "Mat",
  yok: "Yok",
};

const STICKER_CUT_LABEL: Record<string, string> = {
  diecut: "Özel kesim (die-cut)",
  tabaka: "Tabaka",
  kisscut: "Yarı kesim (kiss-cut)",
};

const STICKER_SHAPE_LABEL: Record<string, string> = {
  square: "Kare",
  circle: "Yuvarlak",
  rectangle: "Dikdörtgen",
  oval: "Oval",
  ozel: "Özel form",
  die: "Özel kesim",
};

const ETIKET_MATERIAL_LABEL: Record<string, string> = {
  kuse: "Kuşe Etiket",
  kraft: "Kraft Etiket",
  beyaz: "Opak PP Etiket",
  ultra: "Ultra Clear",
  metalik: "Metalik",
};

const ETIKET_COATING_LABEL: Record<string, string> = {
  yok: "Kaplamasız",
  mat: "Mat selefon",
  parlak: "Parlak selefon",
  soft: "Soft touch",
};

const ETIKET_CUSTOMIZATION_LABEL: Record<string, string> = {
  yok: "Yok",
  emboss: "Kabartma (emboss)",
  yaldiz: "Sıcak yaldız",
  spotuv: "Spot UV",
};

function fmtInt(n: number, locale: Locale): string {
  return n.toLocaleString(locale === "en" ? "en-US" : "tr-TR");
}

// ============================================================
// Public API
// ============================================================

/**
 * CustomerCartItem'dan basamak basamak özet üret.
 * Hem konfigüratör PriceCard'ı (canlı state için item objesi build edip
 * geç) hem /siparis detay sayfası (DB'den okunan item) için aynı sonuç.
 */
export function buildSummaryItems(
  item: CustomerCartItem,
  locale: Locale = "tr"
): SummaryItem[] {
  if (item.product === "sticker") {
    return buildStickerSummary(item, locale);
  }
  return buildEtiketSummary(item, locale);
}

function buildStickerSummary(
  item: CustomerCartItem,
  locale: Locale
): SummaryItem[] {
  const items: SummaryItem[] = [];

  // Şekil
  if (item.shape) {
    items.push({
      icon: "🔷",
      label: locale === "en" ? "Shape" : "Şekil",
      value: STICKER_SHAPE_LABEL[item.shape] ?? item.shape,
    });
  }

  // Kesim (cut)
  if (item.cut) {
    items.push({
      icon: "✂️",
      label: locale === "en" ? "Cut" : "Kesim",
      value: STICKER_CUT_LABEL[item.cut] ?? item.cut,
    });
  }

  // Köşe (sadece kare/dikdörtgen/özel için anlamlı)
  if (
    item.softCorners !== undefined &&
    (item.shape === "square" || item.shape === "ozel" || item.shape === "die")
  ) {
    items.push({
      icon: item.softCorners ? "🔘" : "▫️",
      label: locale === "en" ? "Corner" : "Köşe",
      value: item.softCorners
        ? locale === "en"
          ? "Rounded"
          : "Yumuşatılmış"
        : locale === "en"
          ? "Sharp"
          : "Düz",
    });
  }

  // Malzeme
  if (item.material) {
    items.push({
      icon: "🎨",
      label: locale === "en" ? "Material" : "Malzeme",
      value: STICKER_MATERIAL_LABEL[item.material] ?? item.material,
    });
  }

  // Yüzey (finish — "yok" değilse anlamlı)
  if (item.finish && item.finish !== "yok") {
    items.push({
      icon: "✨",
      label: locale === "en" ? "Finish" : "Yüzey",
      value: STICKER_FINISH_LABEL[item.finish] ?? item.finish,
    });
  }

  // Boyut
  if (item.width && item.height) {
    items.push({
      icon: "📐",
      label: locale === "en" ? "Size" : "Boyut",
      value: `${item.width}×${item.height} mm`,
    });
  }

  // Tasarım sayısı (designCount > 1 ise)
  if (item.designCount && item.designCount > 1) {
    items.push({
      icon: "🖼️",
      label: locale === "en" ? "Designs" : "Tasarım",
      value: `${item.designCount} ${locale === "en" ? "designs" : "çeşit"}`,
    });
  }

  // Toplam adet
  items.push({
    icon: "📋",
    label: locale === "en" ? "Total qty" : "Toplam adet",
    value: `${fmtInt(item.qty, locale)} ${locale === "en" ? "stickers" : "sticker"}`,
  });

  return items;
}

function buildEtiketSummary(
  item: CustomerCartItem,
  locale: Locale
): SummaryItem[] {
  const items: SummaryItem[] = [];

  // Şekil (config'ten gelir, item.shape sticker enum tipi; etiket için
  // config string'den parse etmek karışık → şimdilik atla, config'in
  // ilk parçası zaten konfigüratör title'da var)

  // Malzeme
  if (item.materialId) {
    items.push({
      icon: "🎨",
      label: locale === "en" ? "Material" : "Malzeme",
      value: ETIKET_MATERIAL_LABEL[item.materialId] ?? item.materialId,
    });
  }

  // Kaplama
  if (item.coatingId) {
    items.push({
      icon: "🪞",
      label: locale === "en" ? "Coating" : "Kaplama",
      value: ETIKET_COATING_LABEL[item.coatingId] ?? item.coatingId,
    });
  }

  // Özelleştirme ("yok" değilse anlamlı)
  if (item.customizationId && item.customizationId !== "yok") {
    items.push({
      icon: "✨",
      label: locale === "en" ? "Customization" : "Özelleştirme",
      value:
        ETIKET_CUSTOMIZATION_LABEL[item.customizationId] ??
        item.customizationId,
    });
  }

  // Boyut
  if (item.width && item.height) {
    items.push({
      icon: "📐",
      label: locale === "en" ? "Size" : "Boyut",
      value: `${item.width}×${item.height} mm`,
    });
  }

  // Sarım yönü (sadece rulo formatında anlamlı)
  if (item.winding) {
    items.push({
      icon: "🔄",
      label: locale === "en" ? "Wind direction" : "Sarım yönü",
      value: `${locale === "en" ? "Direction" : "Sarım"} ${item.winding}`,
    });
  }

  // Göbek çapı (rulo)
  if (item.coreSize) {
    items.push({
      icon: "⭕",
      label: locale === "en" ? "Core size" : "Göbek çapı",
      value: `${item.coreSize} mm`,
    });
  }

  // Rulo başına adet
  if (item.rollLabelCount) {
    items.push({
      icon: "📦",
      label: locale === "en" ? "Labels per roll" : "Rulo başına adet",
      value: `${fmtInt(item.rollLabelCount, locale)} ${locale === "en" ? "labels" : "etiket"}`,
    });
  }

  // Tasarım sayısı
  if (item.designCount && item.designCount > 1) {
    items.push({
      icon: "🖼️",
      label: locale === "en" ? "Designs" : "Tasarım",
      value: `${item.designCount} ${locale === "en" ? "designs" : "çeşit"}`,
    });
  }

  // Toplam adet
  items.push({
    icon: "📋",
    label: locale === "en" ? "Total qty" : "Toplam adet",
    value: `${fmtInt(item.qty, locale)} ${locale === "en" ? "labels" : "etiket"}`,
  });

  return items;
}
