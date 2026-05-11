"use client";

/**
 * Pim Etiket — Anasayfa kullanım alanı seçici (Sefa Madde 8, 11 May)
 *
 * "Neye baskı yapacağım?" karar ağacı. 8 use case kartı, tıklayınca
 * önerilen ürün + malzeme + CTA açılır. Yeni kullanıcıların etiket/sticker
 * farkını anlaması + doğru konfigüratöre yönlenmesi için.
 */

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";

interface UseCase {
  id: string;
  emoji: string;
  title: string;
  product: "etiket" | "sticker";
  productHref: string;
  material: string;
  reco: string;
}

const USE_CASES: UseCase[] = [
  {
    id: "kavanoz",
    emoji: "🍯",
    title: "Kavanoz / şişe etiketi",
    product: "etiket",
    productHref: "/etiket",
    material: "Beyaz semi-glos veya kraft + parlak selefon",
    reco: "Su ve nem dayanımı önemli — kaplama tavsiye edilir. Cam kavanozda ultra clear (şeffaf) etiket de göz alıcı.",
  },
  {
    id: "kozmetik",
    emoji: "💄",
    title: "Kozmetik ürün",
    product: "etiket",
    productHref: "/etiket",
    material: "Soft touch kaplamalı beyaz veya metalik",
    reco: "Premium hissi için soft touch veya metalik etiket. Tonik/serum şişelerinde ultra clear etiket de güzel duruyor.",
  },
  {
    id: "gida",
    emoji: "🍫",
    title: "Gıda ambalajı",
    product: "etiket",
    productHref: "/etiket",
    material: "Kraft veya beyaz semi-glos + selefon",
    reco: "Doğal/organik mesajı için kraft etiket. Soğuk zincir varsa kaplama zorunlu (buzdolabı, suya dayanım).",
  },
  {
    id: "parti",
    emoji: "🎉",
    title: "Parti / etkinlik / hediye",
    product: "sticker",
    productHref: "/sticker",
    material: "Holografik veya simli sticker",
    reco: "Holografik sticker ışıkta renk kayar — etkinlik coşkusu için ideal. Çocuk partilerinde simli tercih edilir.",
  },
  {
    id: "laptop",
    emoji: "💻",
    title: "Laptop / araba / kişisel",
    product: "sticker",
    productHref: "/sticker",
    material: "Vinil parlak",
    reco: "Klasik die-cut vinil sticker. UV ve suya dayanıklı, 3-5 yıl dış mekan ömrü. Çamaşır makinesinden çıkar.",
  },
  {
    id: "ambalaj",
    emoji: "📦",
    title: "Ürün ambalajı kapatma",
    product: "sticker",
    productHref: "/sticker",
    material: "Daire transparan veya kraft mat",
    reco: "Kargo kutusu mühürlemek için yuvarlak sticker. Kraft görünüm doğal markalara, transparan minimalist için.",
  },
  {
    id: "marka",
    emoji: "🏷️",
    title: "Marka logosu — küçük tiraj",
    product: "sticker",
    productHref: "/sticker",
    material: "Vinil mat (etkinlik için holografik)",
    reco: "25-100 adet etkinlik veya pop-up için sticker. Düşük tirajda matbaa kalitesinden ödün vermeden hızlı teslim.",
  },
  {
    id: "cocuk",
    emoji: "🧸",
    title: "Çocuk ürünü / oyuncak",
    product: "sticker",
    productHref: "/sticker",
    material: "Simli veya holografik",
    reco: "Çocuk dünyasında parlaklık+sim ilgi çeker. CE belgeli olmayan ürünlerde 'oyuncak' yerine 'kırtasiye / ev dekoru' yaz.",
  },
];

export function UseCaseSelector() {
  const [active, setActive] = useState<UseCase | null>(null);

  return (
    <section className="bg-white py-12 md:py-16">
      <div className="mx-auto max-w-[1180px] px-4 md:px-8">
        <div className="text-center mb-8">
          <Eyebrow>Karar ver</Eyebrow>
          <h2 className="mt-3 text-[26px] md:text-[36px] font-semibold tracking-tight">
            Neye baskı yapacaksın?
          </h2>
          <p className="mt-2 text-base text-gri-700 max-w-[560px] mx-auto">
            Aşağıdaki kartlardan biriyle başla — sana doğru ürün ve malzeme
            önerisi verelim.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {USE_CASES.map((u) => {
            const isActive = active?.id === u.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setActive(isActive ? null : u)}
                aria-pressed={isActive}
                className={cn(
                  "rounded-xl p-4 text-left transition-all ring-1",
                  isActive
                    ? "bg-pim-mercan-tint ring-pim-mercan shadow-1"
                    : "bg-gri-50 ring-gri-200 hover:bg-white hover:ring-pim-mercan-soft hover:shadow-1"
                )}
              >
                <div className="text-3xl mb-2" aria-hidden="true">
                  {u.emoji}
                </div>
                <div className="font-semibold text-[14px] text-lacivert leading-tight">
                  {u.title}
                </div>
                <div className="text-[11px] text-gri-700 mt-1.5 uppercase tracking-[0.04em] font-semibold">
                  {u.product === "etiket" ? "Etiket" : "Sticker"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detay paneli — seçim sonrası açılır */}
        {active && (
          <div className="mt-6 rounded-2xl bg-gradient-to-br from-pim-mercan-tint to-krem-soft p-6 md:p-7 ring-1 ring-pim-mercan/20 animate-fade-up">
            <div className="flex items-start gap-4 flex-wrap">
              <span className="text-5xl shrink-0" aria-hidden="true">
                {active.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-pim-mercan mb-1">
                  Önerimiz · {active.product === "etiket" ? "Etiket" : "Sticker"}
                </div>
                <h3 className="text-[20px] font-semibold text-lacivert mb-2">
                  {active.title}
                </h3>
                <p className="text-[14px] text-gri-700 leading-relaxed mb-3">
                  {active.reco}
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white ring-1 ring-gri-200 text-[12.5px] font-semibold text-lacivert mb-4">
                  <Icon.Sparkle size={13} className="text-pim-mercan" />
                  {active.material}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Link
                    href={active.productHref}
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-pim-mercan text-white font-semibold text-[14px] hover:bg-pim-mercan-koyu transition-colors"
                  >
                    {active.product === "etiket" ? (
                      <>
                        <Icon.Roll size={15} /> Etiket konfigüre et
                      </>
                    ) : (
                      <>
                        <Icon.Sticker size={15} /> Sticker konfigüre et
                      </>
                    )}
                    <Icon.ArrowR size={13} />
                  </Link>
                  <Link
                    href="/malzemeler"
                    className="text-[13px] font-semibold text-pim-mercan hover:underline"
                  >
                    Malzeme detayları →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-[12.5px] text-gri-700 mt-6">
          Tam emin değilsen Pim&rsquo;e sor — sağ alttaki balon her sayfada
          açık.
        </p>
      </div>
    </section>
  );
}
