/**
 * InfoTooltip — "?" ikonu + hover/focus tooltip (UX uzman 2.4).
 *
 * Sefa 18 May v68: Teknik terimler ("Die Cut", "Spot UV", "Soft Touch",
 * "Ultra Clear") sektörel jargon — ilk kez sipariş veren kullanıcı için
 * anlaşılmıyor. Sefa kararı: Türkçe karşılığa çevirmek yerine, terim aynı
 * kalsın, yanına "?" ikon → tooltip ile açıklama eklensin.
 *
 * Kullanım:
 *   <span>Spot UV <InfoTooltip text="Belirli alanları parlatan şeffaf katman, ürünün öne çıkmasını sağlar." /></span>
 *
 * A11y:
 *   - button (focusable, keyboard erişimi)
 *   - aria-describedby ile tooltip içerik bağlanır
 *   - title attribute fallback (hover OS-level tooltip)
 *   - role="tooltip" hover/focus'da visible div
 *
 * Mobile: tap → tooltip toggle.
 */

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface InfoTooltipProps {
  /** Tooltip içeriği (1-2 cümle Türkçe açıklama) */
  text: string;
  /** İkon rengi (varsayılan gri-500) */
  iconClassName?: string;
}

/**
 * InfoTooltip — "?" ikon + portal-rendered hover tooltip.
 *
 * Sefa 18 May v68: SelectableCard'ın transform/shadow/ring kombinasyonu
 * stacking context yaratıp tooltip'i yan kartların ALTINDA bırakıyordu.
 * Çözüm: createPortal ile tooltip body'ye render edilir → hiçbir parent
 * constraint yok, tüm sayfa üstünde z-[9999] ile görünür.
 *
 * Pozisyon: buton'un getBoundingClientRect ile koordinat hesaplanır,
 * fixed position ile butonun üstünde 8px boşlukla render edilir.
 * Sayfa scroll edilirse resize/scroll listener ile pozisyon güncellenir.
 */
export function InfoTooltip({
  text,
  iconClassName = "text-gri-500 hover:text-pim-mercan",
}: InfoTooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tooltip pozisyonu — butonun ekran koordinatlarına göre hesapla
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = btnRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.top, // viewport-relative (fixed positioning)
        left: rect.left + rect.width / 2, // ikon merkezi
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  return (
    <span className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        aria-label="Bilgi"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full ring-1 ring-current text-[9px] font-bold leading-none transition-colors cursor-help shrink-0 ${iconClassName}`}
      >
        ?
      </button>
      {open &&
        mounted &&
        pos &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top - 8, // ikondan 8px yukarı
              left: pos.left,
              transform: "translate(-50%, -100%)",
              maxWidth: 220,
              zIndex: 9999,
              pointerEvents: "none",
            }}
            className="w-max px-2.5 py-1.5 rounded-lg bg-lacivert text-white text-[11.5px] leading-snug shadow-mercan font-normal text-left whitespace-normal"
          >
            {text}
            {/* Üçgen ok (caret) — tooltip ikondan çıkıyor hissi */}
            <span
              aria-hidden
              className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent"
              style={{ borderTopColor: "var(--color-lacivert)" }}
            />
          </div>,
          document.body
        )}
    </span>
  );
}
