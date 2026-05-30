import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Editör — Bıçak & Baskı Hazırlama",
  description: "Üyelere özel bıçak hazırlama editörü.",
  robots: { index: false, follow: false },
};

export default function EditorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="editor-route-root [--sticky-cta-h:4.5rem]">{children}</div>
  );
}
