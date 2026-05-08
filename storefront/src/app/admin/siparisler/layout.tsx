import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Siparişler" };

export default function AdminSiparislerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
