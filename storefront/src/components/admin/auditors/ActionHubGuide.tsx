/**
 * ActionHubGuide — "Bulgular için ne yapacağım?" açıklayıcı 4-adım panel.
 *
 * Sefa 17 May: "orada bulunan hataların aksiyonunu nereden yapmamız lazım?"
 *
 * 10 agent kümülatif olarak bulgular üretiyor. Aksiyon hub hiyerarşisi:
 *
 *   1. Dashboard            — Genel bakış (bu sayfa)
 *   2. /bekleyen            — Senin onayını bekleyen aksiyonlar (kritik)
 *   3. /[auditor]           — Spesifik agent detayı + bulgular
 *   4. /ertelenenler        — Karar verilmiş arşiv (ertelendi/yok sayıldı)
 *   5. /gecmis              — Tüm run geçmişi (denetim audit log)
 *
 * Bu component dashboard'a yerleştirilince kullanıcı akışı netleştirir.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface Step {
  num: number;
  title: string;
  desc: string;
  href: string;
  cta: string;
}

const STEPS: Step[] = [
  {
    num: 1,
    title: "Bekleyen aksiyonlar",
    desc: "Senin onayını bekleyen kritik bulgular. Önce buraya bak — gerçek müdahale gerektirenler burada.",
    href: "/admin/denetciler/bekleyen",
    cta: "Bekleyenleri aç",
  },
  {
    num: 2,
    title: "Agent detayı",
    desc: "Bir bulgunun bağlamı için ilgili agent kartına tıkla. Son run + tüm bulgular + markdown rapor.",
    href: "#",
    cta: "↓ Aşağıdaki agent kartlarına bak",
  },
  {
    num: 3,
    title: "Karar arşivi",
    desc: "Ertelediğin / yok saydığın aksiyonlar. Sonradan yeniden değerlendirmek için dön.",
    href: "/admin/denetciler/ertelenenler",
    cta: "Arşivi aç",
  },
  {
    num: 4,
    title: "Tüm geçmiş",
    desc: "Her run'ın audit log'u — kim ne zaman çalıştırdı, ne çıktı. Compliance için kayıt.",
    href: "/admin/denetciler/gecmis",
    cta: "Geçmişi aç",
  },
];

export function ActionHubGuide() {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-pim-mercan hover:underline"
      >
         Aksiyon rehberini göster →
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-krem to-krem-soft ring-1 ring-black/[0.04] p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 h-[22px] rounded-full bg-pim-mercan text-white text-[11px] font-bold uppercase tracking-[0.04em]">
             REHBER
          </div>
          <h2 className="mt-2 text-[18px] font-semibold tracking-tight text-lacivert">
            Bulgular için aksiyon akışı
          </h2>
          <p className="mt-1 text-[13px] text-gri-700 max-w-[640px] leading-relaxed">
            9 denetçi sürekli rapor üretiyor — sen bir founder olarak{" "}
            <strong>karar veren tek kişisin</strong>. Aşağıdaki sıra
            seni boğmadan en kritikten başlatır.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="text-[12px] text-gri-500 hover:text-lacivert shrink-0"
          aria-label="Rehberi gizle"
          title="Bu rehberi gizle"
        >
           Gizle
        </button>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {STEPS.map((s) => {
          const isHashLink = s.href === "#";
          const inner = (
            <div
              className={cn(
                "h-full rounded-xl bg-white ring-1 ring-gri-200 p-3.5",
                !isHashLink && "hover:ring-pim-mercan hover:-translate-y-0.5",
                "transition-all"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="grid place-items-center w-6 h-6 rounded-full bg-pim-mercan text-white text-[11px] font-bold">
                  {s.num}
                </span>
                <span className="font-semibold text-[13.5px] text-lacivert">
                  {s.title}
                </span>
              </div>
              <p className="text-[12px] text-gri-700 leading-relaxed mb-2.5">
                {s.desc}
              </p>
              <div className="text-[12px] font-semibold text-pim-mercan">
                {s.cta}
              </div>
            </div>
          );
          if (isHashLink) {
            return (
              <li key={s.num} className="cursor-default">
                {inner}
              </li>
            );
          }
          return (
            <li key={s.num}>
              <Link href={s.href} className="block h-full">
                {inner}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
