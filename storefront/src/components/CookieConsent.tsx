/**
 * CookieConsent — KVKK uyumlu çerez izin bannerı.
 *
 * Site root'ta render edilir (layout.tsx). İlk ziyarette altta sticky
 * banner çıkar, kullanıcı kabul/red verene kadar görünür kalır.
 *
 * Müşteri tercihleri kaydedildikten sonra 12 ay görünmez. /cerez
 * sayfasından "Tercihlerimi yönet" ile tekrar açılır.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  readConsent,
  acceptAll,
  rejectNonEssential,
  writeConsent,
  type ConsentCategory,
} from "@/lib/cookie-consent";

interface CookieConsentProps {
  /** Force open — /cerez "Tercihlerimi yönet" butonu için */
  forceOpen?: boolean;
  onClose?: () => void;
}

const COPY = {
  tr: {
    title: "Çerez tercihlerin",
    intro:
      "Pim Etiket çerezleri 4 kategoride kullanır. Zorunlu olanlar her zaman aktif (oturum, sepet). Diğerleri için seçim sende.",
    necessary: "Zorunlu",
    necessaryDesc:
      "Oturum, sepet, güvenlik. Bu çerezler olmadan site çalışmaz.",
    functional: "Tercih",
    functionalDesc: "Dil, tema, görünüm seçimlerini hatırlamak için.",
    analytics: "Analitik",
    analyticsDesc:
      "Hangi sayfalara bakılıyor, nereden geliniyor — Google Analytics anonim sayar.",
    marketing: "Pazarlama",
    marketingDesc:
      "Reklam etkinliği ölçümü ve hedefli reklam (henüz aktif değil).",
    accept: "Hepsini kabul et",
    reject: "Sadece zorunlu",
    save: "Seçimimi kaydet",
    settings: "Ayrı ayrı seç",
    privacy: "Gizlilik politikası",
    privacyHref: "/gizlilik",
    cookieInfo: "Çerez politikası",
    cookieInfoHref: "/cerez",
  },
  en: {
    title: "Cookie preferences",
    intro:
      "Pim Etiket uses cookies in 4 categories. Necessary ones are always active (session, cart). The rest is your choice.",
    necessary: "Necessary",
    necessaryDesc: "Session, cart, security. The site doesn't work without these.",
    functional: "Preference",
    functionalDesc: "To remember your language, theme, view choices.",
    analytics: "Analytics",
    analyticsDesc:
      "Which pages are viewed, where visitors come from — Google Analytics counts anonymously.",
    marketing: "Marketing",
    marketingDesc: "Ad effectiveness and targeted ads (not active yet).",
    accept: "Accept all",
    reject: "Necessary only",
    save: "Save my selection",
    settings: "Customize",
    privacy: "Privacy policy",
    privacyHref: "/gizlilik",
    cookieInfo: "Cookie policy",
    cookieInfoHref: "/cerez",
  },
};

export function CookieConsent({ forceOpen, onClose }: CookieConsentProps) {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState<Record<ConsentCategory, boolean>>({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  });
  const [locale, setLocale] = useState<"tr" | "en">("tr");
  const c = COPY[locale];

  useEffect(() => {
    // Locale tespiti — pim_locale localStorage anahtarı (i18n context kullanıyor)
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pim_locale");
        if (stored === "en") setLocale("en");
      } catch {
        // ignore
      }
    }

    if (forceOpen) {
      setOpen(true);
      const existing = readConsent();
      if (existing) {
        setPrefs(existing.categories);
        setShowSettings(true); // direct settings view
      }
      return;
    }

    // İlk ziyaret + henüz consent yok → banner göster (kısa gecikme ile)
    const t = setTimeout(() => {
      const consent = readConsent();
      if (!consent) setOpen(true);
    }, 800);
    return () => clearTimeout(t);
  }, [forceOpen]);

  const handleAcceptAll = () => {
    acceptAll();
    closePanel();
  };

  const handleRejectAll = () => {
    rejectNonEssential();
    closePanel();
  };

  const handleSave = () => {
    writeConsent(prefs);
    closePanel();
  };

  const closePanel = () => {
    setOpen(false);
    if (onClose) onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] pointer-events-none">
      <div className="max-w-[760px] mx-auto px-4 pb-4">
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-consent-title"
          className="pointer-events-auto bg-white rounded-2xl shadow-2 ring-1 ring-black/[0.06] overflow-hidden animate-fade-up"
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-gri-100">
            <h3
              id="cookie-consent-title"
              className="text-base font-semibold text-lacivert"
            >
              🍪 {c.title}
            </h3>
            <p className="mt-1.5 text-[13px] text-gri-700 leading-relaxed">
              {c.intro}{" "}
              <Link
                href={c.cookieInfoHref}
                className="text-pim-mercan font-semibold hover:underline"
              >
                {c.cookieInfo}
              </Link>{" "}
              ·{" "}
              <Link
                href={c.privacyHref}
                className="text-pim-mercan font-semibold hover:underline"
              >
                {c.privacy}
              </Link>
            </p>
          </div>

          {/* Settings panel (collapsible) */}
          {showSettings && (
            <div className="px-5 py-4 space-y-3 max-h-[40vh] overflow-y-auto">
              <CategoryRow
                title={c.necessary}
                desc={c.necessaryDesc}
                checked={true}
                disabled
                onChange={() => {}}
                badge="Daima aktif"
              />
              <CategoryRow
                title={c.functional}
                desc={c.functionalDesc}
                checked={prefs.functional}
                onChange={(v) =>
                  setPrefs((p) => ({ ...p, functional: v }))
                }
              />
              <CategoryRow
                title={c.analytics}
                desc={c.analyticsDesc}
                checked={prefs.analytics}
                onChange={(v) =>
                  setPrefs((p) => ({ ...p, analytics: v }))
                }
              />
              <CategoryRow
                title={c.marketing}
                desc={c.marketingDesc}
                checked={prefs.marketing}
                onChange={(v) =>
                  setPrefs((p) => ({ ...p, marketing: v }))
                }
              />
            </div>
          )}

          {/* Actions */}
          <div className="px-5 py-4 bg-gri-50 flex flex-wrap gap-2 justify-end">
            {!showSettings ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="text-[13px] font-semibold text-gri-700 hover:text-pim-mercan px-3 py-2"
                >
                  {c.settings}
                </button>
                <button
                  type="button"
                  onClick={handleRejectAll}
                  className="h-10 px-4 rounded-full bg-white ring-1 ring-gri-200 text-[13.5px] font-semibold text-lacivert hover:ring-pim-mercan hover:text-pim-mercan transition-colors"
                >
                  {c.reject}
                </button>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="h-10 px-5 rounded-full bg-pim-mercan text-white text-[13.5px] font-semibold hover:bg-pim-mercan-koyu transition-colors"
                >
                  {c.accept}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="text-[13px] font-semibold text-gri-700 hover:text-pim-mercan px-3 py-2"
                >
                  ← {locale === "en" ? "Back" : "Geri"}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="h-10 px-5 rounded-full bg-pim-mercan text-white text-[13.5px] font-semibold hover:bg-pim-mercan-koyu transition-colors"
                >
                  {c.save}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CategoryRow — tek kategori satırı (toggle + açıklama)
// ============================================================

function CategoryRow({
  title,
  desc,
  checked,
  disabled,
  badge,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  badge?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-0.5 ${
          checked ? "bg-pim-mercan" : "bg-gri-200"
        } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <span
          aria-hidden
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[14px] text-lacivert">
            {title}
          </span>
          {badge && (
            <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-gri-100 text-gri-700 text-[10.5px] font-semibold">
              {badge}
            </span>
          )}
        </div>
        <p className="text-[12.5px] text-gri-700 mt-0.5 leading-relaxed">
          {desc}
        </p>
      </div>
    </div>
  );
}
