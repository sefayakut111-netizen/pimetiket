import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cüzdanım",
  robots: { index: false, follow: false },
};

export default function CuzdanLayout({ children }: { children: ReactNode }) {
  return children;
}
