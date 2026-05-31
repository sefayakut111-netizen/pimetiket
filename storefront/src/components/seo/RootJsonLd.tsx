import { getSeoSiteConfig } from "@/lib/seo/site-config";
import { getSiteUrl } from "@/lib/site-url";

export async function RootJsonLd() {
  const siteUrl = getSiteUrl();
  const seo = await getSeoSiteConfig();

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Pim Etiket",
    legalName: "SEFA YAKUT KIRTASİYE BASKI TİCARET LİMİTED ŞİRKETİ",
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`,
    description:
      "Türkiye'de online etiket ve sticker baskı hizmeti — etiket baskıda uzman, küçük adet dahil, AI destekli. Türkiye geneli teslimat.",
    email: "info@pimetiket.com",
    vatID: "7580607612",
    address: {
      "@type": "PostalAddress",
      streetAddress:
        "Workinton Ankara Söğütözü, Beştepeler Mah. Nergis Sok. No:7/2 ViaFlat İş Merkezi Ofis: 27-28",
      addressLocality: "Çankaya",
      addressRegion: "Ankara",
      postalCode: "06510",
      addressCountry: "TR",
    },
    ...(seo.socialLinks.length > 0 ? { sameAs: seo.socialLinks } : {}),
    contactPoint: {
      "@type": "ContactPoint",
      telephone: seo.contactPhone ?? "+90 531 934 01 23",
      contactType: "customer support",
      areaServed: "TR",
      availableLanguage: ["tr"],
    },
  };

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Pim Etiket",
    url: siteUrl,
    inLanguage: "tr-TR",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/blog?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }}
      />
    </>
  );
}
