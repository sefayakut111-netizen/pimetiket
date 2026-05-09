"use client";

/**
 * I18n Context — Pim Etiket için dil yönetimi.
 *
 * Kullanım:
 *   <LanguageProvider>{children}</LanguageProvider>  (root layout)
 *   const { t, locale, setLocale } = useT();
 *
 * Locale localStorage'da saklanır (`pim_locale`).
 * İlk girişte browser dilinden infer eder (TR-default).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  type TranslationDict,
} from "./types";
import { tr } from "./translations/tr";
import { en } from "./translations/en";

const STORAGE_KEY = "pim_locale";

const TRANSLATIONS: Record<Locale, TranslationDict> = { tr, en };

interface I18nContextValue {
  locale: Locale;
  t: TranslationDict;
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  // 1) localStorage
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (LOCALES as readonly string[]).includes(stored)) {
      return stored as Locale;
    }
  } catch {
    // ignore
  }
  // 2) Browser language
  const browserLang = navigator.language?.toLowerCase() ?? "";
  if (browserLang.startsWith("tr")) return "tr";
  if (browserLang.startsWith("en")) return "en";
  return DEFAULT_LOCALE;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // SSR safety: server'da default ile başla, client'ta detect et.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = detectInitialLocale();
    setLocaleState(initial);
    setHydrated(true);
    // <html lang> attribute güncelle
    document.documentElement.lang = initial;
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
    document.documentElement.lang = l;
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: TRANSLATIONS[locale],
      setLocale,
    }),
    [locale, setLocale]
  );

  // Hydration mismatch'i önlemek için: server her zaman default render eder,
  // client useEffect sonrası gerçek locale'e geçer (smooth flicker).
  if (!hydrated) {
    return (
      <I18nContext.Provider
        value={{
          locale: DEFAULT_LOCALE,
          t: TRANSLATIONS[DEFAULT_LOCALE],
          setLocale,
        }}
      >
        {children}
      </I18nContext.Provider>
    );
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Translation hook — t.nav.home gibi tip-güvenli erişim. */
export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useT must be used within a LanguageProvider");
  }
  return ctx;
}
