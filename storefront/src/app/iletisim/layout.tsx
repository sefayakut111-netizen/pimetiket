import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SchemaJsonLd, localBusinessSchema } from "@/components/SchemaJsonLd";
import { withSocialMetadata } from "@/lib/seo/page-metadata";

const title = "İletişim — Pim Sohbet, e-posta, telefon";
const description =
  "Pim Etiket ile iletişim: Pim Sohbet, info@pimetiket.com ve WhatsApp. Teklif ve iş birliği için bize ulaş.";
const canonical = "/iletisim";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  ...withSocialMetadata({ title, description, canonical }),
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
