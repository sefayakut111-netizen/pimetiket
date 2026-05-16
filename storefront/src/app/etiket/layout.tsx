import type { Metadata } from "next";
import type { ReactNode } from "react";

// Sefa 17 May P1-7: Bilingual metadata (TR primary + EN alternate).
// Locale prefix route'lar olmadığı için server-side EN metadata seçimi
// zor; primary TR title + alternates ile EN keyword'leri ekledik.
// SEO için ana title TR (Türkiye odaklı), EN aramalar için EN versiyon
// description'da da bulunur.
export const metadata: Metadata = {
  title: "Etiket bastır — özel rulo etiket baskı · Custom roll labels",
  description:
    "Kozmetik, gıda, içecek, parfüm etiketleri. Vinil/kuşe/transparan. AI dosya kontrolü, 5 iş günü kargoda. 1.000 adetten. — Custom roll labels with AI file check, 5 business day shipping.",
  alternates: { canonical: "/etiket" },
  openGraph: {
    title: "Etiket bastır — Pim Etiket",
    description:
      "Vinil, kuşe, transparan etiket. 1.000 adetten, 5 iş günü içinde kargoda. AI dosya kontrolü.",
    type: "website",
    url: "/etiket",
  },
  twitter: {
    card: "summary_large_image",
    title: "Etiket bastır — Pim Etiket",
    description:
      "Vinil, kuşe, transparan etiket. 1.000 adetten, 5 iş günü içinde kargoda.",
  },
};

export default function EtiketLayout({ children }: { children: ReactNode }) {
  return children;
}
