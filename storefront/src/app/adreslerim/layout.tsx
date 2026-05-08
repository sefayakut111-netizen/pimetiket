import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Adres defterim",
  robots: { index: false, follow: false },
};

export default function AdreslerimLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
