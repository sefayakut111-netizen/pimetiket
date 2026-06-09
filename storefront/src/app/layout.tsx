import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui";
import { LanguageProvider } from "@/lib/i18n/context";
import { CookieConsent } from "@/components/CookieConsent";
import { Analytics } from "@/components/Analytics";
import { VercelInsights } from "@/components/VercelInsights";
import { CopyProtection } from "@/components/security/CopyProtection";
import { getSiteImage } from "@/lib/site-images";
import { getSiteUrl } from "@/lib/site-url";
import { withTrHreflang } from "@/lib/seo/page-metadata";
import { RootJsonLd } from "@/components/seo/RootJsonLd";
import "./globals.css";

const SITE_URL = getSiteUrl();

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  preload: true,
});

// Sefa 20 May v68: explicit viewport export. Mobile Safari/Chrome'da
// initial scale + theme color brand kimliği. PWA install için temel.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#141524" },
  ],
  colorScheme: "light",
};

// generateMetadata async — admin panelinden yüklenen og_default görseli
// varsa Open Graph + Twitter card'a otomatik enjekte edilir.
// Next.js fetch cache: aynı render içinde tekrar çağrılmaz; sayfalar arası
// 60 sn (Supabase REST default) cache'lenir.
export async function generateMetadata(): Promise<Metadata> {
  // Sefa 21 May v68: DB'de og_default varsa onu kullan, YOKSA `images`
  // field'ını tamamen omit et — Next.js o zaman `opengraph-image.tsx`
  // file convention'a düşer (her route'un kendi dinamik PNG'si).
  // Önceden boş array gönderiliyordu, bu file convention'ı bloke ediyordu.
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
    : undefined;

  // Konumlandırma (May 2026): somut kategori — online etiket & sticker baskı,
  // etikette uzman; "ekosistem" kaldırıldı.
  const siteDescription =
    "Türkiye'de online etiket ve sticker baskı. Kuşe, şeffaf, kraft etikette uzman; küçük adetten, AI destekli. Tasarımını yükle ya da şablon seç, baskıya gönder.";

  // Sefa kararı (1 Haz): ana sayfa başlığı ŞİİRSEL kalır (marka). Kategori-net
  // ifade ("Online Etiket & Sticker Baskı") diğer sayfaların kendi title'larında
  // ve description'da kullanılır.
  const siteTitleDefault = "Pim Etiket — Markanın Etiketi, Fikrinin Sticker'ı";

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: siteTitleDefault,
      template: "%s · Pim Etiket",
    },
    description: siteDescription,
    applicationName: "Pim Etiket",
    appleWebApp: {
      capable: true,
      title: "Pim Etiket",
      statusBarStyle: "default",
    },
    authors: [{ name: "Pim Etiket" }],
    generator: "Next.js",
    // Sefa 20 May v68: PWA manifest + favicon + Apple touch
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any", rel: "icon" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { url: "/pim/pim-etiket-mark-dark.svg", type: "image/svg+xml" },
      ],
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      ],
      shortcut: ["/favicon.ico"],
    },
    keywords: [
      "online etiket baskı",
      "etiket baskı",
      "kuşe etiket",
      "şeffaf etiket",
      "kraft etiket",
      "rulo etiket baskı",
      "tabaka etiket",
      "küçük adet etiket baskı",
      "sticker baskı",
      "die cut sticker",
      "hologram sticker",
      "AI destekli etiket baskı",
    ],
    openGraph: {
      type: "website",
      locale: "tr_TR",
      url: SITE_URL,
      siteName: "Pim Etiket",
      title: siteTitleDefault,
      description: siteDescription,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: siteTitleDefault,
      description: siteDescription,
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
    alternates: withTrHreflang("/"),
    category: "shopping",
    // Search engine verification — env'e ekleyince meta tag otomatik basılır
    // Google:  <meta name="google-site-verification" content="..." />
    // Yandex:  <meta name="yandex-verification" content="..." />
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${nunito.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col bg-white text-lacivert">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-full focus:bg-lacivert focus:text-white focus:font-semibold focus:shadow-1"
        >
          İçeriğe atla
        </a>
        <LanguageProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
            <CookieConsent />
            <Analytics />
            {/* Sefa 18 May v68: Frontend caydırıcı koruma — DevTools detect
                + agresif console uyarısı (self-XSS + telif). Production-only. */}
            <CopyProtection />
          </ToastProvider>
        </LanguageProvider>
        {/* Vercel built-in pageview + Core Web Vitals — KVKK gated (sadece
            analytics izni varsa beacon gönderir). Bkz. VercelInsights.tsx. */}
        <VercelInsights />
        <RootJsonLd />
      </body>
    </html>
  );
}
