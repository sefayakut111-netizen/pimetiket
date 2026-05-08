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
import { PimChat } from "@/components/pim/PimChat";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  if (isAdmin) {
    return <AdminShell>{children}</AdminShell>;
  }

  return (
    <>
      <TopBar />
      <div id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </div>
      <Footer />
      <PimChat />
    </>
  );
}
