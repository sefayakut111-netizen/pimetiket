import type { Metadata } from "next";
import type { ReactNode } from "react";
import { withSocialMetadata } from "@/lib/seo/page-metadata";

const title = "Firma Bilgileri";
const description =
  "Pim Etiket yasal satıcı bilgileri: ticaret ünvanı, adres ve vergi numarası.";
const canonical = "/firma-bilgileri";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  ...withSocialMetadata({ title, description, canonical }),
};

export default function FirmaBilgileriLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
