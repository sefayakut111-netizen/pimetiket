/**
 * Pim Etiket — /iletisim (E.1.6)
 *
 * 2-col layout: sol iletişim bilgileri, sağ harita iframe.
 * NOT: WhatsApp/e-posta/adres/harita coords placeholder — Sefa düzenleyecek.
 */

import type { Metadata } from "next";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "İletişim",
  description:
    "WhatsApp, e-posta ve Bursa atölye adresi. Numune, fiyat teklifi, fason iş birliği için bize ulaş.",
  alternates: { canonical: "/iletisim" },
};

const CONTACT_METHODS = [
  {
    icon: <Icon.ChatBubble size={20} />,
    title: "WhatsApp",
    desc: "En hızlı yanıt için — mesai içinde 15 dakika içinde döneriz.",
    cta: "Sohbeti aç",
    href: "https://wa.me/905XXXXXXXXX",
    accent: "bg-yesil-soft text-yesil",
    note: "[Sefa not: WhatsApp Business numarası]",
  },
  {
    icon: <Icon.Sparkle size={20} />,
    title: "E-posta",
    desc: "Detaylı sorular, teklif istekleri, ihale.",
    cta: "merhaba@pimetiket.com",
    href: "mailto:merhaba@pimetiket.com",
    accent: "bg-pim-mercan-tint text-pim-mercan",
    note: "[Sefa not: gerçek e-posta adresi]",
  },
  {
    icon: <Icon.Truck size={20} />,
    title: "Bursa Atölye",
    desc: "Numune almak veya tanışmak için randevulu ziyaret.",
    cta: "Konum & yol tarifi",
    href: "#harita",
    accent: "bg-krem text-lacivert",
    note: "[Sefa not: gerçek atölye adresi]",
  },
];

const FAQ_LINKS = [
  { q: "Sipariş aşaması", href: "/sss?cat=siparis" },
  { q: "Üretim & AI kontrolü", href: "/sss?cat=uretim" },
  { q: "Kargo & teslim", href: "/sss?cat=kargo" },
];

export default function IletisimPage() {
  return (
    <main className="animate-fade-up">
      {/* HERO */}
      <section className="pt-16 pb-12">
        <div className="mx-auto max-w-[1280px] px-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-end">
          <div>
            <Eyebrow>İletişim</Eyebrow>
            <h1 className="mt-4 text-[40px] md:text-[52px] font-semibold tracking-[-0.02em] leading-[1.05]">
              Pim&rsquo;e bir mesaj at,
              <br />
              <span className="text-pim-mercan">cevap hızlı gelir.</span>
            </h1>
            <p className="mt-5 text-lg text-gri-700 max-w-[520px] leading-relaxed">
              Aklındakini en hızlı şekilde çözmek için 3 farklı kanal ve sağ alt
              köşede bekleyen Pim — istediğin yere yaz.
            </p>
          </div>
          <Pim pose="wave" size={180} className="hidden md:inline-block" />
        </div>
      </section>

      {/* 3 İLETİŞİM KANALI */}
      <section className="py-8">
        <div className="mx-auto max-w-[1280px] px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CONTACT_METHODS.map((m) => (
              <Card key={m.title} padding="p-7">
                <div
                  className={`grid place-items-center w-11 h-11 rounded-xl mb-4 ${m.accent}`}
                >
                  {m.icon}
                </div>
                <h3 className="text-xl font-semibold mb-1.5">{m.title}</h3>
                <p className="text-base text-gri-700 leading-relaxed mb-4">
                  {m.desc}
                </p>
                <a
                  href={m.href}
                  target={m.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    m.href.startsWith("http") ? "noopener noreferrer" : undefined
                  }
                  className="inline-flex items-center gap-1.5 text-pim-mercan font-semibold hover:underline"
                >
                  {m.cta} <Icon.ArrowR size={14} />
                </a>
                <div className="mt-3 text-[11.5px] text-gri-500 italic">
                  {m.note}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* HARİTA + ATÖLYE */}
      <section className="py-12" id="harita">
        <div className="mx-auto max-w-[1280px] px-8">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-6 items-start">
            {/* Sol — atölye bilgileri */}
            <div>
              <Eyebrow>Bursa atölyesi</Eyebrow>
              <h2 className="mt-4 text-[28px] md:text-[32px] font-semibold tracking-tight leading-tight">
                Numune almak için
                <br />
                bize uğra.
              </h2>

              <div className="mt-6 space-y-4 text-base text-gri-700">
                <div>
                  <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-500 mb-1">
                    Adres
                  </div>
                  <div className="leading-relaxed">
                    [Sefa not: atölye adresi]
                    <br />
                    Bursa
                  </div>
                </div>
                <div>
                  <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-500 mb-1">
                    Açılış saatleri
                  </div>
                  <div className="leading-relaxed">
                    Pazartesi – Cuma · 09:00 – 18:00
                    <br />
                    Cumartesi · 10:00 – 14:00 (randevulu)
                  </div>
                </div>
                <div>
                  <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-500 mb-1">
                    Randevu
                  </div>
                  <div className="leading-relaxed">
                    Ziyaret öncesi WhatsApp&rsquo;tan haber ver, hazır olalım.
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Button variant="primary" href="https://wa.me/905XXXXXXXXX">
                  <Icon.ChatBubble size={16} /> WhatsApp&rsquo;tan yaz
                </Button>
              </div>
            </div>

            {/* Sağ — harita */}
            <div className="rounded-2xl overflow-hidden ring-1 ring-gri-200 shadow-1 aspect-[4/3] bg-gri-100 grid place-items-center text-center">
              {/* TODO: Sefa gerçek koordinatları verince Google Maps embed:
                   <iframe src="https://www.google.com/maps/embed?pb=..." /> */}
              <div className="px-6 py-12">
                <Icon.Truck size={48} className="text-gri-500 mx-auto mb-4" />
                <div className="font-semibold text-lacivert mb-2">
                  Harita yakında
                </div>
                <p className="text-[13px] text-gri-700 max-w-[280px] mx-auto leading-relaxed">
                  Atölye adresi ve Google Maps embed&rsquo;i Sefa tarafından
                  eklenecek.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SSS LİNK */}
      <section className="py-16 bg-gri-50">
        <div className="mx-auto max-w-[800px] px-8 text-center">
          <Eyebrow>Önce SSS&rsquo;ye bakmak istersen</Eyebrow>
          <h2 className="mt-4 text-[24px] md:text-[28px] font-semibold tracking-tight">
            Cevabın hazır olabilir.
          </h2>
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {FAQ_LINKS.map((f) => (
              <a
                key={f.href}
                href={f.href}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white ring-1 ring-gri-200 text-sm font-semibold text-lacivert hover:ring-pim-mercan hover:text-pim-mercan transition-colors"
              >
                {f.q} <Icon.ChevR size={14} />
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
