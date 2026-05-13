/**
 * Feature flag wrapper — PostHog tabanlı A/B test + progressive rollout.
 *
 * Kullanım:
 *   const variant = useFeatureFlag("sticker_cta_v2");
 *   if (variant === "test") {
 *     return <NewCTA />;
 *   }
 *   return <DefaultCTA />;
 *
 *   const enabled = useFeatureFlag("show_lead_banner");
 *   if (enabled) <LeadBanner />;
 *
 * Server tarafı için: getFeatureFlagServer() — Edge runtime'da çalışmaz,
 * sadece anonymous client-side flag'ler (kullanıcı id'li experiment'ler
 * gerekirse Supabase user.id PostHog identify ile birleştirilmeli).
 *
 * Fallback: PostHog yüklenmediyse veya consent yoksa → null (caller
 * default davranışa düşer).
 *
 * Multi-variant: PostHog Console'da "Variants" alanını "control/test"
 * şeklinde tanımla → kod aynı kalır.
 */

"use client";

import { useEffect, useState } from "react";
// window.posthog tipi posthog-events.ts'de tek noktada declare edilmiş —
// feature flag method'larına oradan erişiyoruz.
import "./posthog-events";

/**
 * Client-side feature flag hook.
 *
 * @returns
 *   - boolean   → multivariate yoksa enabled/disabled
 *   - string    → multivariate varsa variant adı ("control" | "test" | ...)
 *   - null      → PostHog yüklenmedi (caller default davranışa düşmeli)
 */
export function useFeatureFlag(
  flagKey: string
): boolean | string | null {
  const [value, setValue] = useState<boolean | string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 20; // 250ms × 20 = 5 sn max polling

    const read = (ph: NonNullable<typeof window.posthog>) => {
      try {
        const raw =
          ph.getFeatureFlag?.(flagKey) ?? ph.isFeatureEnabled?.(flagKey);
        if (raw === undefined || raw === null) return false;
        if (!cancelled) setValue(raw);
        return true;
      } catch {
        return false;
      }
    };

    // PostHog snippet asenkron yüklenir (Analytics.tsx Script
    // afterInteractive). Hook mount olduğunda window.posthog ya yok ya da
    // stub (array.js henüz fetch edilmemiş). 250ms aralıklarla poll ediyoruz;
    // flag yüklenince hem setValue çalışır hem onFeatureFlags subscribe
    // edilir (sonraki değişiklikleri yakalamak için).
    //
    // Sefa raporu 12 May: ilk implementasyon onFeatureFlags callback'i
    // kullandığında stub mode'da timing miss oluyor → UI control'de kalıyordu.
    const tryRead = () => {
      if (cancelled) return;
      const ph = window.posthog;
      if (ph?.getFeatureFlag) {
        if (read(ph)) {
          // Başarılı → sonraki değişiklikler için subscribe et
          try {
            ph.onFeatureFlags?.(() => {
              if (!cancelled) read(ph);
            });
          } catch {
            /* eski sürüm fallback */
          }
          return;
        }
      }
      attempts += 1;
      if (attempts < MAX_ATTEMPTS) {
        setTimeout(tryRead, 250);
      }
      // attempts >= MAX → null kalır, caller fallback'e düşer
    };

    tryRead();
    return () => {
      cancelled = true;
    };
  }, [flagKey]);

  return value;
}

/**
 * Multivariate experiment helper.
 *
 * @param flagKey PostHog'da tanımlı multivariate flag adı
 * @param variants Variant'lar (`control` her zaman default — flag null'sa)
 * @returns Object: { variant: "control" | "test1" | ..., loaded: bool }
 *
 * @example
 *   const { variant, loaded } = useExperiment("sticker_cta_v2", ["control", "test"]);
 *   if (!loaded) return null;  // SSR'de control görünmesin diye
 *   return variant === "test" ? <NewCTA /> : <DefaultCTA />;
 */
export function useExperiment<V extends string>(
  flagKey: string,
  variants: V[]
): { variant: V; loaded: boolean } {
  const raw = useFeatureFlag(flagKey);
  const loaded = raw !== null;
  const fallback = variants[0];
  const variant =
    typeof raw === "string" && (variants as string[]).includes(raw)
      ? (raw as V)
      : fallback;
  return { variant, loaded };
}
