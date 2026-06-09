/**
 * /sticker Open Graph görseli — özel kesim, holografik, şeffaf sticker.
 */

import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  seoOgImageResponse,
} from "@/lib/seo/og-image-template";

export const runtime = "edge";
export const alt =
  "Sticker bastır — özel kesim, holografik, simli ve şeffaf · Pim Etiket";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OpengraphImage() {
  return seoOgImageResponse({
    eyebrow: "Sticker",
    title: "Özel kesim · holografik · şeffaf",
    subtitle: "25 adetten başlayan vinil sticker — marka, laptop, hediye için.",
    accent: "mercan-gradient",
    footer: "pimetiket.com/sticker →",
  });
}
