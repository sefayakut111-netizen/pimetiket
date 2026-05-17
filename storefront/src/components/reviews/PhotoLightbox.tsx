/**
 * PhotoLightbox — yorum fotoğrafları için minimal modal/lightbox.
 *
 * Sefa kararı 17 May v37: "yorum resmine tıklayınca yeni link açmasın,
 * sayfa içinde aç, kullanıcı çıkınca baksın, abartı olmasın".
 *
 * Davranış:
 * - Tam ekran overlay (siyah/0.85)
 * - Görsel ortalanmış, max 80vw / 80vh ("abartı olmasın")
 * - X butonu sağ üstte
 * - Overlay tıklama → kapat
 * - ESC tuşu → kapat
 * - Body scroll lock (modal açıkken sayfa kaymasın)
 */

"use client";

import { useEffect } from "react";

interface PhotoLightboxProps {
  src: string | null;
  onClose: () => void;
}

export function PhotoLightbox({ src, onClose }: PhotoLightboxProps) {
  // ESC tuşu → kapat
  useEffect(() => {
    if (!src) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    // Body scroll lock
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = prevOverflow;
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Yorum fotoğrafı"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-lacivert-koyu/85 backdrop-blur-sm animate-fade-up p-4 cursor-zoom-out"
    >
      {/* X close butonu */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Kapat"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white text-xl font-light flex items-center justify-center transition-colors backdrop-blur-sm ring-1 ring-white/20"
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
    </div>
  );
}
