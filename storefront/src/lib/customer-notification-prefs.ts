/**
 * Müşteri bildirim tercihleri — notification_prefs tablosu (Migration 004).
 */

import { createClient } from "./supabase/client";
import type { Tables, TablesUpdate } from "./supabase/types";

export interface NotificationPrefsUi {
  email: {
    orderUpdates: boolean;
    proofReady: boolean;
    shippingUpdates: boolean;
    marketing: boolean;
    blog: boolean;
  };
  sms: {
    delivery: boolean;
  };
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefsUi = {
  email: {
    orderUpdates: true,
    proofReady: true,
    shippingUpdates: true,
    marketing: false,
    blog: false,
  },
  sms: {
    delivery: false,
  },
};

type DbRow = Tables<"notification_prefs">;

function rowToUi(row: DbRow): NotificationPrefsUi {
  return {
    email: {
      orderUpdates: row.email_order_updates,
      proofReady: row.email_proof_ready,
      shippingUpdates: row.email_shipping_updates,
      marketing: row.email_marketing,
      blog: row.email_blog,
    },
    sms: {
      delivery: row.sms_delivery,
    },
  };
}

function uiPatchToDb(
  patch: NotificationPrefsPatch
): TablesUpdate<"notification_prefs"> {
  const update: TablesUpdate<"notification_prefs"> = {};
  const now = new Date().toISOString();

  if (patch.email) {
    const e = patch.email;
    if (e.orderUpdates !== undefined) update.email_order_updates = e.orderUpdates;
    if (e.proofReady !== undefined) update.email_proof_ready = e.proofReady;
    if (e.shippingUpdates !== undefined) {
      update.email_shipping_updates = e.shippingUpdates;
    }
    if (e.marketing !== undefined) {
      update.email_marketing = e.marketing;
      update.marketing_consent_at = e.marketing ? now : null;
    }
    if (e.blog !== undefined) {
      update.email_blog = e.blog;
      update.blog_consent_at = e.blog ? now : null;
    }
  }

  if (patch.sms?.delivery !== undefined) {
    update.sms_delivery = patch.sms.delivery;
  }

  return update;
}

export async function fetchNotificationPrefs(): Promise<
  NotificationPrefsUi | null
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("notification_prefs")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[notification-prefs] fetch error:", error);
    return null;
  }

  if (!data) {
    const { data: inserted, error: insertErr } = await supabase
      .from("notification_prefs")
      .insert({ user_id: user.id })
      .select("*")
      .single();
    if (insertErr || !inserted) {
      console.error("[notification-prefs] insert error:", insertErr);
      return DEFAULT_NOTIFICATION_PREFS;
    }
    return rowToUi(inserted);
  }

  return rowToUi(data);
}

export type NotificationPrefsPatch = {
  email?: Partial<NotificationPrefsUi["email"]>;
  sms?: Partial<NotificationPrefsUi["sms"]>;
};

export async function updateNotificationPrefs(
  patch: NotificationPrefsPatch
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "unauthorized" };

  const dbPatch = uiPatchToDb(patch);
  if (Object.keys(dbPatch).length === 0) {
    return { ok: true };
  }

  const { error } = await supabase
    .from("notification_prefs")
    .update(dbPatch)
    .eq("user_id", user.id);

  if (error) {
    console.error("[notification-prefs] update error:", error);
    return { ok: false, reason: error.message };
  }

  return { ok: true };
}
