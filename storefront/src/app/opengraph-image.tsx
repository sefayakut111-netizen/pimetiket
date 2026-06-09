/**
 * Anasayfa Open Graph + Twitter Card görseli (Next 16 file convention).
 */

import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  seoOgImageResponse,
} from "@/lib/seo/og-image-template";

export const runtime = "edge";
export const alt = "Pim Etiket — Markanın Etiketi, Fikrinin Stickerı";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OpengraphImage() {
  return seoOgImageResponse({
    eyebrow: "Pim Etiket",
    title: "Markanın etiketi, fikrinin stickerı",
    subtitle:
      "Türkiye'de online etiket ve sticker baskı — etikette uzman, küçük adetten, AI destekli.",
  });
}
