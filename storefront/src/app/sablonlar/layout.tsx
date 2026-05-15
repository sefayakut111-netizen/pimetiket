import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Ücretsiz Etiket Şablonları — Canva ve Illustrator uyumlu",
  description:
    "60+ ücretsiz etiket ve sticker şablonu. Zeytinyağı, bal, kozmetik, kombucha, butik markalar için Canva/AI/Figma uyumlu hazır tasarımlar. Email bırak, paketi al.",
  alternates: { canonical: "/sablonlar" },
  openGraph: {
    title: "60+ Ücretsiz Etiket Şablonu — Pim Etiket",
    description:
      "Canva ve Illustrator uyumlu hazır şablonlar. 12 kategoride zengin tasarım paketi — ücretsiz indir.",
    url: "/sablonlar",
    type: "website",
  },
};

export default function SablonlarLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
