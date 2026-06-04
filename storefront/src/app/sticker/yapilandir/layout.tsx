import type { Metadata } from "next";
import type { ReactNode } from "react";

// Sefa 21 May v68 (sistem denetim #13): konfigüratör layout — title
// searchParams page.tsx generateMetadata'da (layout searchParams alamaz).
export const metadata: Metadata = {
  description:
    "Sticker şekli, malzemesi, yüzeyi ve adetini seç; gerçek zamanlı fiyat ve önizleme. AI dosya kontrolü, 5 iş günü içinde kargoda.",
  alternates: { canonical: "/sticker/yapilandir" },
  robots: { index: false, follow: true },
};

export default function StickerYapilandirLayout({ children }: { children: ReactNode }) {
  return children;
}
