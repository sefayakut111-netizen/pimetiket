/**
 * "Çerez tercihlerimi yönet" butonu — /cerez sayfasında ve footer'da
 * kullanılır. CookieConsent component'ini forceOpen modunda açar.
 *
 * Mekanik: window'a custom event dispatch et, layout.tsx'teki
 * CookieConsent dinler ve açılır. (Bu component-bağımsız bir wrapper
 * yaklaşımı — props drilling önlemi)
 */

"use client";

import { useState } from "react";
import { CookieConsent } from "./CookieConsent";

interface ManageCookiesButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function ManageCookiesButton({
  className,
  children,
}: ManageCookiesButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1.5 text-pim-mercan font-semibold hover:underline"
        }
      >
        {children ?? "Çerez tercihlerimi yönet"}
      </button>
      {open && <CookieConsent forceOpen onClose={() => setOpen(false)} />}
    </>
  );
}
