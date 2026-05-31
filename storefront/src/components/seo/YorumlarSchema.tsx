import { SchemaJsonLd, productSchema } from "@/components/SchemaJsonLd";
import { getPublishedReviewStats } from "@/lib/reviews-server";

/** /yorumlar — AggregateRating JSON-LD (reviewCount > 0 ise) */
export async function YorumlarSchema() {
  const stats = await getPublishedReviewStats();
  if (stats.count === 0) return null;

  return (
    <SchemaJsonLd
      data={productSchema({
        name: "Pim Etiket — Etiket ve sticker baskı",
        description:
          "Türkiye'de online etiket ve sticker baskı hizmeti. Müşteri yorumları ve değerlendirmeler.",
        category: "Print/Labels",
        priceFrom: 350,
        ratingValue: stats.averageRating,
        reviewCount: stats.count,
      })}
    />
  );
}
