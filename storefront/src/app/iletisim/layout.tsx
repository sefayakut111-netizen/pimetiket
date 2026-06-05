import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SchemaJsonLd, localBusinessSchema } from "@/components/SchemaJsonLd";

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

const ILETISIM_LOCAL_BUSINESS = localBusinessSchema({
  phone: "+90 545 699 90 63",
  address:
    "Workinton Söğütözü, Beştepeler Mah. Nergis Sok. No:7/2 ViaFlat İş Merkezi Ofis: 27-28, Çankaya",
  email: "info@pimetiket.com",
  openingHours: "Mo-Fr 09:00-18:00",
});

export default function IletisimLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SchemaJsonLd data={ILETISIM_LOCAL_BUSINESS} />
      {children}
    </>
  );
}
