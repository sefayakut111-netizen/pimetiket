import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TypeLandingPage } from "@/components/seo/TypeLandingPage";
import { withSocialMetadata } from "@/lib/seo/page-metadata";
import {
  STICKER_TYPE_SLUGS,
  getStickerTypeLanding,
} from "@/lib/seo/type-landings";

interface Props {
  params: Promise<{ type: string }>;
}

export function generateStaticParams() {
  return STICKER_TYPE_SLUGS.map((type) => ({ type }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = await params;
  const landing = getStickerTypeLanding(type);
  if (!landing) return { title: "Sayfa bulunamadı" };
  const canonical = `/sticker/${type}`;
  const title = `${landing.h1} — Pim Etiket`;
  return {
    title,
    description: landing.description,
    alternates: { canonical },
    ...withSocialMetadata({
      title,
      description: landing.description,
      canonical,
    }),
  };
}

export const revalidate = 3600;

export default async function StickerTypeLandingPage({ params }: Props) {
  const { type } = await params;
  const landing = getStickerTypeLanding(type);
  if (!landing) notFound();

  return (
    <TypeLandingPage landing={landing} hubLabel="Sticker" hubHref="/sticker" />
  );
}

export const dynamicParams = false;
