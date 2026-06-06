/**
 * site_settings — sunucu tarafı okuma (teslim, iletişim).
 */

import { createClient } from "@supabase/supabase-js";
import { addDaysIso } from "@/lib/customer-order";
import {
  DEFAULT_CONTACT_PHONE,
  DEFAULT_CONTACT_WHATSAPP,
  DEFAULT_ETIKET_DELIVERY_DAYS,
  DEFAULT_STICKER_DELIVERY_DAYS,
  formatDeliveryDaysLabel,
  phoneToTelHref,
  phoneToWaHref,
} from "@/lib/site-settings-shared";

export {
  DEFAULT_STICKER_DELIVERY_DAYS,
  DEFAULT_ETIKET_DELIVERY_DAYS,
  DEFAULT_CONTACT_PHONE,
  DEFAULT_CONTACT_WHATSAPP,
  formatDeliveryDaysLabel,
  phoneToTelHref,
  phoneToWaHref,
};

export interface SiteDeliveryDays {
  sticker: number;
  etiket: number;
}

export interface SiteContactSettings {
  phone: string;
  whatsapp: string;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getSiteDeliveryDays(): Promise<SiteDeliveryDays> {
  const admin = serviceClient();
  if (!admin) {
    return {
      sticker: DEFAULT_STICKER_DELIVERY_DAYS,
      etiket: DEFAULT_ETIKET_DELIVERY_DAYS,
    };
  }

  const { data } = await admin
    .from("site_settings")
    .select("sticker_delivery_days, etiket_delivery_days")
    .eq("id", 1)
    .maybeSingle();

  const row = data as {
    sticker_delivery_days?: number | null;
    etiket_delivery_days?: number | null;
  } | null;

  return {
    sticker: Math.max(
      1,
      Number(row?.sticker_delivery_days) || DEFAULT_STICKER_DELIVERY_DAYS
    ),
    etiket: Math.max(
      1,
      Number(row?.etiket_delivery_days) || DEFAULT_ETIKET_DELIVERY_DAYS
    ),
  };
}

export async function getSiteContactSettings(): Promise<SiteContactSettings> {
  const admin = serviceClient();
  if (!admin) {
    return { phone: DEFAULT_CONTACT_PHONE, whatsapp: DEFAULT_CONTACT_WHATSAPP };
  }

  const { data } = await admin
    .from("site_settings")
    .select("seo_contact_phone, contact_whatsapp")
    .eq("id", 1)
    .maybeSingle();

  const row = data as {
    seo_contact_phone?: string | null;
    contact_whatsapp?: string | null;
  } | null;

  return {
    phone:
      row?.seo_contact_phone?.trim() ||
      process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() ||
      DEFAULT_CONTACT_PHONE,
    whatsapp:
      row?.contact_whatsapp?.trim() ||
      process.env.NEXT_PUBLIC_CONTACT_WHATSAPP?.trim() ||
      DEFAULT_CONTACT_WHATSAPP,
  };
}

/** Karışık sepette etiket varsa etiket günü, yoksa sticker günü. */
export function deliveryDaysForProducts(
  items: Array<{ product?: string | null }>,
  days: SiteDeliveryDays
): number {
  return items.some((i) => i.product === "etiket") ? days.etiket : days.sticker;
}

export async function estimatedDeliveryIsoForItems(
  items: Array<{ product?: string | null }>
): Promise<string> {
  const days = await getSiteDeliveryDays();
  return addDaysIso(deliveryDaysForProducts(items, days));
}
