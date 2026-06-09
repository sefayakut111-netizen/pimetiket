"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DEFAULT_CONTACT_PHONE,
  DEFAULT_CONTACT_WHATSAPP,
  formatPhoneDisplay,
  phoneToTelHref,
  phoneToWaHref,
} from "@/lib/site-settings-shared";
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

// Sefa 4 Haz: footer sosyal medya — aktif hesaplar. Filled brand glyph,
// currentColor (beyaz → hover'da mercan). Yeni hesap açılınca buraya eklenir.
const SOCIALS: { label: string; href: string; path: string }[] = [
  {
    label: "Instagram",
    href: "https://instagram.com/pimetiket",
    path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
  },
  {
    label: "X (Twitter)",
    href: "https://x.com/pimetiket",
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    label: "Pinterest",
    href: "https://pinterest.com/pimetiket",
    path: "M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C24 5.367 18.634.001 12.017.001z",
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@pimetiket",
    path: "M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
];

export function Footer() {
  const toast = useToast();
  const { t } = useT();
  const pathname = usePathname();
  // Sefa 17 May Dalga 3 #19: checkout sayfasında newsletter friction yaratır
  // (kullanıcı ödeme dikkati dağılmasın). Footer'ı minimal göster.
  const isCheckout = pathname?.startsWith("/odeme") ?? false;
  const isConfigurator = pathname?.includes("/yapilandir") ?? false;
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [contactPhone, setContactPhone] = useState(DEFAULT_CONTACT_PHONE);
  const [contactWhatsapp, setContactWhatsapp] = useState(DEFAULT_CONTACT_WHATSAPP);

  useEffect(() => {
    void fetch("/api/public/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.settings) return;
        const s = json.settings as {
          seo_contact_phone?: string | null;
          contact_whatsapp?: string | null;
        };
        if (s.seo_contact_phone?.trim()) {
          setContactPhone(s.seo_contact_phone.trim());
        }
        if (s.contact_whatsapp?.trim()) {
          setContactWhatsapp(s.contact_whatsapp.trim());
        }
      })
      .catch(() => {
        /* fallback defaults */
      });
  }, []);

  const FOOTER_GROUPS: { t: string; links: FooterLink[] }[] = [
    {
      t: t.footer.groupProduct,
      links: [
        { label: t.nav.etiket, href: "/etiket" },
        { label: t.nav.sticker, href: "/sticker" },
        { label: t.nav.gallery, href: "/galeri" },
        { label: "Ücretsiz tasarım şablonları", href: "/sablonlar?tab=tasarim" },
        { label: "Kesim şablonları", href: "/sablonlar?tab=kesim" },
        { label: t.nav.blog, href: "/blog" },
      ],
    },
    {
      t: t.footer.groupCompany,
      // Sefa 17 May v16: Bottom strip'teki legal linkler sütunlara dağıtıldı.
      // Şirket → kurumsal yasal (KVKK / Gizlilik / Kullanım Şartları)
      links: [
        { label: t.nav.about, href: "/hakkimizda" },
        { label: t.nav.companyInfo, href: "/firma-bilgileri" },
        { label: t.nav.howWeProduce, href: "/nasil-uretiyoruz" },
        { label: "Terim Sözlüğü", href: "/terim-sozlugu" },
        { label: t.nav.contact, href: "/iletisim" },
      ],
    },
    {
      t: t.footer.groupSupport,
      // Sefa 17 May v16: Alışveriş/iade yasal metinleri buraya
      // (Çerez / Ön Bilgilendirme / Mesafeli Satış / Cayma Hakkı)
      links: [
        { label: "SSS", href: "/sss" },
        { label: "Destek talebi oluştur", href: "/destek" },
        { label: "İade talebi oluştur", href: "/iade-talep" },
        { label: "İade-değişim politikası", href: "/iade-degisim-politikasi" },
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

  const LEGAL_LINKS: FooterLink[] = [
    { label: "KVKK", href: "/kvkk" },
    { label: "Gizlilik", href: "/gizlilik" },
    { label: "Kullanım Şartları", href: "/sartlar" },
    { label: "Çerez Politikası", href: "/cerez" },
    { label: "Ön Bilgilendirme", href: "/on-bilgilendirme" },
    { label: "Mesafeli Satış", href: "/mesafeli-satis" },
    { label: "Cayma Hakkı", href: "/cayma-hakki" },
  ];

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

  // Konfigüratör + checkout: footer scroll/layout karışıklığı yaratmasın
  if (isCheckout || isConfigurator) {
    return null;
  }

  return (
    <footer className="bg-lacivert text-white/85 pt-14 pb-6 mt-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Newsletter — compact strip
            Sefa 17 May Dalga 3 #19: /odeme'de gizli */}
        {!isCheckout && (
        <div className="mb-10 pb-8 border-b border-white/10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-end">
          {/* Sefa 17 May v20: items-start → items-end — her iki blok
              da alt çizgiden referans alarak hizalanır. Sol bloğun
              desc satırı sağ bloğun checkbox satırıyla aynı baseline'da
              biter, alttaki border-bottom çizgisine ikisi de yakın. */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pim-mercan-koyu mb-1.5">
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
                  veriyorum (
                  <Link
                    href="/kvkk"
                    prefetch={false}
                    className="text-pim-mercan-koyu font-semibold hover:underline"
                  >
                    KVKK aydınlatma
                  </Link>
                  ). Üyelikten her an çıkabilirim.
                </span>
              </label>
            </form>
          )}
        </div>
        )}

        {/* Brand (sol) + 4 nav kolonu (sağ hiza) */}
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between mb-10">
          {/* Brand column */}
          <div className="md:max-w-[280px] shrink-0">
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
            {/* Sefa 5 Haz: WhatsApp + Telefon — tagline altında, sosyal ikonların üstünde */}
            <a
              href={phoneToWaHref(contactWhatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-yesil/15 hover:bg-yesil/25 px-3 py-1.5 transition-colors group"
              aria-label={`WhatsApp destek hattı: ${formatPhoneDisplay(contactWhatsapp)}`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="shrink-0 text-yesil"
                aria-hidden
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <span className="text-[12.5px] font-semibold text-white/90 group-hover:text-white whitespace-nowrap">
                WhatsApp · {formatPhoneDisplay(contactWhatsapp)}
              </span>
            </a>
            <a
              href={phoneToTelHref(contactPhone)}
              className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 transition-colors group"
              aria-label={`Telefon: ${formatPhoneDisplay(contactPhone)}`}
            >
              <Icon.Phone size={16} className="shrink-0 text-white/80" />
              <span className="text-[12.5px] font-semibold text-white/90 group-hover:text-white whitespace-nowrap">
                Telefon · {formatPhoneDisplay(contactPhone)}
              </span>
            </a>
            {/* Sosyal medya — Sefa 4 Haz: Instagram + X + Pinterest + YouTube.
                Yeni hesap (ör. TikTok) açılınca SOCIALS dizisine eklenir. */}
            <div className="mt-4 flex items-center gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Pim Etiket ${s.label}`}
                  title={s.label}
                  className="grid place-items-center w-9 h-9 rounded-full bg-white/10 hover:bg-pim-mercan transition-colors text-white"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-x-10 md:gap-y-6 md:flex-1 md:max-w-[680px] md:ml-auto">
          {FOOTER_GROUPS.map((g) => (
            <div key={g.t}>
              {/* Sefa 17 May v27: sütun başlıkları mercan rengine
                  (PİM'İN DEFTERİ eyebrow ile uyumlu) */}
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-3 text-pim-mercan-koyu text-center">
                {g.t}
              </div>
              <div className="flex flex-col gap-2">
                {g.links.map((l) => {
                  const skipPrefetch =
                    g.t === t.footer.groupCompany ||
                    g.t === t.footer.groupSupport ||
                    g.t === t.footer.groupAccount ||
                    l.href.includes("/yapilandir") ||
                    l.href.includes("tab=tasarim");
                  return (
                    <Link
                      key={l.label}
                      href={l.href}
                      prefetch={!skipPrefetch}
                      className="text-[13px] text-white/80 hover:text-white transition-colors"
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          </div>
        </div>

        <nav
          aria-label="Yasal bağlantılar"
          className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1.5 text-[11.5px] text-white/55 mb-4 pt-5 border-t border-white/10"
        >
          {LEGAL_LINKS.map((link, i) => (
            <span key={link.href} className="inline-flex items-center gap-x-4">
              {i > 0 ? (
                <span className="text-white/25" aria-hidden>
                  ·
                </span>
              ) : null}
              <Link
                href={link.href}
                prefetch={false}
                className="text-white/55 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            </span>
          ))}
        </nav>

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
