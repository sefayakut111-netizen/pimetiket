/**
 * SchemaJsonLd — Schema.org JSON-LD inject helper.
 * Tek bir component ile ürün/FAQ/breadcrumb/article schema'larını sayfaya
 * gömer. SEO için Google'a yapısal veri gönderir.
 *
 * Kullanım:
 *   <SchemaJsonLd data={productSchema(...)} />
 */

interface JsonLdData {
  "@context": string;
  "@type": string;
  [key: string]: unknown;
}

interface Props {
  data: JsonLdData | JsonLdData[];
}

export function SchemaJsonLd({ data }: Props) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ============================================================
// Helper builders
// ============================================================

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

interface FaqItem {
  q: string;
  a: string;
}

export function faqSchema(items: FaqItem[]): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: it.a,
      },
    })),
  };
}

interface ProductSchemaInput {
  name: string;
  description: string;
  category: string;
  image?: string;
  priceFrom: number;
  priceCurrency?: string;
  brand?: string;
  reviewCount?: number;
  ratingValue?: number;
}

export function productSchema(input: ProductSchemaInput): JsonLdData {
  const ld: JsonLdData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    category: input.category,
    brand: {
      "@type": "Brand",
      name: input.brand ?? "Pim Etiket",
    },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: input.priceCurrency ?? "TRY",
      lowPrice: input.priceFrom,
      offerCount: 100,
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: "Pim Etiket",
      },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "TR",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 5,
            maxValue: 10,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 1,
            maxValue: 3,
            unitCode: "DAY",
          },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "TR",
        returnPolicyCategory:
          "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 14,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
        returnPolicyUrl: `${SITE_URL}/iade-degisim-politikasi`,
      },
    },
  };
  if (input.image) {
    ld.image = `${SITE_URL}${input.image}`;
  }
  if (input.ratingValue !== undefined && input.reviewCount !== undefined && input.reviewCount > 0) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: input.ratingValue.toFixed(1),
      reviewCount: input.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }
  return ld;
}

interface BreadcrumbItem {
  label: string;
  url: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[]): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.label,
      item: `${SITE_URL}${it.url}`,
    })),
  };
}

interface ArticleSchemaInput {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  modifiedAt?: string;
  image?: string;
  author?: string;
}

export function articleSchema(input: ArticleSchemaInput): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    url: `${SITE_URL}${input.url}`,
    datePublished: input.publishedAt,
    dateModified: input.modifiedAt ?? input.publishedAt,
    image: input.image ? `${SITE_URL}${input.image}` : undefined,
    author: {
      "@type": "Organization",
      name: input.author ?? "Pim Etiket",
    },
    publisher: {
      "@type": "Organization",
      name: "Pim Etiket",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon.svg`,
      },
    },
  };
}

interface LocalBusinessInput {
  phone?: string;
  address?: string;
  email?: string;
  openingHours?: string;
}

export function localBusinessSchema(
  input: LocalBusinessInput = {}
): JsonLdData {
  const ld: JsonLdData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/#business`,
    name: "Pim Etiket",
    image: `${SITE_URL}/icon.svg`,
    url: SITE_URL,
    priceRange: "₺",
    description:
      "Türkiye'de online etiket ve sticker baskı — etikette uzman, küçük adetten, AI destekli. Türkiye geneli teslimat.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Ankara",
      addressRegion: "Ankara",
      addressCountry: "TR",
      streetAddress: input.address ?? undefined,
    },
    areaServed: {
      "@type": "Country",
      name: "Türkiye",
    },
  };
  if (input.phone) {
    ld.telephone = input.phone;
  }
  if (input.email) {
    ld.email = input.email;
  }
  if (input.openingHours) {
    ld.openingHours = input.openingHours;
  }
  return ld;
}
