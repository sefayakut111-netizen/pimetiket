import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hakkımızda — 75 yıllık matbaa ailesinin dijital atölyesi",
  description:
    "Pim Etiket: Türkiye'de online etiket ve sticker baskı — etikette uzman, küçük adetten, AI destekli. 75 yıllık matbaa ailesinin dijital atölyesi.",
  alternates: { canonical: "/hakkimizda" },
  openGraph: {
    title: "Hakkımızda — Pim Etiket",
    description:
      "Online etiket ve sticker baskı — etikette uzman, küçük adetten. 75 yıllık matbaa ailesinin AI destekli dijital atölyesi.",
    url: "/hakkimizda",
    type: "website",
  },
};

export default function HakkimizdaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
