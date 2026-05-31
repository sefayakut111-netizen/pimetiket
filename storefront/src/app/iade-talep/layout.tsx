import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "İade talebi",
  description:
    "Üretim hatası, kargo hasarı veya yanlış ürün için iade talebi başlatın.",
  alternates: { canonical: "/iade-talep" },
  robots: { index: false, follow: true },
};

export default function IadeTalepLayout({ children }: { children: ReactNode }) {
  return children;
}
