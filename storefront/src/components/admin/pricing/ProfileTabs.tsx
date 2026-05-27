/**
 * ProfileTabs — Fiyat hesaplama sayfalarında 3 profil arası geçiş.
 *
 * Sefa 17 May v5: "tek link altında ama farklı başlıklarda — Sticker /
 * Rulo Etiket / Tabaka Etiket".
 *
 * /admin/fiyat-hesapla        →  Sticker
 * /admin/fiyat-hesapla-etiket →  Rulo Etiket
 * /admin/fiyat-hesapla-tabaka →  Tabaka Etiket
 *
 * Aktif sekme vurgulanır, diğerleri linklerle tıklanabilir.
 */

"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

type Profile = "sticker" | "rulo" | "tabaka";

interface TabDef {
  id: Profile;
  emoji: string;
  label: string;
  href: string;
  accent: string;
  bg: string;
}

const TABS: TabDef[] = [
  {
    id: "sticker",
    emoji: "",
    label: "Sticker",
    href: "/admin/fiyat-hesapla",
    accent: "text-pim-mercan",
    bg: "bg-pim-mercan-tint",
  },
  {
    id: "rulo",
    emoji: "",
    label: "Rulo Etiket",
    href: "/admin/fiyat-hesapla-etiket",
    accent: "text-yesil",
    bg: "bg-yesil-soft",
  },
  {
    id: "tabaka",
    emoji: "",
    label: "Tabaka Etiket",
    href: "/admin/fiyat-hesapla-tabaka",
    accent: "text-saman-koyu",
    bg: "bg-saman/15",
  },
];

export function ProfileTabs({ active }: { active: Profile }) {
  return (
    <div className="mb-5">
      <div className="text-[10.5px] uppercase tracking-[0.06em] font-bold text-gri-500 mb-2">
        FİYAT HESAPLAMA — ÜRÜN PROFİLİ SEÇ
      </div>
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-2 h-11 px-5 rounded-full font-semibold text-[14px] transition-all ring-1",
                isActive
                  ? cn(tab.bg, tab.accent, "ring-current shadow-1")
                  : "bg-white text-gri-700 ring-gri-200 hover:ring-pim-mercan hover:text-lacivert hover:-translate-y-0.5"
              )}
            >
              <span className="text-[18px]">{tab.emoji}</span>
              <span>{tab.label}</span>
              {isActive && (
                <span className="ml-1 inline-flex items-center h-[18px] px-1.5 rounded-full bg-white/70 text-[9.5px] font-bold uppercase tracking-[0.04em]">
                  AKTİF
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
