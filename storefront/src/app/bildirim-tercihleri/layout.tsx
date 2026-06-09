import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Bildirim tercihleri",
  robots: { index: false, follow: false },
};

export default function BildirimTercihleriLayout({ children }: { children: ReactNode }) {
  return children;
}
