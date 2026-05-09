import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui";
import { LanguageProvider } from "@/lib/i18n/context";
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Pim Etiket — Markanın etiketi, fikrinin sticker'ı",
    template: "%s · Pim Etiket",
  },
  description:
    "1000 adetten başlayan, AI destekli dijital baskı. Bursa'dan, küçük markalar için.",
  applicationName: "Pim Etiket",
  authors: [{ name: "Pim Etiket" }],
  generator: "Next.js",
  keywords: [
    "etiket baskı",
    "sticker baskı",
    "dijital baskı",
    "rulo etiket",
    "ürün etiketi",
    "Bursa baskı",
    "küçük marka etiket",
  ],
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: SITE_URL,
    siteName: "Pim Etiket",
    title: "Pim Etiket — Markanın etiketi, fikrinin sticker'ı",
    description:
      "1000 adetten başlayan, AI destekli dijital baskı. Bursa'dan, küçük markalar için.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pim Etiket",
    description:
      "1000 adetten başlayan, AI destekli dijital baskı. Bursa'dan.",
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
};

const ORGANIZATION_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Pim Etiket",
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  description:
    "Türkiye'nin akıllı dijital baskı atölyesi — etiket ve sticker baskı.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Bursa",
    addressCountry: "TR",
  },
  sameAs: [],
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
          </LanguageProvider>
        </ToastProvider>
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
