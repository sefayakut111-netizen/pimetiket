import { getStickerTypeLanding } from "@/lib/seo/type-landings";
import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  seoOgImageResponse,
} from "@/lib/seo/og-image-template";

export const runtime = "edge";
export const alt = "Sticker baskı · Pim Etiket";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const landing = getStickerTypeLanding(type);

  if (!landing) {
    return seoOgImageResponse({
      eyebrow: "Sticker",
      title: "Sticker bastır",
      subtitle: "Die-cut, holografik, transparan sticker baskı.",
      accent: "krem",
    });
  }

  return seoOgImageResponse({
    eyebrow: "Sticker",
    title: landing.h1,
    subtitle: landing.description.slice(0, 120),
    accent: "krem",
  });
}
