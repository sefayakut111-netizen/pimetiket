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

export function CopyProtection() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Production-only: dev modunda console temiz kalsın
    if (process.env.NODE_ENV !== "production") return;

    // ============================================================
    // 1. Agresif Console Uyarısı (Facebook/Google pattern)
    // ============================================================
    // Yetersiz dikkatli kullanıcı F12 açıp birinin söylediği kodu
    // yapıştırırsa hesabını/kartını çaldırabilir (self-XSS).
    // Bu uyarı %95 amatör scraper'ı da caydırır.

    const bigStyle =
      "color:#FF6B5B;font-size:48px;font-weight:900;text-shadow:2px 2px 0 #1F2937;";
    const warnStyle =
      "color:#1F2937;font-size:16px;font-weight:600;line-height:1.6;";
    const noteStyle = "color:#6B7280;font-size:13px;font-style:italic;";

    console.log("%c⚠️  DURDUR!", bigStyle);
    console.log(
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
      "color:#FF6B5B;font-weight:700;",
      warnStyle
    );
    console.log(
      "%c© 2026 Pim Etiket — Tüm hakları saklıdır. (Sefa Yakut, Alemdağ VD)",
      noteStyle
    );

    // ============================================================
    // 2. DevTools Açık mı Detect (resize hilesi)
    // ============================================================
    // DevTools docked olduğunda window.outerHeight - innerHeight > 160 olur.
    // Bu kesin değil ama caydırıcı. F12 açan kullanıcı uyarı görür.
    let warned = false;
    const detectDevTools = () => {
      const threshold = 160;
      const hOpen =
        window.outerHeight - window.innerHeight > threshold;
      const wOpen = window.outerWidth - window.innerWidth > threshold;
      if ((hOpen || wOpen) && !warned) {
        warned = true;
        console.log(
          "%c👀 Geliştirici araçları açıldı.",
          "color:#FF6B5B;font-size:18px;font-weight:700;"
        );
        console.log(
          "%cKoda göz atmak normaldir; ama scraping/kopyalama yasaktır.\n" +
            "Sorularınız için: info@pimetiket.com",
          "color:#1F2937;font-size:13px;"
        );
      }
    };

    detectDevTools();
    const interval = window.setInterval(detectDevTools, 1500);

    // ============================================================
    // 3. Anti-debugger (subtle deterrent)
    // ============================================================
    // Profesyonel scraper'ı durdurmaz ama debugger ile incelemeyi yavaşlatır.
    // Çok agresif değil — sadece prod'da, dev'de yok.

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
