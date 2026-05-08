import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sepetim",
  robots: { index: false, follow: false },
};

export default function SepetLayout({ children }: { children: ReactNode }) {
  return children;
}
