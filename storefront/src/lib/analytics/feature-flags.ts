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
    const ph = window.posthog;
    if (!ph) {
      setValue(null);
      return;
    }

    const read = () => {
      try {
        const raw =
          ph.getFeatureFlag?.(flagKey) ?? ph.isFeatureEnabled?.(flagKey);
        if (raw === undefined || raw === null) {
          setValue(null);
          return;
        }
        setValue(raw);
      } catch {
        setValue(null);
      }
    };

    // İlk okuma (cache'den)
    read();

    // PostHog flag'leri arka planda fetch'liyor — re-read için listener
    try {
      ph.onFeatureFlags?.(read);
    } catch {
      /* eski sürüm fallback */
    }
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
