import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui";
import { LanguageProvider } from "@/lib/i18n/context";
import { CookieConsent } from "@/components/CookieConsent";
import { Analytics } from "@/components/Analytics";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { getSiteImage } from "@/lib/site-images";
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// generateMetadata async — admin panelinden yüklenen og_default görseli
// varsa Open Graph + Twitter card'a otomatik enjekte edilir.
// Next.js fetch cache: aynı render içinde tekrar çağrılmaz; sayfalar arası
// 60 sn (Supabase REST default) cache'lenir.
export async function generateMetadata(): Promise<Metadata> {
  const og = await getSiteImage("og_default");
  const ogImages = og
    ? [
        {
          url: og.publicUrl,
          width: og.width ?? 1200,
          height: og.height ?? 630,
          alt: og.altText ?? "Pim Etiket",
        },
      ]
    : [];

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: "Pim Etiket — Markanın etiketi, fikrinin sticker'ı",
      template: "%s · Pim Etiket",
    },
    description:
      "Etiket 1.000'den, sticker 25'ten. AI destekli dijital baskı — küçük markalar ve büyük ekipler için.",
    applicationName: "Pim Etiket",
    authors: [{ name: "Pim Etiket" }],
    generator: "Next.js",
    keywords: [
      "etiket baskı",
      "sticker baskı",
      "dijital baskı",
      "rulo etiket",
      "ürün etiketi",
      "İstanbul Ankara baskı",
      "küçük marka etiket",
    ],
    openGraph: {
      type: "website",
      locale: "tr_TR",
      url: SITE_URL,
      siteName: "Pim Etiket",
      title: "Pim Etiket — Markanın etiketi, fikrinin sticker'ı",
      description:
        "Etiket 1.000'den, sticker 25'ten. AI destekli dijital baskı — küçük markalar ve büyük ekipler için.",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: "Pim Etiket",
      description:
        "Etiket 1.000'den, sticker 25'ten. AI destekli dijital baskı atölyesi.",
      images: og ? [og.publicUrl] : undefined,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical: "/",
    },
    category: "shopping",
    // Google Search Console verification — Sefa env'e ekleyince aktif olur
    // Format: <meta name="google-site-verification" content="..." />
    verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
      : undefined,
  };
}

// Sosyal medya URL'leri — Sefa env'e ekleyince Knowledge Graph + sameAs aktif olur.
// Format: virgülle ayrılmış URL listesi:
//   NEXT_PUBLIC_SOCIAL_LINKS=https://instagram.com/pimetiket,https://x.com/pimetiket
const SOCIAL_LINKS = (process.env.NEXT_PUBLIC_SOCIAL_LINKS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && s.startsWith("https://"));

const ORGANIZATION_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Pim Etiket",
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  description:
    "AI destekli dijital baskı — etiket ve sticker. İstanbul ve Ankara fason ortakları üzerinden Türkiye geneli teslimat.",
  address: {
    "@type": "PostalAddress",
    addressRegion: "Ankara",
    addressCountry: "TR",
  },
  sameAs: SOCIAL_LINKS,
};

const WEBSITE_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Pim Etiket",
  url: SITE_URL,
  inLanguage: "tr-TR",
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-lacivert">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-full focus:bg-lacivert focus:text-white focus:font-semibold focus:shadow-1"
        >
          İçeriğe atla
        </a>
        <ToastProvider>
          <LanguageProvider>
            <AppShell>{children}</AppShell>
            <CookieConsent />
            <Analytics />
          </LanguageProvider>
        </ToastProvider>
        {/* Vercel built-in: ücretsiz pageview + Core Web Vitals (LCP/CLS/INP) */}
        <SpeedInsights />
        <VercelAnalytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_LD) }}
        />
      </body>
    </html>
  );
}
