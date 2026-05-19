import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Üretim Partnerleri" };

export default function AdminFasonLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
