/**
 * /etiket Open Graph görseli — rulo, tabaka etiket teması.
 */

import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  seoOgImageResponse,
} from "@/lib/seo/og-image-template";

export const runtime = "edge";
export const alt = "Etiket bastır — rulo ve tabaka etiket baskı · Pim Etiket";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OpengraphImage() {
  return seoOgImageResponse({
    eyebrow: "Etiket",
    title: "Rulo ve tabaka etiket baskı",
    subtitle:
      "Vinil, kuşe, şeffaf — kozmetik, gıda, içecek için AI dosya kontrolü.",
    accent: "krem",
    footer: "pimetiket.com/etiket →",
  });
}
