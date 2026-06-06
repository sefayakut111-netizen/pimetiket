import type { Metadata } from "next";
import type { ReactNode } from "react";
import { withSocialMetadata } from "@/lib/seo/page-metadata";

const title = "Galeri — Etiket ve sticker baskı örnekleri";
const description =
  "Pim Etiket'le bastıran markaların gerçek işleri: sticker, rulo etiket, holo, kraft ve ultra clear örnekleri.";
const canonical = "/galeri";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  ...withSocialMetadata({ title, description, canonical }),
};

export default function GaleriLayout({ children }: { children: ReactNode }) {
  return children;
}
