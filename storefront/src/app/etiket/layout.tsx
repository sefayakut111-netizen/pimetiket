import type { Metadata } from "next";
import type { ReactNode } from "react";

// Sefa 17 May P1-7: Bilingual metadata (TR primary + EN alternate).
// Locale prefix route'lar olmadığı için server-side EN metadata seçimi
// zor; primary TR title + alternates ile EN keyword'leri ekledik.
// SEO için ana title TR (Türkiye odaklı), EN aramalar için EN versiyon
// description'da da bulunur.
// Sefa 21 May v68 (site denetim P2 #12 + #4): "roll labels" yerine
// "rulo + tabaka" — bu sayfa hem rulo hem tabaka grid'i içeriyor.
// Teslim süresi 5 → 10 iş günü (site geneli).
export const metadata: Metadata = {
  title: "Etiket bastır — rulo ve tabaka etiket baskı · Custom labels",
  description:
    "Kozmetik, gıda, içecek, parfüm etiketleri. Vinil/kuşe/şeffaf. AI dosya kontrolü, 10 iş günü kargoda. 1.000 adetten. — Custom roll and sheet labels with AI file check.",
  alternates: { canonical: "/etiket" },
  openGraph: {
    title: "Etiket bastır — Pim Etiket",
    description:
      "Vinil, kuşe, şeffaf etiket. 1.000 adetten, 10 iş günü içinde kargoda. AI dosya kontrolü.",
    type: "website",
    url: "/etiket",
  },
  twitter: {
    card: "summary_large_image",
    title: "Etiket bastır — Pim Etiket",
    description:
      "Vinil, kuşe, şeffaf etiket. 1.000 adetten, 10 iş günü içinde kargoda.",
  },
};

export default function EtiketLayout({ children }: { children: ReactNode }) {
  return children;
}
