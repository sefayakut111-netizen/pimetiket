"use client";

/**
 * AppShell — root sarıcı.
 * Path admin ile başlıyorsa AdminShell, değilse public TopBar+Footer.
 */

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";
import { AdminShell } from "./AdminShell";
import { ViewModeBanner } from "./ViewModeBanner";
import { PimChat } from "@/components/pim/PimChat";
import { ReviewRequestBanner } from "@/components/reviews/ReviewRequestBanner";
import { bumpSchemaVersionIfNeeded } from "@/lib/cache-invalidate";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;
  const isPartner = pathname?.startsWith("/partner") ?? false;
  const isFason = pathname?.startsWith("/fason/") ?? false;
  const isEditor = pathname?.startsWith("/editor") ?? false;
  const isCheckout = pathname?.startsWith("/odeme") ?? false;

  // Şema bump'ında stale cache temizliği — sadece bir kez boot'ta çalışır
  useEffect(() => {
    bumpSchemaVersionIfNeeded();
  }, []);

  if (isAdmin) {
    return <AdminShell>{children}</AdminShell>;
  }

  // Fason web form'u tamamen ayrı layout (TopBar/Footer/Pim YOK)
  // Sadece sipariş güncelleme arayüzü — operasyonel sayfa.
  if (isFason) {
    return <>{children}</>;
  }

  if (isPartner) {
    return <>{children}</>;
  }

  return (
    <>
      <ViewModeBanner />
      <TopBar />
      <ReviewRequestBanner />
      <div id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </div>
      {!isEditor ? <Footer /> : null}
      {!isEditor && !isCheckout ? <PimChat /> : null}
    </>
  );
}
