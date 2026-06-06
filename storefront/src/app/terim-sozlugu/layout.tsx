import type { Metadata } from "next";
import type { ReactNode } from "react";
import { withSocialMetadata } from "@/lib/seo/page-metadata";

const title = "Terim Sözlüğü — Etiket ve baskı terimleri";
const description =
  "Die-cut, kiss-cut, laminasyon, CMYK, kuşe, folyo ve yapışkan türleri: etiket ve sticker baskısında kullanılan terimlerin açıklamaları.";
const canonical = "/terim-sozlugu";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  ...withSocialMetadata({ title, description, canonical }),
};

export default function TerimSozluguLayout({ children }: { children: ReactNode }) {
  return children;
}
