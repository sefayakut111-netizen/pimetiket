"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_ETIKET_DELIVERY_DAYS,
  DEFAULT_STICKER_DELIVERY_DAYS,
  formatDeliveryDaysLabel,
  type DeliveryDaysSettings,
  parseDeliveryDaysFromSettings,
} from "@/lib/site-settings-shared";

export function useDeliveryDays(): DeliveryDaysSettings {
  const [days, setDays] = useState<DeliveryDaysSettings>({
    sticker: DEFAULT_STICKER_DELIVERY_DAYS,
    etiket: DEFAULT_ETIKET_DELIVERY_DAYS,
  });

  useEffect(() => {
    void fetch("/api/public/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { settings?: Record<string, unknown> } | null) => {
        if (json?.settings) {
          setDays(parseDeliveryDaysFromSettings(json.settings));
        }
      })
      .catch(() => {
        /* defaults */
      });
  }, []);

  return days;
}

export function deliveryDaysForProduct(
  product: "etiket" | "sticker",
  days: DeliveryDaysSettings
): number {
  return product === "etiket" ? days.etiket : days.sticker;
}

export function formatProductDeliveryLabel(
  product: "etiket" | "sticker",
  days: DeliveryDaysSettings,
  locale: "tr" | "en" = "tr"
): string {
  const n = deliveryDaysForProduct(product, days);
  return formatDeliveryDaysLabel(n, locale);
}

export function deliveryDaysForOrderItems(
  items: Array<{ product?: string | null }>,
  days: DeliveryDaysSettings
): number {
  return items.some((i) => i.product === "etiket") ? days.etiket : days.sticker;
}

export function formatProductionDeliveryDesc(
  days: number,
  locale: "tr" | "en",
  variant: "production" | "default" = "default"
): string {
  const label = formatDeliveryDaysLabel(days, locale);
  if (locale === "en") {
    if (variant === "production") {
      return `In production. Ships within ${label}.`;
    }
    return `After proof approval → production → ships within ${label} → delivered to your door.`;
  }
  if (variant === "production") {
    return `Üretim atölyemizde baskıda. ${label} içinde kargoya verilir.`;
  }
  return `Prova onayı sonrası baskı → ${label} kargo → kapına teslim.`;
}
