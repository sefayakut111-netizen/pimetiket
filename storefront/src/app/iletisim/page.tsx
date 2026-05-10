/**
 * Pim Etiket — /iletisim
 *
 * 2-col layout: 3 iletişim kanalı kartı + atölye bilgileri + harita.
 * Client (i18n hook). Metadata layout.tsx'te.
 */

"use client";

import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";
import { useT } from "@/lib/i18n/context";

const COPY = {
  tr: {
    eyebrow: "İletişim",
    h1Line1: "Pim'e bir mesaj at,",
    h1Line2: "cevap hızlı gelir.",
    intro:
      "Aklındakini en hızlı şekilde çözmek için 3 farklı kanal ve sağ alt köşede bekleyen Pim — istediğin yere yaz.",
    waTitle: "Pim Sohbet",
    waDesc: "Sağ alt köşedeki Pim'e tıkla, GPT-4 destekli AI hemen yanıtlar.",
    waCta: "Pim'e yaz",
    emailTitle: "E-posta",
    emailDesc: "Detaylı sorular, teklif istekleri, B2B partnership için.",
    workshopTitle: "Atölye Ziyareti",
    workshopDesc: "Numune almak veya tanışmak için randevulu ziyaret.",
    workshopCta: "Bilgi al",
    bursaEyebrow: "Pim Etiket atölyesi",
    bursaTitle1: "Numune almak için",
    bursaTitle2: "iletişime geç.",
    addressLabel: "Üretim",
    addressNote:
      "İstanbul & Ankara — anlaşmalı dijital baskı atölyelerinde fason üretim",
    hoursLabel: "Yanıt saatleri",
    hoursMonFri: "Pazartesi – Cuma · 09:00 – 18:00",
    hoursSat: "Cumartesi · 10:00 – 14:00 (acele siparişler)",
    appointmentLabel: "Randevu",
    appointmentText:
      "Ziyaret etmek istersen önce e-posta yaz, atölye konumu ve uygunluk bilgisini paylaşalım.",
    waButton: "E-posta gönder",
    mapSoonTitle: "Atölye konumu",
    mapSoonDesc:
      "Pim Etiket fason üretim modeliyle çalışır. Spesifik atölye konumu randevu sırasında paylaşılır.",
    faqEyebrow: "Önce SSS'ye bakmak istersen",
    faqTitle: "Cevabın hazır olabilir.",
    faqOrder: "Sipariş aşaması",
    faqProduction: "Üretim & AI kontrolü",
    faqShipping: "Kargo & teslim",
  },
  en: {
    eyebrow: "Contact",
    h1Line1: "Send Pim a message,",
    h1Line2: "we respond fast.",
    intro:
      "Three different channels and Pim waiting in the bottom-right corner — pick whichever you prefer.",
    waTitle: "Pim Chat",
    waDesc:
      "Click Pim in the bottom-right corner — GPT-4 powered AI replies instantly.",
    waCta: "Chat with Pim",
    emailTitle: "Email",
    emailDesc: "Detailed questions, RFQs, B2B partnerships.",
    workshopTitle: "Workshop visit",
    workshopDesc: "Visit by appointment to see samples or get to know us.",
    workshopCta: "Get info",
    bursaEyebrow: "Pim Etiket workshop",
    bursaTitle1: "Drop a line for samples",
    bursaTitle2: "or to get to know us.",
    addressLabel: "Production",
    addressNote:
      "Istanbul & Ankara — partner digital print workshops (fason model)",
    hoursLabel: "Response hours",
    hoursMonFri: "Monday – Friday · 09:00 – 18:00",
    hoursSat: "Saturday · 10:00 – 14:00 (rush orders)",
    appointmentLabel: "Appointment",
    appointmentText:
      "If you'd like to visit, drop us an email first — we'll share the workshop location and availability.",
    waButton: "Send email",
    mapSoonTitle: "Workshop location",
    mapSoonDesc:
      "Pim Etiket runs on a fason production model. The specific workshop location is shared during appointment booking.",
    faqEyebrow: "Want to check the FAQ first?",
    faqTitle: "Your answer might already be there.",
    faqOrder: "Ordering",
    faqProduction: "Production & AI check",
    faqShipping: "Shipping & delivery",
  },
};

export default function IletisimPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;

  const CONTACT_METHODS = [
    {
      icon: <Icon.ChatBubble size={20} />,
      title: c.waTitle,
      desc: c.waDesc,
      cta: c.waCta,
      // Pim chat widget her sayfada açık — kullanıcı tıklayınca odaklanır
      href: "#pim-chat",
      accent: "bg-pim-mercan-tint text-pim-mercan",
    },
    {
      icon: <Icon.Sparkle size={20} />,
      title: c.emailTitle,
      desc: c.emailDesc,
      cta: "info@pimetiket.com",
      href: "mailto:info@pimetiket.com",
      accent: "bg-yesil-soft text-yesil",
    },
    {
      icon: <Icon.Truck size={20} />,
      title: c.workshopTitle,
      desc: c.workshopDesc,
      cta: c.workshopCta,
      href: "#harita",
      accent: "bg-krem text-lacivert",
    },
  ];

  const FAQ_LINKS = [
    { q: c.faqOrder, href: "/sss?cat=siparis" },
    { q: c.faqProduction, href: "/sss?cat=uretim" },
    { q: c.faqShipping, href: "/sss?cat=kargo" },
  ];

  return (
    <main className="animate-fade-up">
      {/* HERO */}
      <section className="pt-10 md:pt-16 pb-8 md:pb-12">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 md:gap-8 items-end">
          <div>
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h1 className="mt-4 text-[32px] md:text-[52px] font-semibold tracking-[-0.02em] leading-[1.05]">
              {c.h1Line1}
              <br />
              <span className="text-pim-mercan">{c.h1Line2}</span>
            </h1>
            <p className="mt-5 text-[15px] md:text-lg text-gri-700 max-w-[520px] leading-relaxed">
              {c.intro}
            </p>
          </div>
          <Pim pose="wave" size={180} className="hidden md:inline-block" />
        </div>
      </section>

      {/* 3 İLETİŞİM KANALI */}
      <section className="py-6 md:py-8">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {CONTACT_METHODS.map((m) => (
              <Card key={m.title} padding="p-6 md:p-7">
                <div
                  className={`grid place-items-center w-11 h-11 rounded-xl mb-4 ${m.accent}`}
                >
                  {m.icon}
                </div>
                <h3 className="text-lg md:text-xl font-semibold mb-1.5">
                  {m.title}
                </h3>
                <p className="text-[15px] md:text-base text-gri-700 leading-relaxed mb-4">
                  {m.desc}
                </p>
                <a
                  href={m.href}
                  target={m.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    m.href.startsWith("http")
                      ? "noopener noreferrer"
                      : undefined
                  }
                  className="inline-flex items-center gap-1.5 text-pim-mercan font-semibold hover:underline"
                >
                  {m.cta} <Icon.ArrowR size={14} />
                </a>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* HARİTA + ATÖLYE */}
      <section className="py-10 md:py-12" id="harita">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-6 items-start">
            {/* Sol — atölye bilgileri */}
            <div>
              <Eyebrow>{c.bursaEyebrow}</Eyebrow>
              <h2 className="mt-4 text-[24px] md:text-[32px] font-semibold tracking-tight leading-tight">
                {c.bursaTitle1}
                <br />
                {c.bursaTitle2}
              </h2>

              <div className="mt-6 space-y-4 text-[15px] md:text-base text-gri-700">
                <div>
                  <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-500 mb-1">
                    {c.addressLabel}
                  </div>
                  <div className="leading-relaxed">
                    {c.addressNote}
                  </div>
                </div>
                <div>
                  <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-500 mb-1">
                    {c.hoursLabel}
                  </div>
                  <div className="leading-relaxed">
                    {c.hoursMonFri}
                    <br />
                    {c.hoursSat}
                  </div>
                </div>
                <div>
                  <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-500 mb-1">
                    {c.appointmentLabel}
                  </div>
                  <div className="leading-relaxed">
                    {c.appointmentText}
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Button variant="primary" href="mailto:info@pimetiket.com">
                  <Icon.ChatBubble size={16} /> {c.waButton}
                </Button>
              </div>
            </div>

            {/* Sağ — harita */}
            <div className="rounded-2xl overflow-hidden ring-1 ring-gri-200 shadow-1 aspect-[4/3] bg-gri-100 grid place-items-center text-center">
              <div className="px-6 py-12">
                <Icon.Truck size={48} className="text-gri-500 mx-auto mb-4" />
                <div className="font-semibold text-lacivert mb-2">
                  {c.mapSoonTitle}
                </div>
                <p className="text-[13px] text-gri-700 max-w-[280px] mx-auto leading-relaxed">
                  {c.mapSoonDesc}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SSS LİNK */}
      <section className="py-12 md:py-16 bg-gri-50">
        <div className="mx-auto max-w-[800px] px-4 md:px-8 text-center">
          <Eyebrow>{c.faqEyebrow}</Eyebrow>
          <h2 className="mt-4 text-[20px] md:text-[28px] font-semibold tracking-tight">
            {c.faqTitle}
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
