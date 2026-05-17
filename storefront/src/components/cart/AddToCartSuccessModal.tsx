/**
 * AddToCartSuccessModal — sepete ekleme onayı popup'ı.
 *
 * Sefa kararı 18 May v60-v61: 'ürün sepete eklendikten sonra pop up aç,
 * sepete git ya da sayfada kal diye sor'. v61: UX/A11y reviewer feedback
 * + i18n leak fix uygulandı.
 *
 * A11y kararları (UX/a11y reviewer 18 May):
 * - autoFocus → "Sayfada kal" (destructive olmayan default, kazara
 *   sepete gitme önlemi)
 * - X butonu 44×44 px (WCAG 2.5.5 tap target)
 * - Focus trap: Tab/Shift+Tab modal içinde döngüde kalır
 * - ESC + overlay click ile close
 * - role=dialog + aria-modal=true + aria-labelledby + aria-describedby
 * - Body scroll lock (createPortal ile body'ye render)
 *
 * Metin (i18n reviewer 18 May): tüm string'ler t.cart namespace'inde
 * + t.common.close. Türkçe + İngilizce paralel.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";

interface AddToCartSuccessModalProps {
  open: boolean;
  onClose: () => void;
  /** Opsiyonel — modal başlığı altında gösterilen ürün özeti.
   *  Caller locale-aware string oluşturmalı. */
  productSummary?: string;
}

export function AddToCartSuccessModal({
  open,
  onClose,
  productSummary,
}: AddToCartSuccessModalProps) {
  const { t } = useT();
  // SSR guard — createPortal sadece client'ta
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus trap için refs
  const stayHereBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const goToCartLinkRef = useRef<HTMLAnchorElement | null>(null);

  // ESC + scroll lock + autofocus + focus trap
  useEffect(() => {
    if (!open) return;

    // autoFocus → "Sayfada kal" (destructive olmayan default)
    setTimeout(() => stayHereBtnRef.current?.focus(), 50);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Focus trap — Tab/Shift+Tab modal içinde döngü kur
      if (e.key === "Tab") {
        const candidates: (HTMLElement | null)[] = [
          closeBtnRef.current,
          goToCartLinkRef.current,
          stayHereBtnRef.current,
        ];
        const elements: HTMLElement[] = candidates.filter(
          (el): el is HTMLElement => el !== null
        );
        if (elements.length === 0) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !elements.includes(active!)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !elements.includes(active!)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", handleKey);

    const scrollY = window.scrollY;
    const original = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.position = original.position;
      document.body.style.top = original.top;
      document.body.style.width = original.width;
      document.body.style.overflow = original.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-success-title"
      aria-describedby="cart-success-desc"
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-lacivert-koyu/60 backdrop-blur-sm p-4 animate-fade-up"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative bg-white rounded-2xl shadow-2xl ring-1 ring-gri-200",
          "w-full max-w-[440px] p-6 md:p-7",
          "animate-fade-up"
        )}
      >
        {/* X close — 44×44 px (WCAG tap target) */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="absolute top-2.5 right-2.5 w-11 h-11 rounded-full bg-gri-100 hover:bg-gri-200 text-gri-700 hover:text-lacivert text-base flex items-center justify-center transition-colors"
        >
          ×
        </button>

        {/* Başarı ikonu */}
        <div className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-yesil-soft text-yesil mb-4">
          <Icon.Check size={28} />
        </div>

        {/* Başlık */}
        <h2
          id="cart-success-title"
          className="text-[20px] md:text-[22px] font-semibold text-lacivert text-center leading-tight mb-1.5"
        >
          {t.cart.successTitle}
        </h2>

        {/* Açıklama */}
        <p
          id="cart-success-desc"
          className="text-[13.5px] text-gri-700 text-center leading-relaxed mb-1"
        >
          {t.cart.successDesc}
        </p>

        {/* Ürün özeti — varsa küçük chip */}
        {productSummary && (
          <p className="mt-3 px-3 py-2 rounded-lg bg-krem-soft text-[12px] text-lacivert text-center leading-snug ring-1 ring-krem-koyu/30">
            {productSummary}
          </p>
        )}

        {/* CTA'lar */}
        <div className="mt-5 flex flex-col gap-2.5">
          <Link
            ref={goToCartLinkRef}
            href="/sepet"
            onClick={onClose}
            className="w-full inline-flex items-center justify-center gap-2 h-12 px-5 rounded-full bg-pim-mercan hover:bg-pim-mercan-koyu text-white font-semibold text-[14.5px] transition-colors shadow-mercan"
          >
            {t.cart.goToCart}
          </Link>
          <button
            ref={stayHereBtnRef}
            type="button"
            onClick={onClose}
            className="w-full inline-flex items-center justify-center h-12 px-5 rounded-full bg-white ring-1 ring-gri-200 hover:ring-pim-mercan hover:text-pim-mercan text-lacivert font-semibold text-[14.5px] transition-colors"
          >
            {t.cart.stayHere}
          </button>
        </div>

        {/* Mikrokopisi */}
        <p className="mt-4 text-[11.5px] text-gri-500 text-center leading-relaxed">
          {t.cart.successNote}
        </p>
      </div>
    </div>,
    document.body
  );
}
