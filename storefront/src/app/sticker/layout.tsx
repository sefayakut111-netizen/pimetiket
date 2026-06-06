import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SchemaJsonLd, productSchema, breadcrumbSchema } from "@/components/SchemaJsonLd";
import { withSocialMetadata } from "@/lib/seo/page-metadata";

// Sefa 21 May v68 SEO Sprint: ISR (1 saat) — TTFB iyileştirme.
export const revalidate = 3600;

// Sefa 21 May v68 (ürün denetim P2 #14): title 3 ürün vurguluyordu (die-cut,
// holo, transparan). Sayfa 11 ürün gösteriyor — title daha kapsayıcı.
const title = "Sticker bastır — özel kesim, holografik ve şeffaf sticker";
const description =
  "Die-cut, kare, yuvarlak ve özel kesim sticker. 25 adetten, vinil, holografik, şeffaf malzemeler. AI dosya kontrolü, 5 iş günü kargoda.";
const canonical = "/sticker";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  ...withSocialMetadata({ title, description, canonical }),
};

// Sefa 21 May v68 SEO Sprint: Schema.org Product + BreadcrumbList.
// priceFrom — 25 adet sticker × ~12 TL ≈ 300 TL tahmin (tier başlangıç).
const STICKER_SCHEMA = productSchema({
  name: "Sticker — özel kesim, holografik, şeffaf ve simli sticker",
  description:
    "25 adetten başlayan özel kesim, kare, yuvarlak, oval, bumper, yarı kesim ve karma sticker. Vinil, holografik, şeffaf, simli. AI dosya kontrolü.",
  category: "Print/Stickers",
  priceFrom: 300,
  priceCurrency: "TRY",
  brand: "Pim Etiket",
});

const STICKER_BREADCRUMB = breadcrumbSchema([
  { label: "Anasayfa", url: "/" },
  { label: "Sticker", url: "/sticker" },
]);

export default function StickerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SchemaJsonLd data={[STICKER_SCHEMA, STICKER_BREADCRUMB]} />
      {children}
    </>
  );
}
