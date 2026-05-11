import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Fason — Pim Etiket",
  description: "Fason ortağı sipariş güncelleme paneli.",
  robots: { index: false, follow: false },
};

export default function FasonLayout({ children }: { children: ReactNode }) {
  return children;
}
