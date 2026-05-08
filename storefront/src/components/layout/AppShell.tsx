import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";

/**
 * Tüm sayfaların etrafına sarılan ana shell.
 * RootLayout'tan tek bir noktada cağrılır; sayfa içeriği `children` olarak gelir.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <TopBar />
      <div className="flex-1">{children}</div>
      <Footer />
    </>
  );
}
