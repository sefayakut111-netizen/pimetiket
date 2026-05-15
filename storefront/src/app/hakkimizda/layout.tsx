import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hakkımızda — 75 yıllık matbaa ailesinin dijital atölyesi",
  description:
    "Pim Etiket'in hikâyesi: kırtasiyeden matbaaya, oradan ambalaja uzanan 75 yıllık aile mirası. AI destekli dijital baskı ile küçük markalara hızlı ve esnek çözümler.",
  alternates: { canonical: "/hakkimizda" },
  openGraph: {
    title: "Hakkımızda — Pim Etiket",
    description:
      "75 yıllık matbaa ailesinin dijital baskı atölyesi. Küçük markalardan büyük ekiplere — etiket ve sticker baskı.",
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
