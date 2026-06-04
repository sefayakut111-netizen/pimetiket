/**
 * Sticker konfigüratör ürün adı — h1 + document title için ortak mantık.
 * URL: cut, shape, material, sayfa query params.
 */

export interface StickerProductNameParams {
  cut?: string;
  shape?: string;
  material?: string;
  sayfa?: string;
}

export function getStickerProductName(
  params: StickerProductNameParams,
  locale: "tr" | "en" = "tr"
): string {
  const isEn = locale === "en";
  const { cut, shape, material, sayfa } = params;

  if (sayfa === "1") return isEn ? "Sticker Page" : "Sticker Sayfası";

  if (cut === "tabaka") {
    if (material === "transparan")
      return isEn ? "Clear Sticker Sheet" : "Şeffaf Sticker Sayfası";
    if (material === "holo")
      return isEn ? "Holographic Sticker Sheet" : "Hologram Sticker Sayfası";
    if (material === "simli")
      return isEn ? "Glitter Sticker Sheet" : "Simli Sticker Sayfası";
    const tabakaShapeMap: Record<string, [string, string]> = {
      circle: ["Round Label Sheet", "Yuvarlak Etiket Sayfası"],
      square: ["Square Label Sheet", "Kare Etiket Sayfası"],
      rectangle: ["Rectangular Label Sheet", "Dikdörtgen Etiket Sayfası"],
      ozel: ["Custom Die-Cut Sticker Sheet", "Özel Kesim Sticker Sayfası"],
    };
    const [en, tr] = tabakaShapeMap[shape ?? ""] ?? ["Sticker Sheet", "Sticker Sayfası"];
    return isEn ? en : tr;
  }

  if (cut === "kartli") return isEn ? "Kiss-Cut Single" : "Kartlı Sticker";
  if (cut === "kisscut") return isEn ? "Kiss-Cut Sticker" : "Yarı Kesim Sticker";
  if (material === "holo") return isEn ? "Holographic Sticker" : "Holografik Sticker";
  if (material === "simli") return isEn ? "Glitter Sticker" : "Simli Sticker";
  if (material === "transparan") return isEn ? "Clear Sticker" : "Şeffaf Sticker";
  if (shape === "bumper") return "Bumper Sticker";

  const shapeMap: Record<string, [string, string]> = {
    diecut: ["Die-Cut", "Özel Kesim"],
    die: ["Die-Cut", "Özel Kesim"],
    ozel: ["Die-Cut", "Özel Kesim"],
    circle: ["Circle", "Yuvarlak"],
    square: ["Square", "Kare"],
    rectangle: ["Rectangle", "Dikdörtgen"],
    oval: ["Oval", "Oval"],
  };
  const [en, tr] = shapeMap[shape ?? ""] ?? ["Die-Cut", "Özel Kesim"];
  return isEn ? `${en} Sticker` : `${tr} Sticker`;
}
