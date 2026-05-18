/**
 * ProductPreviewShell — Canlı önizleme ortak kabuğu.
 *
 * Sefa 18 May v67: Tüm konfigüratör sayfalarında (/etiket, /sticker)
 * AYNI shell kullanılır → tutarlı UX. İçinde:
 *   - Sol üst:  ● Canlı önizleme rozeti
 *   - Sol alt:  BOYUT chip (60×80 mm gerçek ölçü)
 *   - Sağ alt:  3D / Düz toggle
 *   - Merkez:   children (ürün-spesifik mockup)
 *
 * Fon: krem gradient (tüm sayfalarda sabit, marka renk paletinde).
 *
 * Kullanım:
 *   <ProductPreviewShell
 *     width={60}
 *     height={80}
 *     view="3d"
 *     onViewChange={setView}
 *   >
 *     <EtiketLivePreview ... />
 *   </ProductPreviewShell>
 */

"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/context";

/** Sefa 18 May v68 (5): 3D / Eskiz toggle geri eklendi.
 *  - "3d"     → Gerçekçi: material zemin (kraft/holo doku), finish sheen,
 *               perspective rotateX. Müşteri sonucu gerçek malzemede görür.
 *  - "sketch" → Eskiz/diyagram: mercan dolu kontur, perspective yok, sade.
 *               Matbaa düzen ipucu, daha net "yerleşim" hissi. */
export type PreviewView = "3d" | "sketch";

interface ProductPreviewShellProps {
  /** Ürünün gerçek genişliği (mm) — sol alt BOYUT chip gösterir */
  width: number;
  /** Ürünün gerçek yüksekliği (mm) */
  height: number;
  /** Mevcut görüntüleme modu (3d | sketch) */
  view?: PreviewView;
  /** Toggle handler — verilirse sağ altta toggle gösterilir */
  onViewChange?: (next: PreviewView) => void;
  /** İçerideki ürün-spesifik mockup (EtiketLivePreview / StickerLivePreview) */
  children: ReactNode;
  /** Opsiyonel alt yardım metni */
  footnote?: string;
  /** Ek className */
  className?: string;
}

export function ProductPreviewShell({
  width,
  height,
  view = "3d",
  onViewChange,
  children,
  footnote,
  className = "",
}: ProductPreviewShellProps) {
  const { t, locale } = useT();
  const livePreviewLabel =
    (t.config?.livePreviewBadge as string | undefined) ??
    (locale === "en" ? "Live preview" : "Canlı önizleme");
  const sizeLabel = locale === "en" ? "SIZE" : "BOYUT";
  const view3dLabel = "3D";
  const sketchLabel = locale === "en" ? "Sketch" : "Eskiz";
  const footnoteText =
    footnote ??
    (locale === "en"
      ? "Live preview of your selections"
      : "Seçimlerin canlı önizlemesi");

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div
        className="relative rounded-2xl overflow-hidden shadow-1 ring-1 ring-gri-200"
        style={{
          background:
            "linear-gradient(180deg, var(--color-krem) 0%, #EFE3CB 100%)",
          minHeight: 540,
        }}
      >
        {/* Radial highlight (top-right warm glow) */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 70% 20%, rgba(255,255,255,0.55) 0%, transparent 70%)",
          }}
        />

        {/* Sol üst: ● Canlı önizleme rozet */}
        <span className="absolute top-5 left-5 z-10 inline-flex items-center gap-1.5 h-[28px] px-3 rounded-full bg-white shadow-1 text-[12.5px] font-semibold text-lacivert">
          <span className="w-2 h-2 rounded-full bg-yesil" />
          {livePreviewLabel}
        </span>

        {/* Sefa 18 May v68 (koruma): Diagonal watermark — mockup ekran görüntü
            alındığında bile "© pimetiket.com" görünür. Çok hafif opacity
            (0.06) — müşteri akışına engel olmaz ama copy yaparken belirgin. */}
        <div
          aria-hidden
          className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden"
          style={{
            backgroundImage: `repeating-linear-gradient(-30deg, transparent 0, transparent 110px, rgba(31,27,45,0.045) 110px, rgba(31,27,45,0.045) 112px)`,
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 z-0 pointer-events-none select-none flex items-center justify-center"
        >
          <span
            className="text-lacivert font-bold uppercase tracking-[0.3em]"
            style={{
              transform: "rotate(-30deg)",
              fontSize: "clamp(11px, 2.2vw, 18px)",
              opacity: 0.07,
              whiteSpace: "nowrap",
            }}
          >
            © pimetiket.com · pim etiket © pimetiket.com · pim etiket
          </span>
        </div>

        {/* Merkez içerik */}
        <div className="relative z-0 h-full min-h-[540px] grid place-items-center px-6 py-12">
          {children}
        </div>

        {/* Sol alt: BOYUT bilgi pill — Sefa 18 May v68 (UX uzman 3.3):
            Buton-vari ring kaldırıldı, cursor default, sadece bilgi.
            Pill stili: yumuşak bg, gölgesiz, "non-interactive" his. */}
        <div
          className="absolute bottom-4 left-4 z-10 inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm"
          role="status"
          aria-label={`${sizeLabel}: ${width} × ${height} mm`}
          style={{ cursor: "default" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-gri-700">
            {sizeLabel}
          </span>
          <span className="text-[12.5px] font-semibold text-lacivert tabular-nums">
            {width} × {height} mm
          </span>
        </div>

        {/* Sefa 18 May v68 (5): Sağ alt 3D / Eskiz toggle geri eklendi.
            "Anahtar gibi" iki farklı bakış: 3D gerçekçi vs. Eskiz diyagram. */}
        {onViewChange && (
          <div
            className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-1 p-1 rounded-full bg-white/95 ring-1 ring-gri-200 shadow-1"
            role="group"
            aria-label={
              locale === "en" ? "Preview view mode" : "Önizleme görünüm modu"
            }
          >
            <button
              type="button"
              onClick={() => onViewChange("3d")}
              aria-pressed={view === "3d"}
              className={[
                "h-8 px-3 rounded-full text-[12px] font-semibold transition-colors",
                view === "3d"
                  ? "bg-pim-mercan text-white shadow-mercan"
                  : "text-gri-700 hover:text-pim-mercan",
              ].join(" ")}
            >
              {view3dLabel}
            </button>
            <button
              type="button"
              onClick={() => onViewChange("sketch")}
              aria-pressed={view === "sketch"}
              className={[
                "h-8 px-3 rounded-full text-[12px] font-semibold transition-colors",
                view === "sketch"
                  ? "bg-pim-mercan text-white shadow-mercan"
                  : "text-gri-700 hover:text-pim-mercan",
              ].join(" ")}
            >
              {sketchLabel}
            </button>
          </div>
        )}
      </div>

      {/* Footnote */}
      {footnoteText && (
        <p className="text-[12px] text-gri-700 text-center leading-relaxed">
          {footnoteText}
        </p>
      )}
    </div>
  );
}
