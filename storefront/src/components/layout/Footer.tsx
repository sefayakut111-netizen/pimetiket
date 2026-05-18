"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { PimAsset } from "@/components/PimAsset";
import { Icon } from "@/components/Icon";
import { Input, Button, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import { PaymentBadges } from "@/components/layout/PaymentBadges";

interface FooterLink {
  label: string;
  href: string;
}

export function Footer() {
  const toast = useToast();
  const { t } = useT();
  const pathname = usePathname();
  // Sefa 17 May Dalga 3 #19: checkout sayfasında newsletter friction yaratır
  // (kullanıcı ödeme dikkati dağılmasın). Footer'ı minimal göster.
  const isCheckout = pathname?.startsWith("/odeme") ?? false;
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);

  const FOOTER_GROUPS: { t: string; links: FooterLink[] }[] = [
    {
      t: t.footer.groupProduct,
      links: [
        { label: t.nav.etiket, href: "/etiket" },
        { label: t.nav.sticker, href: "/sticker" },
        { label: t.nav.gallery, href: "/galeri" },
        { label: "Ücretsiz şablonlar", href: "/sablonlar" },
        { label: t.nav.blog, href: "/blog" },
      ],
    },
    {
      t: t.footer.groupCompany,
      // Sefa 17 May v16: Bottom strip'teki legal linkler sütunlara dağıtıldı.
      // Şirket → kurumsal yasal (KVKK / Gizlilik / Kullanım Şartları)
      links: [
        { label: t.nav.about, href: "/hakkimizda" },
        { label: t.nav.contact, href: "/iletisim" },
        { label: "KVKK", href: "/kvkk" },
        { label: "Gizlilik", href: "/gizlilik" },
        { label: "Kullanım Şartları", href: "/sartlar" },
      ],
    },
    {
      t: t.footer.groupSupport,
      // Sefa 17 May v16: Alışveriş/iade yasal metinleri buraya
      // (Çerez / Ön Bilgilendirme / Mesafeli Satış / Cayma Hakkı)
      links: [
        { label: "SSS", href: "/sss" },
        { label: "İade talebi oluştur", href: "/iade-talep" },
        { label: "İade-değişim politikası", href: "/iade-degisim-politikasi" },
        { label: "Çerez Politikası", href: "/cerez" },
        { label: "Ön Bilgilendirme", href: "/on-bilgilendirme" },
        { label: "Mesafeli Satış", href: "/mesafeli-satis" },
        { label: "Cayma Hakkı", href: "/cayma-hakki" },
      ],
    },
    {
      t: t.footer.groupAccount,
      links: [
        { label: t.nav.dashboard, href: "/panelim" },
        { label: t.nav.orders, href: "/siparislerim" },
        { label: t.nav.returns, href: "/iadelerim" },
        { label: t.nav.notifications, href: "/bildirim-tercihleri" },
      ],
    },
  ];

  // LEGAL_LINKS kaldırıldı (Sefa 17 May v16) — tüm linkler artık
  // FOOTER_GROUPS içindeki Şirket + Destek sütunlarında.

  const onSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Geçerli e-posta gir");
      return;
    }
    if (!consent) {
      toast.error("Devam etmek için aydınlatma metnini onaylaman gerek.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/lead/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "newsletter" }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        alreadySubscribed?: boolean;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.ok) {
        toast.error(
          data.detail ?? data.error ?? "Şu an kaydedilemedi, tekrar dene."
        );
        return;
      }
      setSubscribed(true);
      toast.success(
        data.alreadySubscribed
          ? "Zaten kayıtlısın — tekrar görüşmek güzel ✨"
          : "Tamam, listeye eklendin! Yeni şablon ve fırsatlarda ulaşırım 📩"
      );
    } catch {
      toast.error("Bağlantı sorunu, biraz sonra tekrar dene.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="bg-lacivert text-white/85 pt-14 pb-6 mt-20">
      <div className="mx-auto max-w-[1280px] px-6 md:px-8">
        {/* Newsletter — compact strip
            Sefa 17 May Dalga 3 #19: /odeme'de gizli */}
        {!isCheckout && (
        <div className="mb-10 pb-8 border-b border-white/10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-end">
          {/* Sefa 17 May v20: items-start → items-end — her iki blok
              da alt çizgiden referans alarak hizalanır. Sol bloğun
              desc satırı sağ bloğun checkbox satırıyla aynı baseline'da
              biter, alttaki border-bottom çizgisine ikisi de yakın. */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pim-mercan mb-1.5">
              {t.footer.newsletterEyebrow}
            </div>
            <h3 className="text-xl md:text-2xl font-semibold tracking-tight leading-tight mb-1">
              {t.footer.newsletterTitle}
            </h3>
            {/* Sefa 17 May v18: "Ücretsiz şablon paketi da yolda —
                spam yok, sadece iş." satırı kaldırıldı (duplicate;
                newsletterDesc'te zaten "spam yok" geçiyor). */}
            <p className="text-[13px] text-white/60 leading-relaxed">
              {t.footer.newsletterDesc}
            </p>
          </div>
          {subscribed ? (
            <div className="inline-flex items-center gap-2.5 bg-yesil-soft/15 ring-1 ring-yesil/30 rounded-full px-4 h-11 text-yesil-soft text-[13px] font-semibold">
              📩 {t.footer.newsletterSuccess}
            </div>
          ) : (
            <form onSubmit={onSubscribe} className="flex flex-col gap-2 min-w-[280px] md:min-w-[380px]">
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.footer.newsletterPlaceholder}
                  aria-label={t.footer.newsletterTitle}
                  disabled={loading}
                  className="!bg-white/15 !text-white placeholder:!text-white/60 !ring-white/25 focus:!ring-pim-mercan flex-1"
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading || !email || !consent}
                >
                  {loading ? "..." : t.footer.newsletterSubscribe}
                </Button>
              </div>
              <label className="flex items-start gap-2 text-[11.5px] text-white/65 leading-relaxed cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 shrink-0 accent-pim-mercan"
                  required
                />
                <span>
                  E-postamın yeni şablon ve duyurular için saklanmasına izin
                  veriyorum.{" "}
                  <Link
                    href="/kvkk"
                    className="text-pim-mercan font-semibold hover:underline"
                  >
                    KVKK aydınlatma
                  </Link>
                  . Üyelikten her an çıkabilirim.
                </span>
              </label>
            </form>
          )}
        </div>
        )}

        {/* Brand + 4 nav columns */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-8 mb-10">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center mb-3"
              aria-label="Pim Etiket — Anasayfa"
            >
              {/* Footer lacivert zemin → dark-bg lockup (krem logo) */}
              <PimAsset variant="logo" bg="dark" size={160} bob={false} />
            </Link>
            <p className="text-[12.5px] text-white/55 leading-relaxed max-w-[260px]">
              {t.footer.tagline}
            </p>
            {/* Sosyal medya */}
            <div className="mt-4 flex items-center gap-2">
              <a
                href="https://instagram.com/pimetiket"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pim Etiket Instagram"
                title="Instagram"
                className="grid place-items-center w-9 h-9 rounded-full bg-white/10 hover:bg-pim-mercan transition-colors text-white"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              {/* Yakında: TikTok, YouTube — Sefa hesap açtıkça eklenir */}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_GROUPS.map((g) => (
            <div key={g.t}>
              {/* Sefa 17 May v27: sütun başlıkları mercan rengine
                  (PİM'İN DEFTERİ eyebrow ile uyumlu) */}
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-3 text-pim-mercan">
                {g.t}
              </div>
              <div className="flex flex-col gap-2">
                {g.links.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    className="text-[13px] text-white/80 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Trust strip — copyright (sol) + security badges (sağ)
            Sefa 17 May v17: Kart ikonları kaldırıldı, yerine ©.
            Sefa 18 May v68: Uzun FSEK telif paragrafı kaldırıldı —
            sadece /sartlar §5 ve /telif-sikayet sayfalarında yazıyor. */}
        <PaymentBadges
          copyrightText={`© ${new Date().getFullYear()} ${t.footer.copyright}`}
        />

        {/* Sefa kararı 17 May v15: Şirket bilgisi bloğu (Sefa Yakut
            Kırtasiye Baskı Ticaret Ltd. Şti. + Mersis/Sicil + adres +
            email + saatler) footer'dan kaldırıldı.
            Yasal zorunluluk için bu bilgiler "Hakkımızda" ve "İletişim"
            sayfalarında zaten mevcut (Mesafeli Satış Yönetmeliği m.5/b). */}

        {/* Sefa 17 May v17: Ayrı © satırı kaldırıldı, copyright
            PaymentBadges satırına (sol tarafa) taşındı. */}
      </div>
    </footer>
  );
}
