import type { Metadata } from "next";
import type { ReactNode } from "react";

// Sefa 21 May v68 (sistem denetim #13): konfigüratör sayfasının kendi
// title'ı olsun — liste sayfasının title'ını miras almasın.
export const metadata: Metadata = {
  title: "Sticker Konfigüratörü — özelleştir ve fiyat al · Pim Etiket",
  description:
    "Sticker şekli, malzemesi, yüzeyi ve adetini seç; gerçek zamanlı fiyat ve önizleme. AI dosya kontrolü, 5 iş günü içinde kargoda.",
  alternates: { canonical: "/sticker/yapilandir" },
  robots: { index: false, follow: true }, // Liste sayfası ana giriş
};

export default function StickerYapilandirLayout({ children }: { children: ReactNode }) {
  return children;
}
