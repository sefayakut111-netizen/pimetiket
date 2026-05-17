/**
 * PhotoLightbox — yorum fotoğrafları için minimal modal/lightbox.
 *
 * Sefa kararı 17 May v37: "yorum resmine tıklayınca yeni link açmasın,
 * sayfa içinde aç, kullanıcı çıkınca baksın, abartı olmasın".
 * v38 fix: createPortal ile body'ye taşındı (parent stacking context
 * sorunu giderildi) + scroll position lock güçlendirildi (mobile dahil
 * sayfa kayma sorunu çözüldü).
 *
 * Davranış:
 * - Tam ekran overlay (lacivert-koyu/85 + backdrop-blur)
 * - Görsel ortalanmış, max 80vw / 80vh ("abartı olmasın")
 * - X butonu sağ üstte
 * - Overlay tıklama → kapat
 * - ESC tuşu → kapat
 * - Scroll lock — modal açıkken sayfa kayamaz (scroll position korunur)
 */

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface PhotoLightboxProps {
  src: string | null;
  onClose: () => void;
}

export function PhotoLightbox({ src, onClose }: PhotoLightboxProps) {
  // SSR guard — createPortal sadece client'ta
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // ESC tuşu + scroll lock
  useEffect(() => {
    if (!src) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);

    // Güçlü scroll lock — pozisyonu koru, body'yi sabitle
    const scrollY = window.scrollY;
    const originalBodyStyle = {
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
      document.removeEventListener("keydown", handleEsc);
      // Pozisyonu geri yükle
      document.body.style.position = originalBodyStyle.position;
      document.body.style.top = originalBodyStyle.top;
      document.body.style.width = originalBodyStyle.width;
      document.body.style.overflow = originalBodyStyle.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [src, onClose]);

  if (!src || !mounted) return null;

  // Portal ile body'ye render → parent stacking context'ten bağımsız
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Yorum fotoğrafı"
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-lacivert-koyu/85 backdrop-blur-sm p-4 cursor-zoom-out animate-fade-up"
    >
      {/* X close butonu */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Kapat"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white text-2xl font-light flex items-center justify-center transition-colors backdrop-blur-sm ring-1 ring-white/20"
      >
        ×
      </button>
      {/* Görsel — abartısız, max 80vw/80vh */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-w-[80vw] max-h-[80vh] w-auto h-auto object-contain rounded-lg shadow-2xl cursor-default"
      />
    </div>,
    document.body
  );
}
