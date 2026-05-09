"use client";

/**
 * LanguageSwitcher — TopBar'da dil seçici dropdown.
 * Compact: bayrak + dil kodu, hover'da menü açılır.
 */

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { LOCALES, LOCALE_LABELS, LOCALE_FLAGS, type Locale } from "@/lib/i18n/types";
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
        className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-full text-[13px] font-semibold text-gri-700 hover:bg-gri-100 hover:text-lacivert transition-colors"
      >
        <span aria-hidden className="text-base leading-none">
          {LOCALE_FLAGS[locale]}
        </span>
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
              <span aria-hidden className="text-base leading-none">
                {LOCALE_FLAGS[l]}
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
