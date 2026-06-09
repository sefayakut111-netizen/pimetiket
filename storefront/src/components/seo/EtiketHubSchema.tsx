import { SchemaJsonLd, productSchema, breadcrumbSchema } from "@/components/SchemaJsonLd";
import { getPublishedReviewStats } from "@/lib/reviews-server";

/** /etiket hub — Product + Breadcrumb (alt route'larda layout'ta değil) */
export async function EtiketHubSchema() {
  const stats = await getPublishedReviewStats();

  return (
    <SchemaJsonLd
      data={[
        productSchema({
          name: "Etiket — rulo ve tabaka etiket baskı",
          description:
            "Kozmetik, gıda, içecek ve parfüm için özel kesim etiket. Vinil, kuşe, şeffaf malzemeler. AI dosya kontrolü ile 10 iş günü içinde kargoda.",
          category: "Print/Labels",
          priceFrom: 500,
          brand: "Pim Etiket",
          url: "/etiket",
          ratingValue: stats.count > 0 ? stats.averageRating : undefined,
          reviewCount: stats.count > 0 ? stats.count : undefined,
        }),
        breadcrumbSchema([
          { label: "Anasayfa", url: "/" },
          { label: "Etiket", url: "/etiket" },
        ]),
      ]}
    />
  );
}
