import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { assertAdmin } from "@/lib/supabase/assert-admin";

// Demo sayfası SEO indeksinden gizlenir — staff/test amaçlı.
export const metadata: Metadata = {
  title: "Demo (test)",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DemoLayout({ children }: { children: ReactNode }) {
  const auth = await assertAdmin();
  if (!auth) {
    notFound();
  }
  return children;
}
