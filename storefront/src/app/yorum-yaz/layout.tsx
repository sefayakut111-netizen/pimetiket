import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Yorum yaz",
  robots: { index: false, follow: false },
};

export default function YorumYazLayout({ children }: { children: ReactNode }) {
  return children;
}
