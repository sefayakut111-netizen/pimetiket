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
  /** Client locale localStorage'dan okunduktan sonra true — konfigüratör hydration guard. */
  hydrated: boolean;
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
      hydrated,
    }),
    [locale, setLocale, hydrated]
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
          hydrated: false,
        }}
      >
        {children}
      </I18nContext.Provider>
    );
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Translation hook — t.nav.home gibi tip-güvenli erişim.
 *
 * Sefa 23 May v68: throw yerine default fallback (TR). LanguageProvider
 * dışında çağrılırsa (örn. SSR error boundary, RSC parent, isolated
 * test) sayfa crash etmesin — default TR translation ile çalışsın.
 * Console'a warn at, dev modda fark edilir. Production'da silent
 * recovery (Sentry "useT must be used within a LanguageProvider"
 * hatası birden fazla page'i crash ediyordu).
 */
export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[useT] LanguageProvider eksik — TR default'a fallback. " +
          "Bu durum hydration sirasında veya error boundary'de olabilir."
      );
    }
    return {
      locale: DEFAULT_LOCALE,
      t: TRANSLATIONS[DEFAULT_LOCALE],
      setLocale: () => {
        /* no-op */
      },
      hydrated: false,
    };
  }
  return ctx;
}
