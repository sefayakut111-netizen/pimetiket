import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sticker bastır — die-cut, holo, transparan",
  description:
    "25 adetten başlayan tekli die-cut veya tabakada sticker baskı. Vinil/holo/transparan/simli. AI dosya kontrolü ile 5 iş günü içinde kargoda.",
  alternates: { canonical: "/sticker" },
  openGraph: {
    title: "Sticker bastır — Pim Etiket",
    description:
      "Die-cut, tabaka, vinil, holo, transparan. 25 adetten, 5 iş günü içinde kargoda.",
    type: "website",
    url: "/sticker",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sticker bastır — Pim Etiket",
    description: "25 adetten, 5 iş günü içinde kargoda. AI dosya kontrolü.",
  },
};

export default function StickerLayout({ children }: { children: ReactNode }) {
  return children;
}
