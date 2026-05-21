import type { Metadata } from "next";
import type { ReactNode } from "react";

// Sefa 21 May v68 (sistem denetim #13): konfigüratör sayfasının kendi
// title'ı olsun — liste sayfasının title'ını miras almasın. SEO + sekme
// okunabilirliği için.
export const metadata: Metadata = {
  title: "Etiket Konfigüratörü — özelleştir ve fiyat al · Pim Etiket",
  description:
    "Etiket boyutu, malzemesi, kaplaması ve adetini seç; gerçek zamanlı fiyat ve önizleme. AI dosya kontrolü, 10 iş günü içinde kargoda.",
  alternates: { canonical: "/etiket/yapilandir" },
  robots: { index: false, follow: true }, // Konfigüratör sayfası SEO'da indekslenmesin; liste sayfası ana giriş
};

export default function EtiketYapilandirLayout({ children }: { children: ReactNode }) {
  return children;
}
