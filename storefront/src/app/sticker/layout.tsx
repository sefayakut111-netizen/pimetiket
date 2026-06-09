import type { Metadata } from "next";
import type { ReactNode } from "react";
import { withSocialMetadata, withTrHreflang } from "@/lib/seo/page-metadata";

// Sefa 21 May v68 SEO Sprint: ISR (1 saat) — TTFB iyileştirme.
export const revalidate = 3600;

// Sefa 21 May v68 (ürün denetim P2 #14): title 3 ürün vurguluyordu (die-cut,
// holo, transparan). Sayfa 11 ürün gösteriyor — title daha kapsayıcı.
const title = "Sticker bastır — özel kesim, holografik ve şeffaf sticker";
const description =
  "Die-cut, kare, yuvarlak ve özel kesim sticker. 25 adetten, vinil, holografik, şeffaf malzemeler. AI dosya kontrolü, 5 iş günü kargoda.";
const canonical = "/sticker";

export const metadata: Metadata = {
  title,
  description,
  alternates: withTrHreflang(canonical),
  ...withSocialMetadata({ title, description, canonical }),
};

export default function StickerLayout({ children }: { children: ReactNode }) {
  return children;
}
