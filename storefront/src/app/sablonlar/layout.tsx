import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Etiket Şablonları — Kesim Bıçağı (Die-Cut) + Tasarım Şablonları",
  description:
    "65 adet 1:1 ölçekli kesim bıçağı şablonu (PDF/AI/EPS) ve 60+ ücretsiz tasarım şablonu. Canva, Illustrator, Figma uyumlu — üyeler indirebilir.",
  alternates: { canonical: "/sablonlar" },
  openGraph: {
    title: "Etiket Şablonları — Kesim Bıçağı + Tasarım — Pim Etiket",
    description:
      "Die-cut kesim şablonları ve Canva/Illustrator uyumlu hazır tasarım paketi.",
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
