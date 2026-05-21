/**
 * PaymentBadges — footer'da güvenlik rozetleri + copyright.
 *
 * Sefa 17 May v17: "Kabul ettiğimiz kartlar" başlığı + Visa/MC/Troy/
 * Amex ikonları kaldırıldı. Sol tarafa © Pim Etiket yazısı kondu.
 * Security rozetleri (3D Secure / SSL / PayTR / KVKK) sağda kalır.
 */

import Image from "next/image";

interface PaymentBadgesProps {
  /** "© 2026 Pim Etiket — Tüm hakları saklıdır." şeklinde tam string */
  copyrightText: string;
}

export function PaymentBadges({ copyrightText }: PaymentBadgesProps) {
  return (
    <div className="border-t border-white/10 pt-6 mt-6 flex flex-wrap gap-x-6 gap-y-4 items-center justify-between">
      {/* Copyright (sol) */}
      <div className="text-[12px] text-white/65">{copyrightText}</div>

      {/* Security badges */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 3D Secure */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-white/10 ring-1 ring-white/15"
          aria-label="3D Secure ile güvenli ödeme"
          title="3D Secure ile güvenli ödeme"
        >
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-pim-mercan"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span className="text-[11.5px] font-semibold text-white/85 tracking-tight">
            3D Secure
          </span>
        </div>

        {/* SSL */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-white/10 ring-1 ring-white/15"
          aria-label="SSL ile şifrelenmiş bağlantı"
          title="SSL ile şifrelenmiş bağlantı"
        >
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-pim-mercan"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-[11.5px] font-semibold text-white/85 tracking-tight">
            SSL Güvenli
          </span>
        </div>

        {/* PayTR — Sefa 16 May: resmi logo eklendi */}
        <div
          className="inline-flex items-center gap-2 px-2.5 h-7 rounded-md bg-white/10 ring-1 ring-white/15"
          aria-label="Ödemeler PayTR güvencesi ile"
          title="Ödemeler PayTR güvencesi ile"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-white/55">
            Ödeme altyapısı
          </span>
          {/* Sefa 21 May v68 (Image migration #2): <img> → Next/Image —
              CLS=0 (Next.js width/height attribute'ı reserve eder),
              AVIF/WebP otomatik dönüşüm. */}
          <Image
            src="/logos/paytr/paytr-white.svg"
            alt="PayTR"
            width={56}
            height={14}
            className="opacity-95"
            unoptimized
          />
        </div>

        {/* KVKK */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-white/10 ring-1 ring-white/15"
          aria-label="6698 sayılı Kişisel Verilerin Korunması Kanunu uyumlu"
          title="6698 sayılı Kişisel Verilerin Korunması Kanunu uyumlu"
        >
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-pim-mercan"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="text-[11.5px] font-semibold text-white/85 tracking-tight">
            KVKK Uyumlu
          </span>
        </div>
      </div>
    </div>
  );
}
