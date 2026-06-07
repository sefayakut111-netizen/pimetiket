import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  ETIKET_ENABLED,
  ETIKET_RULO_ENABLED,
  ETIKET_TABAKA_ENABLED,
} from "@/lib/etiket-feature-flags";
import { TypeLandingPage } from "@/components/seo/TypeLandingPage";
import { withSocialMetadata } from "@/lib/seo/page-metadata";
import {
  ETIKET_TYPE_LANDINGS,
  ETIKET_TYPE_SLUGS,
  getEtiketTypeLanding,
} from "@/lib/seo/type-landings";

interface Props {
  params: Promise<{ type: string }>;
}

export function generateStaticParams() {
  return ETIKET_TYPE_SLUGS.map((type) => ({ type }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = await params;
  const landing = getEtiketTypeLanding(type);
  if (!landing) return { title: "Sayfa bulunamadı" };
  const canonical = `/etiket/${type}`;
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

export default async function EtiketTypeLandingPage({ params }: Props) {
  if (!ETIKET_ENABLED) redirect("/etiket");

  const { type } = await params;
  if (type === "rulo" && !ETIKET_RULO_ENABLED) redirect("/etiket");
  if (type === "tabaka" && !ETIKET_TABAKA_ENABLED) redirect("/etiket");
  const landing = getEtiketTypeLanding(type);
  if (!landing) notFound();

  return (
    <TypeLandingPage landing={landing} hubLabel="Etiket" hubHref="/etiket" />
  );
}

/** yapilandir ile çakışmayı önle — sadece tanımlı landing slug'ları */
export const dynamicParams = false;
