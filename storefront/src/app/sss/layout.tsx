import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SchemaJsonLd, faqSchema } from "@/components/SchemaJsonLd";
import { withSocialMetadata } from "@/lib/seo/page-metadata";
import { getSssFaqSchemaItems } from "@/lib/sss/faq-schema";

const title = "Sıkça Sorulanlar — Etiket ve sticker baskı süreci";
const description =
  "Minimum adet, dosya formatı, teslim süresi, iade ve ödeme: Pim Etiket'te sık sorulan soruların cevapları tek sayfada.";
const canonical = "/sss";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  ...withSocialMetadata({ title, description, canonical }),
};

export default function SssLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SchemaJsonLd data={faqSchema(getSssFaqSchemaItems())} />
      {children}
    </>
  );
}
