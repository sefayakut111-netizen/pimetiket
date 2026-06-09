import { getEtiketTypeLanding } from "@/lib/seo/type-landings";
import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  seoOgImageResponse,
} from "@/lib/seo/og-image-template";

export const runtime = "edge";
export const alt = "Etiket baskı · Pim Etiket";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const landing = getEtiketTypeLanding(type);

  if (!landing) {
    return seoOgImageResponse({
      eyebrow: "Etiket",
      title: "Etiket bastır",
      subtitle: "Rulo ve tabaka etiket baskı — kuşe, şeffaf, kraft.",
    });
  }

  return seoOgImageResponse({
    eyebrow: "Etiket",
    title: landing.h1,
    subtitle: landing.description.slice(0, 120),
  });
}
