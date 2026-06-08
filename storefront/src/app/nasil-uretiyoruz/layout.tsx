import type { Metadata } from "next";
import type { ReactNode } from "react";
import { withSocialMetadata } from "@/lib/seo/page-metadata";

const title = "Nasıl Üretiyoruz? — Kalite sürecimiz · Pim Etiket";
const description =
  "Avrupa malzemeler, beyaz zemin baskı, ürüne özel baskı tekniği, AI dosya kontrolü ve prova onayı. Kaliteyi tesadüfe bırakmıyoruz.";
const canonical = "/nasil-uretiyoruz";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  ...withSocialMetadata({ title, description, canonical }),
};

export default function NasilUretiyoruzLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
