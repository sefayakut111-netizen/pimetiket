import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hesap ayarları",
  robots: { index: false, follow: false },
};

export default function AyarlarLayout({ children }: { children: ReactNode }) {
  return children;
}
