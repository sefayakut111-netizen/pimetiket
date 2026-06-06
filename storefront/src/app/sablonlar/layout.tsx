import type { Metadata } from "next";
import type { ReactNode } from "react";
import { withSocialMetadata } from "@/lib/seo/page-metadata";

const title = "Şablonlar — Kesim bıçağı ve tasarım şablonları";
const description =
  "1:1 ölçekli kesim bıçağı şablonları (PDF/AI/EPS) ve Canva, Illustrator, Figma uyumlu hazır tasarım paketleri.";
const canonical = "/sablonlar";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  ...withSocialMetadata({ title, description, canonical }),
};

export default function SablonlarLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
