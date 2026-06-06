import type { Metadata } from "next";
import type { ReactNode } from "react";
import { YorumlarSchema } from "@/components/seo/YorumlarSchema";
import { withSocialMetadata } from "@/lib/seo/page-metadata";

const title = "Müşteri Yorumları — Pim Etiket bastıranlar ne diyor?";
const description =
  "Etiket ve sticker bastıran markaların gerçek deneyimleri: fotoğraflı, doğrulanmış müşteri yorumları.";
const canonical = "/yorumlar";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  ...withSocialMetadata({ title, description, canonical }),
};

export default function YorumlarLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <YorumlarSchema />
      {children}
    </>
  );
}
