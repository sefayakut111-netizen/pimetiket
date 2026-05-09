import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "İletişim",
  description:
    "WhatsApp, e-posta ve Bursa atölye adresi. Numune, fiyat teklifi, fason iş birliği için bize ulaş.",
  alternates: { canonical: "/iletisim" },
};

export default function IletisimLayout({ children }: { children: ReactNode }) {
  return children;
}
