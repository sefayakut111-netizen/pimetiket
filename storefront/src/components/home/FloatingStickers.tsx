"use client";

/**
 * Pim Etiket — Anasayfa uçuşan etiket/sticker örnekleri
 * (Sefa Madde 6, 11 May)
 *
 * Hero arka planında yavaşça hareket eden 6 dijital sticker/etiket
 * mockup'ı. Brand farkındalığı + ürün çeşitliliği ipucu için.
 *
 * CSS-only animasyon (framer-motion eklemeden) — performans dostu.
 * Motion-reduce kullanıcılar için statik fallback.
 *
 * Hero'nun overlay'inde z-0/z-10 katmanında; içerik (z-20+) önde kalır.
 */

import { cn } from "@/lib/cn";

interface FloatingItem {
  id: string;
  label: string;
  brand: string;
  color: string;
  bgFrom: string;
  bgTo: string;
  textColor: string;
  size: "sm" | "md";
  /** Konum yüzdesi: top + left */
  top: string;
  left: string;
  /** Rotasyon derece + animasyon süresi saniye */
  rotate: number;
  duration: number;
  /** Animasyon başlangıç gecikmesi */
  delay: number;
  /** Sticker mı etiket mi (görsel çerçeve) */
  shape: "rect" | "circle" | "rounded";
}

const ITEMS: FloatingItem[] = [
  // Sol üst — kraft etiket
  {
    id: "kraft-bal",
    label: "BAL",
    brand: "Orman",
    color: "#7A560A",
    bgFrom: "#F5DBC4",
    bgTo: "#E5C8A8",
    textColor: "#3D2E1A",
    size: "sm",
    top: "8%",
    left: "5%",
    rotate: -8,
    duration: 14,
    delay: 0,
    shape: "rect",
  },
  // Sağ üst — holografik sticker (yuvarlak)
  {
    id: "holo",
    label: "🌈",
    brand: "Etkinlik",
    color: "#fff",
    bgFrom: "#ffaff7",
    bgTo: "#a5e8ff",
    textColor: "#1f2937",
    size: "sm",
    top: "14%",
    left: "82%",
    rotate: 12,
    duration: 12,
    delay: 1.5,
    shape: "circle",
  },
  // Sol orta — kozmetik etiket (yuvarlak köşe)
  {
    id: "kozmetik",
    label: "SERUM",
    brand: "Lume",
    color: "#fff",
    bgFrom: "#f8f1ea",
    bgTo: "#e8d9c8",
    textColor: "#5e4730",
    size: "md",
    top: "62%",
    left: "3%",
    rotate: 6,
    duration: 16,
    delay: 0.5,
    shape: "rounded",
  },
  // Sağ orta — vinil sticker
  {
    id: "logo-vinyl",
    label: "★",
    brand: "Pim",
    color: "#fff",
    bgFrom: "#ff6b5b",
    bgTo: "#ff9933",
    textColor: "#fff",
    size: "sm",
    top: "55%",
    left: "88%",
    rotate: -15,
    duration: 11,
    delay: 2,
    shape: "circle",
  },
  // Alt sol — kraft sticker (kare yuvarlak)
  {
    id: "organic",
    label: "ORGANİK",
    brand: "Tarla",
    color: "#3D2E1A",
    bgFrom: "#e5c8a8",
    bgTo: "#d5b58a",
    textColor: "#3D2E1A",
    size: "sm",
    top: "82%",
    left: "12%",
    rotate: -4,
    duration: 15,
    delay: 3,
    shape: "rounded",
  },
  // Alt sağ — transparan sticker
  {
    id: "minimal",
    label: "M.",
    brand: "Minimal",
    color: "#1f2937",
    bgFrom: "rgba(255,255,255,0.85)",
    bgTo: "rgba(243,242,238,0.85)",
    textColor: "#1f2937",
    size: "sm",
    top: "78%",
    left: "85%",
    rotate: 9,
    duration: 13,
    delay: 1,
    shape: "circle",
  },
];

export function FloatingStickers() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 -z-0 pointer-events-none overflow-hidden hidden md:block"
    >
      {ITEMS.map((it) => (
        <FloatingItemView key={it.id} item={it} />
      ))}
    </div>
  );
}

function FloatingItemView({ item }: { item: FloatingItem }) {
  const sizeClass = item.size === "sm" ? "w-[68px] h-[90px]" : "w-[88px] h-[110px]";
  const sizeCircle = item.size === "sm" ? "w-[72px] h-[72px]" : "w-[96px] h-[96px]";

  const isCircle = item.shape === "circle";
  const dims = isCircle ? sizeCircle : sizeClass;

  const radius = isCircle ? "rounded-full" : item.shape === "rounded" ? "rounded-2xl" : "rounded-md";

  return (
    <div
      className={cn("absolute", dims, "shadow-2", radius)}
      style={{
        top: item.top,
        left: item.left,
        background: `linear-gradient(135deg, ${item.bgFrom} 0%, ${item.bgTo} 100%)`,
        animation: `floatBob ${item.duration}s ease-in-out ${item.delay}s infinite`,
        transform: `rotate(${item.rotate}deg)`,
        opacity: 0.85,
      }}
    >
      <div
        className="w-full h-full flex flex-col items-center justify-center text-center px-1.5"
        style={{ color: item.textColor }}
      >
        <div className="text-[7px] font-bold tracking-[0.12em] opacity-70">
          {item.brand.toUpperCase()}
        </div>
        <div
          className={cn(
            "font-bold leading-none mt-0.5",
            item.label.length === 1 ? "text-[28px]" : "text-[11px]"
          )}
        >
          {item.label}
        </div>
        {!isCircle && (
          <>
            <div
              className="w-6 h-px my-1 opacity-30"
              style={{ background: item.textColor }}
            />
            <div className="text-[5.5px] tracking-[0.06em] opacity-50">
              CMYK · PİM
            </div>
          </>
        )}
      </div>
    </div>
  );
}
