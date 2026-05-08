import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Etiket konfigüre et",
  description:
    "Malzeme, kaplama, ölçü, adet — anlık fiyat. 1000 adetten başla, 10 günde elinde.",
  alternates: { canonical: "/etiket" },
};

export default function EtiketLayout({ children }: { children: ReactNode }) {
  return children;
}
