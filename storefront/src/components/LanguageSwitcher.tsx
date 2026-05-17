"use client";

/**
 * LanguageSwitcher — TopBar'da dil seçici dropdown.
 * Compact: bayrak + dil kodu, hover'da menü açılır.
 */

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/types";
import { cn } from "@/lib/cn";

export function LanguageSwitcher() {
  const { locale, setLocale } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Dil: ${LOCALE_LABELS[locale]}`}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-semibold text-gri-700 hover:bg-gri-100 hover:text-lacivert transition-colors"
      >
        {/* Sefa 17 May v29: Emoji bayraklar Windows'ta TR/GB harfleriyle
            render olup "TR TR" / "GB ENG" duplicate görüntüsü veriyordu.
            Tek text kod gösterimi: TR / EN. */}
        <span className="uppercase tracking-wide">{locale}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden
          className={cn(
            "transition-transform text-gri-500",
            open && "rotate-180"
          )}
        >
          <path
            d="M2 4l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-2 w-44 bg-white rounded-xl shadow-2 ring-1 ring-gri-200 overflow-hidden z-50 py-1"
        >
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="menuitem"
              onClick={() => {
                setLocale(l as Locale);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors",
                locale === l
                  ? "bg-pim-mercan-tint text-pim-mercan-koyu font-semibold"
                  : "text-lacivert hover:bg-gri-50"
              )}
            >
              {/* Mini text badge — TR / EN */}
              <span
                aria-hidden
                className={cn(
                  "inline-flex items-center justify-center min-w-[28px] h-[20px] px-1.5 rounded text-[10.5px] font-bold uppercase tracking-wide",
                  locale === l
                    ? "bg-pim-mercan text-white"
                    : "bg-gri-100 text-gri-700"
                )}
              >
                {l}
              </span>
              <span className="flex-1">{LOCALE_LABELS[l]}</span>
              {locale === l && (
                <span aria-hidden className="text-pim-mercan">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
