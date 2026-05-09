import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Panelim",
  description: "Siparişlerin, prova durumun, AI kontrol sonuçların.",
  robots: { index: false, follow: true },
};

export default function PanelimLayout({ children }: { children: ReactNode }) {
  return children;
}
