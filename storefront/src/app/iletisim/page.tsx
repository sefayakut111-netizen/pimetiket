/**
 * Pim Etiket — /iletisim
 *
 * Sefa 18 May v68: Sadeleştirildi.
 * - Atölye Ziyareti kartı kaldırıldı (Pim Sohbet + WhatsApp + E-posta + Destek)
 * - noPhoneNote (telefon yok + 30 dk acil) paragrafı kaldırıldı
 * - Üretim adres, Yasal merkez, Randevu blokları kaldırıldı
 * - Yanıt saatleri kaldırıldı, yerine sadece sabit "Mesai saatleri"
 * - Harita placeholder kaldırıldı
 *
 * Sonuç: HERO + 5 kart + Mesai saatleri + SSS link section'ları.
 */

"use client";

import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Card, Eyebrow } from "@/components/ui";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  DEFAULT_CONTACT_PHONE,
  DEFAULT_CONTACT_WHATSAPP,
  formatPhoneDisplay,
  phoneToTelHref,
  phoneToWaHref,
} from "@/lib/site-settings-shared";
import { useT } from "@/lib/i18n/context";
import { formatLegalKunyeLine } from "@/lib/pim/site-facts";

const COPY = {
  tr: {
    eyebrow: "İletişim",
    h1Line1: "Pim'e bir mesaj at,",
    h1Line2: "cevap hızlı gelir.",
    intro:
      "Aklındakini en hızlı şekilde çözmek için kanallarımız ve sağ alt köşede bekleyen Pim — istediğin yere yaz.",
    waTitle: "Pim Sohbet",
    waDesc:
      "Sağ alt köşedeki Pim'e tıkla, yapay zeka destekli sohbet asistanı sorularını anında yanıtlar.",
    waCta: "Pim'e yaz",
    whatsappTitle: "WhatsApp",
    whatsappDesc:
      "Hızlı soru, sipariş takibi ve toplu sipariş için WhatsApp hattımızdan yaz.",
    phoneTitle: "Telefon",
    phoneDesc:
      "Mesai saatlerinde bizi doğrudan arayabilirsin. Hafta içi 09:00 – 18:00.",
    emailTitle: "E-posta",
    emailDesc:
      "Detaylı sorular, teklif istekleri ve kurumsal işbirliği için.",
    hoursEyebrow: "Çalışma saatleri",
    hoursTitle: "Mesai saatleri",
    hoursLine: "Hafta içi · 09:00 – 18:00",
    hoursNote:
      "Pim Etiket yapay zeka destekli sohbet asistanı 7/24 hizmetinizdedir. Operatör desteği yukarıdaki saatlerde aktiftir.",
    faqEyebrow: "Önce SSS'ye bakmak istersen",
    faqTitle: "Cevabın hazır olabilir.",
    faqOrder: "Sipariş & Ödeme",
    faqProduction: "Üretim & Teslim",
    faqShipping: "İade & Garanti",
    legalEyebrow: "Yasal bilgi",
    legalTitle: "Satıcı künyesi",
  },
  en: {
    eyebrow: "Contact",
    h1Line1: "Send Pim a message,",
    h1Line2: "we respond fast.",
    intro:
      "Several channels and Pim waiting in the bottom-right corner — pick whichever works for you.",
    waTitle: "Pim Chat",
    waDesc:
      "Click Pim in the bottom-right corner — the AI-powered chat assistant answers instantly.",
    waCta: "Chat with Pim",
    whatsappTitle: "WhatsApp",
    whatsappDesc:
      "Quick questions, order tracking and bulk orders — message us on WhatsApp.",
    phoneTitle: "Phone",
    phoneDesc:
      "Call us directly during office hours. Weekdays 09:00 – 18:00.",
    emailTitle: "Email",
    emailDesc:
      "Detailed questions, RFQs and corporate partnerships.",
    hoursEyebrow: "Working hours",
    hoursTitle: "Office hours",
    hoursLine: "Weekdays · 09:00 – 18:00",
    hoursNote:
      "Pim Etiket's AI-powered chat assistant is available 24/7. Operator support is active during the hours above.",
    faqEyebrow: "Want to check the FAQ first?",
    faqTitle: "Your answer might already be there.",
    faqOrder: "Order & Payment",
    faqProduction: "Production & Delivery",
    faqShipping: "Returns & Warranty",
    legalEyebrow: "Legal information",
    legalTitle: "Seller details",
  },
};

export default function IletisimPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;
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

  const phoneDisplay = formatPhoneDisplay(contactPhone);
  const whatsappDisplay = formatPhoneDisplay(contactWhatsapp);

  const openPimChat = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("pim-chat-open"));
  }, []);

  const WHATSAPP_ICON = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );

  const CONTACT_METHODS = useMemo(
    () => [
      {
        icon: <Icon.ChatBubble size={20} />,
        title: c.waTitle,
        desc: c.waDesc,
        cta: c.waCta,
        onClick: openPimChat,
        accent: "bg-pim-mercan-tint text-pim-mercan",
      },
      {
        icon: WHATSAPP_ICON,
        title: c.whatsappTitle,
        desc: c.whatsappDesc,
        cta: whatsappDisplay,
        href: phoneToWaHref(contactWhatsapp),
        accent: "bg-yesil-soft text-yesil",
      },
      {
        icon: <Icon.Phone size={20} />,
        title: c.phoneTitle,
        desc: c.phoneDesc,
        cta: phoneDisplay,
        href: phoneToTelHref(contactPhone),
        accent: "bg-mavi-soft text-mavi-koyu",
      },
      {
        icon: <Icon.Sparkle size={20} />,
        title: c.emailTitle,
        desc: c.emailDesc,
        cta: "info@pimetiket.com",
        href: "mailto:info@pimetiket.com",
        accent: "bg-gri-100 text-lacivert",
      },
      {
        icon: <Icon.ChatBubble size={20} />,
        title: "Destek talebi",
        desc: "Sipariş, tasarım veya kargo ile ilgili sorularınız için destek formunu kullanın.",
        cta: "Destek talebi oluştur",
        href: "/destek",
        accent: "bg-lacivert/10 text-lacivert",
      },
    ],
    [
      c,
      contactPhone,
      contactWhatsapp,
      phoneDisplay,
      whatsappDisplay,
      openPimChat,
    ]
  );

  const FAQ_LINKS = [
    { q: c.faqOrder, href: "/sss#siparis" },
    { q: c.faqProduction, href: "/sss#uretim" },
    { q: c.faqShipping, href: "/sss#iade" },
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

      {/* 5 İLETİŞİM KANALI — Pim Sohbet, WhatsApp, Telefon, E-posta, Destek */}
      <section className="py-6 md:py-8">
        <div className="mx-auto max-w-[1100px] px-4 md:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
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
                {m.onClick ? (
                  <button
                    type="button"
                    onClick={m.onClick}
                    className="inline-flex items-center gap-1.5 text-pim-mercan font-semibold hover:underline"
                  >
                    {m.cta} <Icon.ArrowR size={14} />
                  </button>
                ) : (
                  <a
                    href={m.href}
                    target={m.href?.startsWith("http") ? "_blank" : undefined}
                    rel={
                      m.href?.startsWith("http")
                        ? "noopener noreferrer"
                        : undefined
                    }
                    className="inline-flex items-center gap-1.5 text-pim-mercan font-semibold hover:underline"
                  >
                    {m.cta} <Icon.ArrowR size={14} />
                  </a>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* MESAİ SAATLERİ — Sefa 18 May v68: Üretim/Yasal merkez/Randevu/Yanıt
          saatleri kaldırıldı, sadece sabit mesai saatleri */}
      <section className="py-10 md:py-14">
        <div className="mx-auto max-w-[700px] px-4 md:px-8 text-center">
          <Eyebrow>{c.hoursEyebrow}</Eyebrow>
          <h2 className="mt-4 text-[24px] md:text-[32px] font-semibold tracking-tight">
            {c.hoursTitle}
          </h2>
          <p className="mt-4 text-[18px] md:text-[22px] font-semibold text-pim-mercan tabular-nums">
            {c.hoursLine}
          </p>
          <p className="mt-3 text-[13.5px] text-gri-700 max-w-[480px] mx-auto leading-relaxed">
            {c.hoursNote}
          </p>
        </div>
      </section>

      {/* YASAL KÜNYE */}
      <section className="py-8 md:py-10 border-t border-gri-100">
        <div className="mx-auto max-w-[700px] px-4 md:px-8 text-center">
          <Eyebrow>{c.legalEyebrow}</Eyebrow>
          <h2 className="mt-4 text-[18px] md:text-[22px] font-semibold tracking-tight">
            {c.legalTitle}
          </h2>
          <p className="mt-4 text-[13px] text-gri-700 leading-relaxed">
            {formatLegalKunyeLine()}
          </p>
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
