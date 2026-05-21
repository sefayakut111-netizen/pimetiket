import type { Metadata } from "next";
import type { ReactNode } from "react";

// Sefa 21 May v68 (ürün denetim P2 #14): title 3 ürün vurguluyordu (die-cut,
// holo, transparan). Sayfa 11 ürün gösteriyor — title daha kapsayıcı.
export const metadata: Metadata = {
  title: "Sticker bastır — özel kesim, holografik, simli ve şeffaf sticker",
  description:
    "25 adetten başlayan özel kesim, kare, yuvarlak, oval, bumper, yarı kesim ve karma sticker. Vinil, holografik, şeffaf, simli. AI dosya kontrolü ile 5 iş günü içinde kargoda.",
  alternates: { canonical: "/sticker" },
  openGraph: {
    title: "Sticker bastır — Pim Etiket",
    description:
      "Özel kesim, holografik, şeffaf, simli sticker. 25 adetten, 5 iş günü içinde kargoda.",
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
