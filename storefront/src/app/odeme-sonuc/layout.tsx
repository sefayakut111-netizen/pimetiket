import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Ödeme sonucu",
  robots: { index: false, follow: false },
};

export default function OdemeSonucLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
