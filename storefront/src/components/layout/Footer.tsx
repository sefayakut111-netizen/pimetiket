"use client";

import Link from "next/link";
import { useState } from "react";
import { PimAsset } from "@/components/PimAsset";
import { Icon } from "@/components/Icon";
import { Input, Button, useToast } from "@/components/ui";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterGroup {
  t: string;
  links: FooterLink[];
}

const FOOTER_GROUPS: FooterGroup[] = [
  {
    t: "Ürün",
    links: [
      { label: "Etiket", href: "/etiket" },
      { label: "Sticker", href: "/sticker" },
      { label: "Galeri", href: "/galeri" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    t: "Şirket",
    links: [
      { label: "Hakkımızda", href: "/hakkimizda" },
      { label: "Blog", href: "/blog" },
      { label: "İletişim", href: "/iletisim" },
      { label: "Kariyer", href: "/iletisim" },
    ],
  },
  {
    t: "Destek",
    links: [
      { label: "SSS", href: "/sss" },
      { label: "İade ve değişim", href: "/iade-degisim-politikasi" },
      { label: "İade talebi", href: "/iade-talep" },
      { label: "Sözleşmeler", href: "/mesafeli-satis" },
    ],
  },
  {
    t: "Hesabım",
    links: [
      { label: "Panelim", href: "/panelim" },
      { label: "Siparişlerim", href: "/siparislerim" },
      { label: "İadelerim", href: "/iadelerim" },
      { label: "Bildirimler", href: "/bildirim-tercihleri" },
    ],
  },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "KVKK", href: "/kvkk" },
  { label: "Gizlilik", href: "/gizlilik" },
  { label: "Kullanım", href: "/sartlar" },
  { label: "Çerez", href: "/cerez" },
  { label: "Mesafeli Satış", href: "/mesafeli-satis" },
  { label: "Cayma Hakkı", href: "/cayma-hakki" },
  { label: "İade", href: "/iade-degisim-politikasi" },
];

export function Footer() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

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
    <footer className="bg-lacivert text-white/85 pt-16 pb-8 mt-20">
      <div className="mx-auto max-w-[1280px] px-8">
        {/* Newsletter strip */}
        <div className="mb-12 grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-8 items-center pb-12 border-b border-white/10">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-pim-mercan mb-2">
              Pim&rsquo;in defteri
            </div>
            <h3 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight mb-2">
              Etiket rehberini ilk sen oku
            </h3>
            <p className="text-[14px] text-white/65 leading-relaxed max-w-[420px]">
              Ayda 1-2 mail. Yeni malzeme, baskı ipuçları, küçük marka
              hikayeleri. Spam yok, satış baskısı yok.
            </p>
          </div>
          {subscribed ? (
            <div className="bg-white/10 rounded-2xl p-5 text-center">
              <div className="text-2xl mb-2">📩</div>
              <div className="font-semibold text-white">Listeye eklendin</div>
              <p className="text-[13px] text-white/65 mt-1">
                İlk yazıyı yakında alacaksın.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubscribe} className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@marka.com"
                disabled={loading}
                className="!bg-white/10 !text-white placeholder:!text-white/40 !ring-white/20 focus:!ring-pim-mercan"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={loading || !email}
              >
                {loading ? "..." : "Abone ol"}
              </Button>
            </form>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-8 mb-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="mb-4 -ml-2 inline-block bg-white rounded-xl px-3 py-2"
              aria-label="Pim Etiket — Anasayfa"
            >
              <PimAsset variant="logo" size={220} bob={false} />
            </Link>
            <p className="text-[13px] max-w-[280px] text-white/65 leading-relaxed">
              Türkiye&rsquo;nin akıllı dijital baskı atölyesi. Bursa&rsquo;dan,
              küçük markalar için.
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_GROUPS.map((g) => (
            <div key={g.t}>
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] mb-3.5 text-white/50">
                {g.t}
              </div>
              <div className="flex flex-col gap-2.5">
                {g.links.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    className="text-[13px] text-white/85 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom strip */}
        <div className="pt-6 border-t border-white/10 flex justify-between items-center text-[13px] text-white/55 flex-wrap gap-4">
          <div className="flex items-center gap-2">
            © {new Date().getFullYear()} Pim Etiket — Bursa
          </div>
          <div className="flex gap-x-5 gap-y-2 flex-wrap">
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
