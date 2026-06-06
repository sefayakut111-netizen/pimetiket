/**
 * Pim Etiket — /sss
 *
 * Sıkça sorulan sorular — 11 kategori tab + accordion. Hibrit format
 * (1 cümle özet + detay paragraf). TR ana, EN minimum fallback.
 *
 * Sefa 18 May v68 (sss-genişleme): 5 kategori 15 soru → 11 kategori 73 soru.
 */

"use client";

import { useState, useEffect } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";
import {
  SSS_CATEGORIES_EN,
  SSS_CATEGORIES_TR,
  SSS_FAQS_EN,
  SSS_FAQS_TR,
  type SssCategory,
} from "@/lib/sss/faq-data";
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
    detailLabel: "Detay",
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
    detailLabel: "Detail",
  },
};

export default function SssPage() {
  const { locale } = useT();
  const isEn = locale === "en";
  const c = isEn ? COPY.en : COPY.tr;
  const CATEGORIES = isEn ? SSS_CATEGORIES_EN : SSS_CATEGORIES_TR;
  const FAQS = isEn ? SSS_FAQS_EN : SSS_FAQS_TR;

  const [active, setActive] = useState<SssCategory>("siparis");
  const items = FAQS[active];

  // URL hash ile paylaşılabilir kategori (örn /sss#kargo)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const validCats: SssCategory[] = [
      "siparis",
      "tasarim",
      "malzeme",
      "kesim",
      "boyut",
      "fiyat",
      "uretim",
      "iade",
      "onizleme",
      "kvkk",
      "yardim",
    ];
    const readHash = () => {
      const h = window.location.hash.replace("#", "") as SssCategory;
      if (validCats.includes(h)) setActive(h);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const changeCategory = (cat: SssCategory) => {
    setActive(cat);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${cat}`);
    }
  };

  return (
    <main className="animate-fade-up">
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
        <div className="mx-auto max-w-[1100px] px-4 md:px-8">
          <div className="flex gap-2 flex-wrap justify-center">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => changeCategory(cat.id)}
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

      {/* FAQ ACCORDION — hibrit format (summary + detail) */}
      <section className="pb-12 md:pb-16">
        <div className="mx-auto max-w-[800px] px-4 md:px-8 flex flex-col gap-3">
          {items.map((f, i) => (
            <details
              key={`${active}-${i}`}
              className="bg-white rounded-lg shadow-1 ring-1 ring-black/[0.04] px-5 md:px-6 py-4 group open:bg-gri-50 transition-colors"
            >
              <summary className="flex justify-between items-center list-none font-semibold text-[15px] md:text-base gap-4 cursor-pointer">
                <span>{f.q}</span>
                <span className="text-pim-mercan text-xl group-open:rotate-45 transition-transform shrink-0">
                  +
                </span>
              </summary>
              {/* Özet — bold, hemen altında */}
              <p className="mt-3 text-[15px] md:text-base text-lacivert font-medium leading-relaxed">
                {f.summary}
              </p>
              {/* Detay — ikincil paragraf, daha küçük + gri */}
              <details className="mt-3 group/d">
                <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-[13px] font-semibold text-pim-mercan hover:underline">
                  <span className="group-open/d:rotate-90 transition-transform inline-block">
                    ▸
                  </span>
                  {c.detailLabel}
                </summary>
                <p className="mt-2 text-[14px] text-gri-700 leading-[1.7]">
                  {f.detail}
                </p>
              </details>
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
