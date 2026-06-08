import type { Metadata } from "next";
import type { ReactNode } from "react";
import { withSocialMetadata } from "@/lib/seo/page-metadata";

const title = "Hakkımızda — Online etiket ve sticker baskı";
const description =
  "Küçük adetten etiket ve sticker baskı, AI dosya kontrolü, şeffaf teslim. Matbaa kökenli üretim deneyimi ile dijital sipariş akışı.";
const canonical = "/hakkimizda";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  ...withSocialMetadata({ title, description, canonical }),
};

export default function HakkimizdaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
