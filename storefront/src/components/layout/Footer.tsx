"use client";

import Link from "next/link";
import { useState } from "react";
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
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const FOOTER_GROUPS: { t: string; links: FooterLink[] }[] = [
    {
      t: t.footer.groupProduct,
      links: [
        { label: t.nav.etiket, href: "/etiket" },
        { label: t.nav.sticker, href: "/sticker" },
        { label: t.nav.gallery, href: "/galeri" },
        { label: t.nav.blog, href: "/blog" },
      ],
    },
    {
      t: t.footer.groupCompany,
      links: [
        { label: t.nav.about, href: "/hakkimizda" },
        { label: t.nav.blog, href: "/blog" },
        { label: t.nav.contact, href: "/iletisim" },
      ],
    },
    {
      t: t.footer.groupSupport,
      links: [
        { label: "SSS", href: "/sss" },
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
    { label: "Kullanım", href: "/sartlar" },
    { label: "Çerez", href: "/cerez" },
    { label: "Ön Bilgilendirme", href: "/on-bilgilendirme" },
    { label: "Mesafeli Satış", href: "/mesafeli-satis" },
    { label: "Cayma Hakkı", href: "/cayma-hakki" },
    { label: "İade & Değişim", href: "/iade-degisim-politikasi" },
  ];

  const onSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Geçerli e-posta gir");
      return;
    }
    setLoading(true);
    // Mock subscribe — Faz 2'de Resend list
    setTimeout(() => {
      setLoading(false);
      setSubscribed(true);
      toast.success("Listeye eklendi 📩");
      // Mock storage
      try {
        const stored = JSON.parse(
          localStorage.getItem("pim_newsletter_v1") ?? "[]"
        ) as string[];
        if (!stored.includes(email)) {
          stored.push(email);
          localStorage.setItem("pim_newsletter_v1", JSON.stringify(stored));
        }
      } catch {
        // ignore
      }
    }, 600);
  };

  return (
    <footer className="bg-lacivert text-white/85 pt-14 pb-6 mt-20">
      <div className="mx-auto max-w-[1280px] px-6 md:px-8">
        {/* Newsletter — compact strip */}
        <div className="mb-10 pb-8 border-b border-white/10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pim-mercan mb-1.5">
              {t.footer.newsletterEyebrow}
            </div>
            <h3 className="text-xl md:text-2xl font-semibold tracking-tight leading-tight mb-1">
              {t.footer.newsletterTitle}
            </h3>
            <p className="text-[13px] text-white/60 leading-relaxed">
              {t.footer.newsletterDesc}
            </p>
          </div>
          {subscribed ? (
            <div className="inline-flex items-center gap-2.5 bg-yesil-soft/15 ring-1 ring-yesil/30 rounded-full px-4 h-11 text-yesil-soft text-[13px] font-semibold">
              📩 {t.footer.newsletterSuccess}
            </div>
          ) : (
            <form onSubmit={onSubscribe} className="flex gap-2 min-w-[280px] md:min-w-[380px]">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.footer.newsletterPlaceholder}
                disabled={loading}
                className="!bg-white/15 !text-white placeholder:!text-white/60 !ring-white/25 focus:!ring-pim-mercan flex-1"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={loading || !email}
              >
                {loading ? "..." : t.footer.newsletterSubscribe}
              </Button>
            </form>
          )}
        </div>

        {/* Brand + 4 nav columns */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-8 mb-10">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center bg-white rounded-xl px-3 py-2 mb-3"
              aria-label="Pim Etiket — Anasayfa"
            >
              <PimAsset variant="logo" size={160} bob={false} />
            </Link>
            <p className="text-[12.5px] text-white/55 leading-relaxed max-w-[260px]">
              {t.footer.tagline}
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_GROUPS.map((g) => (
            <div key={g.t}>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-3 text-white/45">
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

        {/* Trust strip — payment + security */}
        <PaymentBadges />

        {/* Compact legal entity row */}
        <div className="border-t border-white/10 pt-5 mt-6 flex flex-col md:flex-row md:items-start md:justify-between gap-3 text-[12px] text-white/55 leading-relaxed">
          <div>
            <strong className="text-white/75">
              Sefa Yakut Kırtasiye Baskı Ticaret Ltd. Şti.
            </strong>
            {" · "}
            Doğanbey VD / 7580607612
            <span className="text-white/40">
              {" · "}Ünvan/adres/telefon: yakında güncellenecek
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="mailto:info@pimetiket.com"
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              info@pimetiket.com
            </a>
            <span className="text-white/20">·</span>
            <Link
              href="/iletisim"
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              Müşteri hizmetleri
            </Link>
          </div>
        </div>

        {/* Bottom strip — © + legal links */}
        <div className="pt-5 mt-5 border-t border-white/10 flex flex-col md:flex-row md:justify-between md:items-center text-[12px] text-white/45 gap-3">
          <div>
            © {new Date().getFullYear()} {t.footer.copyright}
          </div>
          <div className="flex gap-x-4 gap-y-1.5 flex-wrap">
            {LEGAL_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hover:text-white transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
