"use client";

/**
 * AppShell — root sarıcı.
 * Path admin ile başlıyorsa AdminShell, değilse public TopBar+Footer.
 */

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";
import { AdminShell } from "./AdminShell";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  if (isAdmin) {
    return <AdminShell>{children}</AdminShell>;
  }

  return (
    <>
      <TopBar />
      <div className="flex-1">{children}</div>
      <Footer />
    </>
  );
}
