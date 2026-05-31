import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Destek talebi",
  description:
    "Sipariş, tasarım veya kargo ile ilgili destek talebi oluşturun. Pim Etiket müşteri desteği.",
  alternates: { canonical: "/destek" },
  robots: { index: false, follow: true },
};

export default function DestekLayout({ children }: { children: ReactNode }) {
  return children;
}
