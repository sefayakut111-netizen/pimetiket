import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Fatura bilgileri",
  robots: { index: false, follow: false },
};

export default function FaturaBilgileriLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
