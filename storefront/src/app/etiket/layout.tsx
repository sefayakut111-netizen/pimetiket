import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Etiket bastır — özel rulo etiket baskı",
  description:
    "Kozmetik, gıda, içecek, parfüm etiketleri. Vinil/kuşe/transparan. AI dosya kontrolü ile 5 iş günü içinde kargoda. 1.000 adetten başla, anlık fiyat hesabı.",
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
