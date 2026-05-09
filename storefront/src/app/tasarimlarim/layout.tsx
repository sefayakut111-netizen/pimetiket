import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Tasarım kütüphanem",
  description:
    "Yüklediğin tüm tasarımlar. Yeniden bastırmak için tek tıkla konfigüratöre döner.",
  robots: { index: false, follow: true },
};

export default function TasarimlarimLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
