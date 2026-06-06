import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SchemaJsonLd, productSchema, breadcrumbSchema } from "@/components/SchemaJsonLd";
import { withSocialMetadata } from "@/lib/seo/page-metadata";

// Sefa 21 May v68 SEO Sprint: ISR — sayfa 1 saatte bir yeniden üretilir
// (admin product_cards değiştirirse yenilenir). TTFB 1.2s → ~0.3s düşmesi
// beklenir; SEO + UX kazancı.
export const revalidate = 3600;

// Sefa 17 May P1-7: Bilingual metadata (TR primary + EN alternate).
// Locale prefix route'lar olmadığı için server-side EN metadata seçimi
// zor; primary TR title + alternates ile EN keyword'leri ekledik.
// SEO için ana title TR (Türkiye odaklı), EN aramalar için EN versiyon
// description'da da bulunur.
// Sefa 21 May v68 (site denetim P2 #12 + #4): "roll labels" yerine
// "rulo + tabaka" — bu sayfa hem rulo hem tabaka grid'i içeriyor.
// Teslim süresi 5 → 10 iş günü (site geneli).
const title = "Etiket bastır — rulo ve tabaka etiket baskı";
const description =
  "Rulo ve tabaka etiket: kuşe, vinil, şeffaf malzemeler. 1.000 adetten, AI dosya kontrolü, 10 iş günü içinde kargoda.";
const canonical = "/etiket";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  ...withSocialMetadata({ title, description, canonical }),
};

// Sefa 21 May v68 SEO Sprint: Schema.org Product + BreadcrumbList.
// Google Rich Results "Product" göstermek için kritik (fiyat + yıldız).
// priceFrom — 1.000 adet × ~50 kr ≈ 500 TL tahmin (mevcut tier'larından).
// AggregateRating ileride DB'den çekilir; şimdilik omit.
const ETIKET_SCHEMA = productSchema({
  name: "Etiket — rulo ve tabaka etiket baskı",
  description:
    "Kozmetik, gıda, içecek ve parfüm için özel kesim etiket. Vinil, kuşe, şeffaf malzemeler. AI dosya kontrolü ile 10 iş günü içinde kargoda.",
  category: "Print/Labels",
  priceFrom: 500,
  priceCurrency: "TRY",
  brand: "Pim Etiket",
});

const ETIKET_BREADCRUMB = breadcrumbSchema([
  { label: "Anasayfa", url: "/" },
  { label: "Etiket", url: "/etiket" },
]);

export default function EtiketLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SchemaJsonLd data={[ETIKET_SCHEMA, ETIKET_BREADCRUMB]} />
      {children}
    </>
  );
}
