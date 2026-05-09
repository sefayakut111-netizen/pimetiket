/**
 * Pim Etiket — /sss (E.1.5)
 *
 * Sıkça sorulan sorular — 5 kategori tab + accordion.
 * Voice/tone: samimi, ikinci tekil, anlatıcı (DESIGN_SYSTEM §5).
 */

"use client";

import { useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";

type Category = "siparis" | "uretim" | "kargo" | "odeme" | "iade";

const CATEGORIES: { id: Category; name: string }[] = [
  { id: "siparis", name: "Sipariş" },
  { id: "uretim", name: "Üretim" },
  { id: "kargo", name: "Kargo" },
  { id: "odeme", name: "Ödeme" },
  { id: "iade", name: "İade" },
];

const FAQS: Record<Category, { q: string; a: string }[]> = {
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
      a: "Bursa'daki fason ortaklarımızda üretim 6-9 gün arası sürer. Hızlı şerit opsiyonu ile 3-5 güne düşürebiliyoruz (ek ücret).",
    },
    {
      q: "Provayı nasıl onaylıyorum?",
      a: "Tasarımın matbaa öncesi nasıl görüneceğini panel ekranında 3D-ish önizlemeyle gösteriyoruz. Onayladıktan sonra üretime giriyor.",
    },
    {
      q: "AI'lı kalite kontrolü ne yapıyor?",
      a: "Pim, dosyandaki çözünürlük, renk uzayı, yazım hataları, marka uyumsuzlukları gibi tipik baskı sorunlarını saniyeler içinde tespit eder. Operatör son kontrolü yapar, gerekirse seninle iletişime geçer.",
    },
  ],
  kargo: [
    {
      q: "Kargo ücreti var mı?",
      a: "[Sefa not: 1500 TL üzeri ücretsiz / 1500 TL altı X TL gibi politikan netleşince güncelle]",
    },
    {
      q: "Hangi kargo firmasıyla gönderiyorsunuz?",
      a: "[Sefa not: Yurtiçi/Aras/Sürat kararı]",
    },
    {
      q: "Teslimat süresi nedir?",
      a: "Üretim + kargo dahil ortalama 10 gün. Bursa içi 8 gün, uzak iller 11-12 gün.",
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
      a: "[Sefa not: bankalarla anlaşma sonrası güncelle]",
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

export default function SssPage() {
  const [active, setActive] = useState<Category>("siparis");
  const items = FAQS[active];

  return (
    <main className="animate-fade-up">
      {/* HERO */}
      <section className="pt-16 pb-12">
        <div className="mx-auto max-w-[800px] px-8 text-center">
          <Eyebrow>Sıkça sorulanlar</Eyebrow>
          <h1 className="mt-4 text-[40px] md:text-[56px] font-semibold tracking-[-0.02em] leading-[1.04]">
            Cevap genelde
            <br />
            &ldquo;evet, hallederiz&rdquo;.
          </h1>
          <p className="mt-6 text-lg text-gri-700 leading-relaxed">
            Aklındakini kategoriler altında topladık. Bulamadığını Pim&rsquo;e
            sorabilir veya{" "}
            <a
              href="/iletisim"
              className="text-pim-mercan font-semibold hover:underline"
            >
              iletişim
            </a>{" "}
            sayfasından bize yazabilirsin.
          </p>
        </div>
      </section>

      {/* CATEGORY TABS */}
      <section className="pb-8">
        <div className="mx-auto max-w-[900px] px-8">
          <div className="flex gap-2 flex-wrap justify-center">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(c.id)}
                className={cn(
                  "px-5 py-2.5 rounded-full text-sm font-semibold transition-colors",
                  active === c.id
                    ? "bg-lacivert text-white"
                    : "bg-white ring-1 ring-gri-200 text-gri-700 hover:bg-gri-100 hover:text-lacivert"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ ACCORDION */}
      <section className="pb-16">
        <div className="mx-auto max-w-[800px] px-8 flex flex-col gap-3">
          {items.map((f, i) => (
            <details
              key={`${active}-${i}`}
              className="bg-white rounded-lg shadow-1 ring-1 ring-black/[0.04] px-6 py-4 cursor-pointer group open:bg-gri-50"
            >
              <summary className="flex justify-between items-center list-none font-semibold text-base gap-4">
                {f.q}
                <span className="text-pim-mercan text-xl group-open:rotate-45 transition-transform shrink-0">
                  +
                </span>
              </summary>
              <p className="mt-3 text-base text-gri-700 leading-[1.7]">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* PIM CTA */}
      <section className="py-16 bg-gri-50">
        <div className="mx-auto max-w-[800px] px-8">
          <div className="bg-krem rounded-2xl px-8 md:px-12 py-10 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-6 items-center">
            <Pim pose="think" size={140} />
            <div>
              <h3 className="text-2xl font-semibold tracking-tight">
                Cevabını bulamadın mı?
              </h3>
              <p className="mt-2 text-base text-gri-700 leading-relaxed">
                Pim sağ alt köşede sana yardım etmek için bekliyor — veya
                doğrudan WhatsApp/e-posta üzerinden bize yaz.
              </p>
            </div>
            <Button variant="primary" href="/iletisim">
              <Icon.ChatBubble size={16} /> Bize yaz
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
