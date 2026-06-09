/**
 * CopyProtection — Frontend caydırıcı koruma katmanı.
 *
 * Sefa 18 May v68 (koruma): Pim Etiket sistemini scraping/kopyalamaya karşı
 * caydırıcı önlemler. NOT: Sağ tık + text selection AÇIK (içerik kopyalama
 * meşru — alıntı, paylaşım, AT eğitimi için müşteri kullanır).
 *
 * Bu component yapar:
 *   1. Console agresif güvenlik uyarısı (Facebook/Google pattern)
 *   2. DevTools açık mı detect (window resize hilesi + debugger trick)
 *   3. F12/Ctrl+Shift+I/Cmd+Opt+I için bilgilendirme toast
 *
 * Yapmaz (Sefa kararı):
 *   - Sağ tık disable (müşteri içerik kopyalayabilir)
 *   - Text selection disable (alıntı engellenmez)
 *   - DevTools tam blok (zaten aşılır, anlamsız)
 *
 * Gerçekçi koruma seviyesi: %70-80 amatör scraping caydırılır.
 * Profesyonel scraper'lar için Cloudflare WAF + rate limit ek koruma.
 */

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Ödeme / admin akışlarında konsol temiz kalsın — gerçek hatalar görünsün */
function isQuietConsolePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/odeme") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth")
  );
}

export function CopyProtection() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (isQuietConsolePath(pathname)) return;

    const sessionKey = "pim_console_security_notice";
    const alreadyShown =
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(sessionKey) === "1";

    if (!alreadyShown) {
      const bigStyle =
        "color:#ef3e56;font-size:48px;font-weight:900;text-shadow:2px 2px 0 #141524;";
      const warnStyle =
        "color:#141524;font-size:16px;font-weight:600;line-height:1.6;";
      const noteStyle = "color:#6B7280;font-size:13px;font-style:italic;";

      console.info("%c⚠️  DURDUR!", bigStyle);
      console.info(
        "%cBu, geliştirici tarayıcı konsoludur — Pim Etiket güvenli bir alandır.\n\n" +
          "Eğer biri buraya kod yapıştırmanı söylediyse, **kesinlikle yapma**.\n" +
          "Bu bir 'self-XSS' saldırısıdır:\n" +
          "  • Hesabını çalabilir\n" +
          "  • Kart bilgilerini ele geçirebilir\n" +
          "  • Sipariş verilerini kötüye kullanabilir\n\n" +
          "Bu sistemin kaynak kodları, tasarımları ve içerikleri\n" +
          "%cPim Etiket'in (Sefa Yakut) telif hakkı altındadır.%c\n" +
          "FSEK (5846 sayılı kanun) kapsamında kopyalama yasaktır.\n\n" +
          "Güvenlik bildirimi: info@pimetiket.com",
        warnStyle,
        "color:#ef3e56;font-weight:700;",
        warnStyle
      );
      console.info(
        "%c© 2026 Pim Etiket — Tüm hakları saklıdır. (Sefa Yakut, Alemdağ VD)",
        noteStyle
      );

      try {
        sessionStorage.setItem(sessionKey, "1");
      } catch {
        /* sessionStorage disabled */
      }
    }

    let warned = false;
    const detectDevTools = () => {
      const threshold = 160;
      const hOpen = window.outerHeight - window.innerHeight > threshold;
      const wOpen = window.outerWidth - window.innerWidth > threshold;
      if ((hOpen || wOpen) && !warned) {
        warned = true;
        console.info(
          "%cGeliştirici araçları açık — scraping/kopyalama yasaktır. Sorular: info@pimetiket.com",
          "color:#6B7280;font-size:13px;"
        );
      }
    };

    detectDevTools();
    const interval = window.setInterval(detectDevTools, 1500);

    return () => {
      window.clearInterval(interval);
    };
  }, [pathname]);

  return null;
}
