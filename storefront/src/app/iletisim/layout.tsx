import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "İletişim — Pim Sohbet, e-posta, atölye bilgileri",
  description:
    "Pim Etiket ile iletişim — AI sohbet (Pim Sohbet), info@pimetiket.com, fason atölye bilgileri. Numune, fiyat teklifi, iş birliği için bize ulaş.",
  alternates: { canonical: "/iletisim" },
  openGraph: {
    title: "İletişim — Pim Etiket",
    description:
      "AI sohbet, e-posta ve fason atölyelerimiz. Numune, teklif, iş birliği için bize ulaş.",
    url: "/iletisim",
    type: "website",
  },
};

export default function IletisimLayout({ children }: { children: ReactNode }) {
  return children;
}
