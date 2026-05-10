import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Müşteri yorumları",
  description:
    "Pim Etiket'le bastıran markaların gerçek deneyimi — etiket ve sticker yorumları, fotoğraflı geri bildirimler.",
  alternates: { canonical: "/yorumlar" },
};

export default function YorumlarLayout({ children }: { children: ReactNode }) {
  return children;
}
