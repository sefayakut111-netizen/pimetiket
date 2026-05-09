import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hakkımızda",
  description:
    "Bursa'dan dijital baskı atölyesi. Küçük markalar için AI destekli üretim, fason ortaklık, Pim'in hikayesi.",
  alternates: { canonical: "/hakkimizda" },
};

export default function HakkimizdaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
