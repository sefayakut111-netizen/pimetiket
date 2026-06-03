import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Terim Sözlüğü · Pim Etiket",
  description:
    "Etiket ve sticker baskısında kullanılan terimler: die-cut, kiss-cut, laminasyon, CMYK, kuşe, folyo, yapışkan türleri ve daha fazlası.",
  alternates: { canonical: "/terim-sozlugu" },
};

export default function TerimSozluguLayout({ children }: { children: ReactNode }) {
  return children;
}
