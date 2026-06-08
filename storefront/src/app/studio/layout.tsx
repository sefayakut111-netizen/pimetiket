import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Studio — Sticker Editör",
  description: "Kapalı devre sticker studio editörü.",
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="studio-route-root [--sticky-cta-h:4.5rem] min-h-[calc(100vh-64px)]">
      {children}
    </div>
  );
}
