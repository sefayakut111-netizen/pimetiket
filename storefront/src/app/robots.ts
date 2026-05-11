import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/panelim",
          "/profil",
          "/adreslerim",
          "/fatura-bilgileri",
          "/siparislerim",
          "/siparis/",
          "/sepet",
          "/odeme",
          "/odeme-sonuc",
          "/sifre-sifirla",
          "/auth",
          "/fason/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
