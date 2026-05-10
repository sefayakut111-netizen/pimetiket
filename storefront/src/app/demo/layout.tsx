import type { Metadata } from "next";
import type { ReactNode } from "react";

// Demo sayfası SEO indeksinden gizlenir — staff/test amaçlı.
// Middleware /demo'yu auth-gate ediyor; bu meta arama motorlarına da
// "indekslenmesin" sinyali verir.
export const metadata: Metadata = {
  title: "Demo (test)",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return children;
}
