import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Galeri — Pim Etiket'le bastıran markalar",
  description:
    "Bursa atölyemizden çıkan müşteri işleri. Sticker'dan etikete, küçük markaların raf hikayeleri.",
  alternates: { canonical: "/galeri" },
};

export default function GaleriLayout({ children }: { children: ReactNode }) {
  return children;
}
