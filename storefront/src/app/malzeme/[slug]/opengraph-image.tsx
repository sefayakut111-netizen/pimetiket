import { getMaterialBySlug } from "@/lib/seo/materials";
import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  seoOgImageResponse,
} from "@/lib/seo/og-image-template";

export const runtime = "edge";
export const alt = "Malzeme etiket ve sticker baskı · Pim Etiket";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const material = getMaterialBySlug(slug);

  if (!material) {
    return seoOgImageResponse({
      eyebrow: "Malzeme",
      title: "Etiket & sticker malzemeleri",
      subtitle: "Kuşe, kraft, şeffaf, holografik ve daha fazlası.",
      accent: "krem",
    });
  }

  return seoOgImageResponse({
    eyebrow: "Malzeme",
    title: `${material.name} etiket & sticker`,
    subtitle: material.description.slice(0, 120),
    accent: "krem",
  });
}
