import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sık Sorulan Sorular — Etiket ve sticker baskı süreci",
  description:
    "Minimum adet kaç? Hangi dosya formatlarını kabul ediyorsunuz? Teslim süresi ne kadar? Pim Etiket'te sık sorulan tüm soruların cevabı tek sayfada.",
  alternates: { canonical: "/sss" },
  openGraph: {
    title: "Sık Sorulan Sorular — Pim Etiket",
    description:
      "Etiket ve sticker baskı süreci, minimum adet, teslim, iade — tüm soruların cevabı.",
    url: "/sss",
    type: "website",
  },
};

export default function SssLayout({ children }: { children: ReactNode }) {
  return children;
}
