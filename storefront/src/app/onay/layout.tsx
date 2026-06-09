import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sipariş onayı",
  robots: { index: false, follow: false },
};

export default function OnayLayout({ children }: { children: ReactNode }) {
  return children;
}
