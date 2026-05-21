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
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Sefa 20 May v68: explicit viewport export. Mobile Safari/Chrome'da
// initial scale + theme color brand kimliği. PWA install için temel.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#1F2937" },
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

  // Sefa 17 May v33: Description + OG güncellendi (hero copy ile uyumlu —
  // "ekosistemi" + AI sohbet odaklı). Keywords genişletildi, "İstanbul
  // Ankara baskı" çıkarıldı (footer'da yer adı yok artık).
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: "Pim Etiket — Markanın Etiketi, Fikrinin Sticker'ı",
      template: "%s · Pim Etiket",
    },
    description:
      "AI destekli dijital baskı ekosistemi. Etiket veya sticker çözümleriniz için Pim ile sohbet edin — fiyat, malzeme, teslim sorularına anında cevap.",
    applicationName: "Pim Etiket",
    authors: [{ name: "Pim Etiket" }],
    generator: "Next.js",
    // Sefa 20 May v68: PWA manifest + favicon + Apple touch
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/pim/pim-etiket-mark-dark.svg", type: "image/svg+xml" },
      ],
      apple: [
        // SVG'yi Apple touch icon olarak da sunarız; ileride 180×180 PNG
        // üretilince yerine geçer.
        { url: "/pim/pim-etiket-mark-dark.svg", sizes: "180x180" },
      ],
      shortcut: ["/pim/pim-etiket-mark-dark.svg"],
    },
    keywords: [
      "AI etiket baskı",
      "yapay zeka destekli dijital baskı",
      "sticker baskı",
      "dijital baskı",
      "rulo etiket baskı",
      "tabaka etiket",
      "die cut sticker",
      "hologram sticker",
      "şeffaf etiket",
      "soft touch etiket",
      "küçük adet etiket baskı",
      "online etiket tasarım",
    ],
    openGraph: {
      type: "website",
      locale: "tr_TR",
      url: SITE_URL,
      siteName: "Pim Etiket",
      title: "Pim Etiket — Markanın Etiketi, Fikrinin Sticker'ı",
      description:
        "AI destekli dijital baskı ekosistemi. Pim ile sohbet et, fiyat ve teslim sorularına anında cevap al.",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: "Pim Etiket",
      description:
        "AI destekli dijital baskı ekosistemi. Etiket ve sticker çözümleri için Pim ile sohbet et.",
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
    // Search engine verification — env'e ekleyince meta tag otomatik basılır
    // Google:  <meta name="google-site-verification" content="..." />
    // Yandex:  <meta name="yandex-verification" content="..." />
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
    },
  };
}

// Sosyal medya URL'leri — Sefa env'e ekleyince Knowledge Graph + sameAs aktif olur.
// Format: virgülle ayrılmış URL listesi:
//   NEXT_PUBLIC_SOCIAL_LINKS=https://instagram.com/pimetiket,https://x.com/pimetiket
const SOCIAL_LINKS = (process.env.NEXT_PUBLIC_SOCIAL_LINKS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && s.startsWith("https://"));

// Sefa 21 May v68 SEO Sprint: Organization schema zenginleştirildi.
// Tam adres (Mesafeli Satış sözleşmesinden), legalName, vatID + email.
// Google Knowledge Graph "Şirket Bilgileri" panel için kritik.
// Telefon eklenecek (BEKLEYEN-ISLER.md — Sefa numarayı verince).
const ORGANIZATION_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Pim Etiket",
  legalName: "SEFA YAKUT KIRTASİYE BASKI TİCARET LİMİTED ŞİRKETİ",
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  description:
    "AI destekli dijital baskı ekosistemi. Etiket ve sticker çözümleri — Türkiye geneli teslimat.",
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
  sameAs: SOCIAL_LINKS,
  // Telefon BEKLEYEN — Sefa numarayı verince:
  // contactPoint: { "@type": "ContactPoint", telephone: "+90-XXX-...", contactType: "customer support" }
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
            {/* Sefa 18 May v68: Frontend caydırıcı koruma — DevTools detect
                + agresif console uyarısı (self-XSS + telif). Production-only. */}
            <CopyProtection />
          </LanguageProvider>
        </ToastProvider>
        {/* Vercel built-in pageview + Core Web Vitals — KVKK gated (sadece
            analytics izni varsa beacon gönderir). Bkz. VercelInsights.tsx. */}
        <VercelInsights />
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
