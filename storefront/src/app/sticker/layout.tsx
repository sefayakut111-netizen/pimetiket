import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sticker konfigüre et",
  description:
    "25 adetten başlayan tekli ya da tabakada sticker baskı. Anlık fiyat, hızlı teslim.",
  alternates: { canonical: "/sticker" },
};

export default function StickerLayout({ children }: { children: ReactNode }) {
  return children;
}
