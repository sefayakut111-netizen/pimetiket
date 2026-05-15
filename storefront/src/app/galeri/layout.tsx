import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Galeri — Etiket ve sticker baskı örnekleri",
  description:
    "Pim Etiket'le bastıran markaların gerçek işleri. Sticker, rulo etiket, holo, kraft, ultra clear — küçük markaların raf hikâyeleri ve baskı örnekleri.",
  alternates: { canonical: "/galeri" },
  openGraph: {
    title: "Galeri — Pim Etiket",
    description:
      "Sticker'dan etikete, küçük markaların raf hikayeleri. Gerçek baskı örnekleri.",
    url: "/galeri",
    type: "website",
  },
};

export default function GaleriLayout({ children }: { children: ReactNode }) {
  return children;
}
