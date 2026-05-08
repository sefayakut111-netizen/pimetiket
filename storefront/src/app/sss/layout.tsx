import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sıkça sorulanlar",
  description:
    "Minimum adet, dosya formatı, teslim süresi, iade — Pim Etiket sıkça sorulan sorular.",
  alternates: { canonical: "/sss" },
};

export default function SssLayout({ children }: { children: ReactNode }) {
  return children;
}
