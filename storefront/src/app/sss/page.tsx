/**
 * Pim Etiket — /sss
 *
 * Sıkça sorulan sorular — 5 kategori tab + accordion. TR/EN i18n.
 * Voice/tone: samimi, ikinci tekil.
 */

"use client";

import { useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";
import { SchemaJsonLd, faqSchema } from "@/components/SchemaJsonLd";

type Category = "siparis" | "uretim" | "kargo" | "odeme" | "iade";

const CATEGORIES_TR: { id: Category; name: string }[] = [
  { id: "siparis", name: "Sipariş" },
  { id: "uretim", name: "Üretim" },
  { id: "kargo", name: "Kargo" },
  { id: "odeme", name: "Ödeme" },
  { id: "iade", name: "İade" },
];

const CATEGORIES_EN: { id: Category; name: string }[] = [
  { id: "siparis", name: "Ordering" },
  { id: "uretim", name: "Production" },
  { id: "kargo", name: "Shipping" },
  { id: "odeme", name: "Payment" },
  { id: "iade", name: "Returns" },
];

const FAQS_TR: Record<Category, { q: string; a: string }[]> = {
  siparis: [
    {
      q: "Minimum kaç adet basabiliyorum?",
      a: "Etiket için 1000 (500'er artışla), sticker için 25 adetten (25'er artışla) başlıyoruz. Düşük adetlerde de kaliteden ödün vermeden bastırırız.",
    },
    {
      q: "Tasarım dosyam yok, ne yapacağım?",
      a: "Pim'e söyle, basit bir tasarım için kütüphanemizdeki şablonlardan birini özelleştirebilirsin; daha karmaşık iş için partner stüdyolarımızla bağlarız.",
    },
    {
      q: "Sipariş verdikten sonra dosyamı ne zaman yüklemem gerekir?",
      a: "Ödeme sonrası 3 gün içinde dosyanı yüklemen yeterli. AI Pim hemen kontrol eder, eksik varsa söyler.",
    },
    {
      q: "Hangi dosya formatlarını kabul ediyorsunuz?",
      a: "PDF (tercih edilen), AI, EPS ve yüksek çözünürlüklü PNG. CMYK renk uzayı, 300 DPI. Detaylar konfigüratör sayfasında.",
    },
  ],
  uretim: [
    {
      q: "Üretim ne kadar sürer?",
      a: "İstanbul ve Ankara fason ortaklarımızda etiket üretimi 6-9 gün, sticker 3-5 gün. Hızlı şerit opsiyonu ile etiketi 3-5 güne düşürebiliyoruz (ek ücret).",
    },
    {
      q: "Provayı nasıl onaylıyorum?",
      a: "Tasarımın matbaa öncesi nasıl görüneceğini panel ekranında 3D-ish önizlemeyle gösteriyoruz. Onayladıktan sonra üretime giriyor.",
    },
    {
      q: "AI dosya kontrolü ne yapıyor?",
      a: "Pim dosyana bakar — DPI, CMYK, kenar boşluğu (bleed) eksikse üretime gitmeden söyler. Sonra operatörümüz son göz atar, gerekirse seninle iletişime geçer.",
    },
  ],
  kargo: [
    {
      q: "Kargo ücreti var mı?",
      a: "1.000 TL üzeri alışverişlerde kargo ücretsiz, altında sabit ücret. Tutar admin ayarlarından güncellenebiliyor.",
    },
    {
      q: "Hangi kargo firmasıyla gönderiyorsunuz?",
      a: "Anlaşmalı kargo firmalarımız: Yurtiçi Kargo, Aras Kargo ve MNG Kargo. Sipariş hazırlandığında en hızlı seçenek otomatik atanır; takip numaran panelinde görünür.",
    },
    {
      q: "Teslimat süresi nedir?",
      a: "5 iş günü içinde kargoya veriyoruz. Kargo süresi şehre göre 1-3 iş günü daha sürer; İstanbul ve Ankara içi en hızlı, uzak iller 1-2 gün daha geç olabilir.",
    },
    {
      q: "Kargo takip linkim olacak mı?",
      a: "Evet. Sipariş kargoya verildiğinde panelinde takip numarası gösterilir + sana e-posta/SMS ile bildirim gelir.",
    },
  ],
  odeme: [
    {
      q: "Hangi ödeme yöntemlerini kabul ediyorsunuz?",
      a: "Kredi kartı, banka kartı (3D Secure ile). Kurumsal müşteriler için fatura sonrası ödeme seçeneği yakında.",
    },
    {
      q: "Taksit yapabiliyor muyum?",
      a: "Ödeme altyapımız PayTR. Taksit imkânı bankana ve kart tipine bağlı olarak ödeme adımında otomatik gösterilir; biz ek komisyon eklemiyoruz.",
    },
    {
      q: "Fatura kesiyor musunuz?",
      a: "Evet, e-arşiv (bireysel) veya e-fatura (kurumsal) keseriz. Fatura tipi konfigüratörde seçilir.",
    },
    {
      q: "KDV dahil mi?",
      a: "Konfigüratörde gördüğün tüm fiyatlar KDV dahildir.",
    },
  ],
  iade: [
    {
      q: "Cayma hakkım var mı?",
      a: "Kişisel tasarımına göre üretildiği için, ürün siparişlerinde 6502 sayılı TKHK madde 15/b uyarınca cayma hakkı bulunmamaktadır. Detaylar /cayma-hakki sayfasında.",
    },
    {
      q: "Ürün hatalı geldiyse ne yapmalıyım?",
      a: "Üretim hatası, baskı bozukluğu, kargo hasarı gibi durumlarda 7 gün içinde bize ulaş — yenisini ücretsiz bastırır veya ödemeni iade ederiz.",
    },
    {
      q: "Provayı onayladıktan sonra fikrimi değiştirdim, iptal edebilir miyim?",
      a: "Prova onayı sonrası üretim başlamış olur, iptal mümkün olmayabilir. Onaydan önce her zaman iptal edebilirsin — paneldeki sipariş detayından.",
    },
  ],
};

const FAQS_EN: Record<Category, { q: string; a: string }[]> = {
  siparis: [
    {
      q: "What's the minimum order quantity?",
      a: "Labels start from 1,000 (in 500-unit steps), stickers from 25 (in 25-unit steps). We don't compromise on quality even at low volumes.",
    },
    {
      q: "I don't have a design file, what should I do?",
      a: "Tell Pim — for simple designs you can customize a template from our library; for more complex work we connect you with partner studios.",
    },
    {
      q: "When do I need to upload my file after ordering?",
      a: "Within 3 days after payment. Pim's AI checks it instantly and tells you if anything's missing.",
    },
    {
      q: "Which file formats do you accept?",
      a: "PDF (preferred), AI, EPS and high-resolution PNG. CMYK color space, 300 DPI. Details on the configurator page.",
    },
  ],
  uretim: [
    {
      q: "How long does production take?",
      a: "Labels take 6-9 days at our Istanbul and Ankara fason partners; stickers 3-5 days. The fast-track option brings labels down to 3-5 days (surcharge applies).",
    },
    {
      q: "How do I approve the proof?",
      a: "We show how your design will look before press in a 3D-ish preview on your dashboard. Once you approve, it goes to production.",
    },
    {
      q: "What does the AI quality check do?",
      a: "Pim detects typical print issues — resolution, color space, typos, brand mismatches — in seconds. The operator does a final review and contacts you if needed.",
    },
  ],
  kargo: [
    {
      q: "Is there a shipping fee?",
      a: "Free shipping over 1,500 TL, otherwise 49 TL. This threshold is configurable from admin settings.",
    },
    {
      q: "Which courier do you use?",
      a: "We work with Yurtiçi Kargo, Aras Kargo, and MNG Kargo. The fastest option is auto-assigned when your order ships; tracking number appears on your dashboard.",
    },
    {
      q: "What's the delivery time?",
      a: "We ship within 5 business days; the courier takes 1-3 more days depending on city. Istanbul and Ankara are fastest; remote cities 1-2 days slower.",
    },
    {
      q: "Will I get a tracking link?",
      a: "Yes. When your order is dispatched, the tracking number appears on your dashboard and you get an email/SMS notification.",
    },
  ],
  odeme: [
    {
      q: "Which payment methods do you accept?",
      a: "Credit and debit cards (with 3D Secure). Corporate post-invoice payment coming soon.",
    },
    {
      q: "Can I pay in installments?",
      a: "Our payment infrastructure is PayTR. Installment options depend on your bank and card type and are shown automatically during checkout; we don't add any extra commission.",
    },
    {
      q: "Do you issue invoices?",
      a: "Yes — e-archive (individual) or e-invoice (corporate). You select the invoice type during checkout.",
    },
    {
      q: "Are prices VAT-inclusive?",
      a: "All prices shown in the configurator are VAT-inclusive.",
    },
  ],
  iade: [
    {
      q: "Do I have a right to withdraw?",
      a: "Since the product is made-to-order, there is no right of withdrawal under Turkish Consumer Law (TKHK 15/b). See /cayma-hakki for details.",
    },
    {
      q: "What if the product arrived defective?",
      a: "For production defects, print issues, or shipping damage — contact us within 7 days. We'll reprint for free or refund your payment.",
    },
    {
      q: "I changed my mind after approving the proof — can I cancel?",
      a: "Once you approve the proof, production starts and cancellation may not be possible. Before approval you can cancel anytime — from the order detail page.",
    },
  ],
};

const COPY = {
  tr: {
    eyebrow: "Sıkça sorulanlar",
    h1Line1: "Cevap genelde",
    h1Line2: "“evet, hallederiz”.",
    intro:
      "Aklındakini kategoriler altında topladık. Bulamadığını Pim'e sorabilir veya ",
    introLink: "iletişim",
    introEnd: " sayfasından bize yazabilirsin.",
    cantFindTitle: "Cevabını bulamadın mı?",
    cantFindDesc:
      "Pim sağ alt köşede sana yardım etmek için bekliyor — ya da doğrudan e-posta ile bize yaz.",
    contactButton: "Bize yaz",
  },
  en: {
    eyebrow: "Frequently asked",
    h1Line1: "Answer is usually",
    h1Line2: "“yes, we got you”.",
    intro: "We grouped the common questions by category. Can't find yours? Ask Pim or ",
    introLink: "contact",
    introEnd: " us directly.",
    cantFindTitle: "Couldn't find your answer?",
    cantFindDesc:
      "Pim is waiting in the bottom-right corner to help — or just send us an email.",
    contactButton: "Contact us",
  },
};

export default function SssPage() {
  const { locale } = useT();
  const isEn = locale === "en";
  const c = isEn ? COPY.en : COPY.tr;
  const CATEGORIES = isEn ? CATEGORIES_EN : CATEGORIES_TR;
  const FAQS = isEn ? FAQS_EN : FAQS_TR;

  const [active, setActive] = useState<Category>("siparis");
  const items = FAQS[active];

  // Tüm FAQ'leri tek liste yapıp JSON-LD'ye çevir (Google Rich Snippet için)
  const allFaqs: { q: string; a: string }[] = [
    ...FAQS.siparis,
    ...FAQS.uretim,
    ...FAQS.kargo,
    ...FAQS.odeme,
    ...FAQS.iade,
  ];

  return (
    <main className="animate-fade-up">
      <SchemaJsonLd data={faqSchema(allFaqs)} />
      {/* HERO */}
      <section className="pt-10 md:pt-16 pb-8 md:pb-12">
        <div className="mx-auto max-w-[800px] px-4 md:px-8 text-center">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-4 text-[32px] md:text-[56px] font-semibold tracking-[-0.02em] leading-[1.04]">
            {c.h1Line1}
            <br />
            {c.h1Line2}
          </h1>
          <p className="mt-6 text-[15px] md:text-lg text-gri-700 leading-relaxed">
            {c.intro}
            <a
              href="/iletisim"
              className="text-pim-mercan font-semibold hover:underline"
            >
              {c.introLink}
            </a>
            {c.introEnd}
          </p>
        </div>
      </section>

      {/* CATEGORY TABS */}
      <section className="pb-6 md:pb-8">
        <div className="mx-auto max-w-[900px] px-4 md:px-8">
          <div className="flex gap-2 flex-wrap justify-center">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActive(cat.id)}
                className={cn(
                  "px-4 md:px-5 py-2.5 rounded-full text-sm font-semibold transition-colors",
                  active === cat.id
                    ? "bg-lacivert text-white"
                    : "bg-white ring-1 ring-gri-200 text-gri-700 hover:bg-gri-100 hover:text-lacivert"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ ACCORDION */}
      <section className="pb-12 md:pb-16">
        <div className="mx-auto max-w-[800px] px-4 md:px-8 flex flex-col gap-3">
          {items.map((f, i) => (
            <details
              key={`${active}-${i}`}
              className="bg-white rounded-lg shadow-1 ring-1 ring-black/[0.04] px-5 md:px-6 py-4 cursor-pointer group open:bg-gri-50"
            >
              <summary className="flex justify-between items-center list-none font-semibold text-[15px] md:text-base gap-4">
                {f.q}
                <span className="text-pim-mercan text-xl group-open:rotate-45 transition-transform shrink-0">
                  +
                </span>
              </summary>
              <p className="mt-3 text-[15px] md:text-base text-gri-700 leading-[1.7]">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* PIM CTA */}
      <section className="py-12 md:py-16 bg-gri-50">
        <div className="mx-auto max-w-[800px] px-4 md:px-8">
          <div className="bg-krem rounded-2xl px-6 md:px-12 py-8 md:py-10 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 md:gap-6 items-center">
            <Pim pose="think" size={120} />
            <div>
              <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
                {c.cantFindTitle}
              </h3>
              <p className="mt-2 text-[15px] md:text-base text-gri-700 leading-relaxed">
                {c.cantFindDesc}
              </p>
            </div>
            <Button variant="primary" href="/iletisim">
              <Icon.ChatBubble size={16} /> {c.contactButton}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
