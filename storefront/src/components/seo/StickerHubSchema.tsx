import { SchemaJsonLd, productSchema, breadcrumbSchema } from "@/components/SchemaJsonLd";
import { getPublishedReviewStats } from "@/lib/reviews-server";

/** /sticker hub — Product + Breadcrumb (alt route'larda layout'ta değil) */
export async function StickerHubSchema() {
  const stats = await getPublishedReviewStats();

  return (
    <SchemaJsonLd
      data={[
        productSchema({
          name: "Sticker — özel kesim, holografik, şeffaf ve simli sticker",
          description:
            "25 adetten başlayan özel kesim, kare, yuvarlak, oval, bumper, yarı kesim ve karma sticker. Vinil, holografik, şeffaf, simli. AI dosya kontrolü.",
          category: "Print/Stickers",
          priceFrom: 300,
          brand: "Pim Etiket",
          url: "/sticker",
          ratingValue: stats.count > 0 ? stats.averageRating : undefined,
          reviewCount: stats.count > 0 ? stats.count : undefined,
        }),
        breadcrumbSchema([
          { label: "Anasayfa", url: "/" },
          { label: "Sticker", url: "/sticker" },
        ]),
      ]}
    />
  );
}
