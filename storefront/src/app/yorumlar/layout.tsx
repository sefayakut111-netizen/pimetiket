import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Müşteri Yorumları — Pim Etiket bastıranlar ne diyor?",
  description:
    "Pim Etiket'le bastıran markaların gerçek deneyimi — etiket ve sticker yorumları, fotoğraflı geri bildirimler. 4.7/5 ortalama, gerçek müşteri kanıtları.",
  alternates: { canonical: "/yorumlar" },
  openGraph: {
    title: "Müşteri Yorumları — Pim Etiket",
    description:
      "Etiket ve sticker bastıran markaların gerçek deneyimleri. Fotoğraflı, doğrulanmış yorumlar.",
    url: "/yorumlar",
    type: "website",
  },
};

export default function YorumlarLayout({ children }: { children: ReactNode }) {
  return children;
}
