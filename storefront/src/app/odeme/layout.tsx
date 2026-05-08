import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Ödeme",
  robots: { index: false, follow: false },
};

export default function OdemeLayout({ children }: { children: ReactNode }) {
  return children;
}
