import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Fiyat Hesapla" };

export default function AdminFiyatHesaplaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
