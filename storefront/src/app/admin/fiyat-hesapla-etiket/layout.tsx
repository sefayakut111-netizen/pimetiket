import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Etiket Fiyat" };

export default function EtiketFiyatLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
