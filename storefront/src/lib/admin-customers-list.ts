/**
 * Admin CRM müşteri listesi — v_admin_customers PostgREST üzerinden
 * auth.users referansı yüzünden patlayabilir; service role + Auth Admin API ile
 * aynı satır şeklini üretir.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminCustomerRow } from "@/lib/admin-customer-types";

type OrderAgg = {
  order_count: number;
  active_count: number;
  total_revenue: number;
  avg_order: number;
  last_order_at: string | null;
  last_order_id: string | null;
  first_order_at: string | null;
};

function emptyAgg(): OrderAgg {
  return {
    order_count: 0,
    active_count: 0,
    total_revenue: 0,
    avg_order: 0,
    last_order_at: null,
    last_order_id: null,
    first_order_at: null,
  };
}

export async function fetchAdminCustomerRows(
  admin: SupabaseClient
): Promise<AdminCustomerRow[]> {
  const [
    profilesRes,
    ordersRes,
    tagsRes,
    notesRes,
    loyaltyRes,
    subscribersRes,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, display_name, phone, invoice_type")
      .eq("role", "customer"),
    admin
      .from("orders")
      .select("id, user_id, total, status, created_at")
      .not("user_id", "is", null),
    admin.from("customer_tags").select("user_id, tag, created_at"),
    admin.from("customer_notes").select("user_id"),
    admin
      .from("loyalty_grants")
      .select("user_id, amount_try, status")
      .eq("status", "granted"),
    admin.from("email_subscribers").select("email"),
  ]);

  if (profilesRes.error) {
    throw new Error(profilesRes.error.message);
  }
  if (ordersRes.error) {
    throw new Error(ordersRes.error.message);
  }

  const profileMap = new Map<
    string,
    {
      display_name: string | null;
      phone: string | null;
      invoice_type: "individual" | "corporate" | null;
    }
  >();
  for (const p of profilesRes.data ?? []) {
    profileMap.set(p.id, {
      display_name: p.display_name,
      phone: p.phone,
      invoice_type: p.invoice_type as "individual" | "corporate" | null,
    });
  }

  const orderAgg = new Map<string, OrderAgg & { last_order_created: string }>();
  for (const o of ordersRes.data ?? []) {
    const uid = o.user_id as string;
    if (!uid) continue;
    const cur = orderAgg.get(uid) ?? {
      ...emptyAgg(),
      last_order_created: "",
    };
    cur.order_count += 1;
    if (!["delivered", "cancelled"].includes(o.status as string)) {
      cur.active_count += 1;
    }
    cur.total_revenue += Number(o.total) || 0;
    const created = o.created_at as string;
    if (!cur.first_order_at || created < cur.first_order_at) {
      cur.first_order_at = created;
    }
    if (!cur.last_order_at || created > cur.last_order_at) {
      cur.last_order_at = created;
      cur.last_order_id = o.id as string;
      cur.last_order_created = created;
    }
    orderAgg.set(uid, cur);
  }
  for (const agg of orderAgg.values()) {
    agg.avg_order =
      agg.order_count > 0 ? agg.total_revenue / agg.order_count : 0;
  }

  const tagsByUser = new Map<string, string[]>();
  for (const t of tagsRes.data ?? []) {
    const uid = t.user_id as string;
    const list = tagsByUser.get(uid) ?? [];
    list.push(t.tag as string);
    tagsByUser.set(uid, list);
  }

  const notesCount = new Map<string, number>();
  for (const n of notesRes.data ?? []) {
    const uid = n.user_id as string;
    notesCount.set(uid, (notesCount.get(uid) ?? 0) + 1);
  }

  const loyaltySum = new Map<string, number>();
  for (const g of loyaltyRes.data ?? []) {
    const uid = g.user_id as string;
    loyaltySum.set(
      uid,
      (loyaltySum.get(uid) ?? 0) + (Number(g.amount_try) || 0)
    );
  }

  const subscribedEmails = new Set(
    (subscribersRes.data ?? [])
      .map((s) => (s.email as string)?.toLowerCase())
      .filter(Boolean)
  );

  const authUsers: Array<{
    id: string;
    email: string;
    email_confirmed_at: string | null;
    last_sign_in_at: string | null;
    created_at: string;
    banned_until: string | null;
  }> = [];

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) {
      throw new Error(error.message);
    }
    for (const u of data.users) {
      authUsers.push({
        id: u.id,
        email: u.email ?? "",
        email_confirmed_at: u.email_confirmed_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at,
        banned_until: (u as { banned_until?: string | null }).banned_until ?? null,
      });
    }
    if (data.users.length < 1000) break;
  }

  const seen = new Set<string>();
  const rows: AdminCustomerRow[] = [];

  for (const u of authUsers) {
    const profile = profileMap.get(u.id);
    if (!profile) continue;
    seen.add(u.id);
    const agg = orderAgg.get(u.id) ?? emptyAgg();
    rows.push({
      user_id: u.id,
      email: u.email,
      email_confirmed_at: u.email_confirmed_at,
      last_sign_in_at: u.last_sign_in_at,
      registered_at: u.created_at,
      banned_until: u.banned_until,
      display_name: profile?.display_name ?? null,
      phone: profile?.phone ?? null,
      invoice_type: profile?.invoice_type ?? null,
      order_count: agg.order_count,
      active_orders: agg.active_count,
      total_revenue: agg.total_revenue,
      avg_order: agg.avg_order,
      last_order_at: agg.last_order_at,
      last_order_id: agg.last_order_id,
      first_order_at: agg.first_order_at,
      total_loyalty_granted: loyaltySum.get(u.id) ?? 0,
      has_2fa: false,
      tags: tagsByUser.get(u.id) ?? [],
      notes_count: notesCount.get(u.id) ?? 0,
      marketing_subscribed: subscribedEmails.has(u.email.toLowerCase()),
    });
  }

  // Profilde olup auth listesinde gelmeyen (nadir)
  for (const [id, profile] of profileMap) {
    if (seen.has(id)) continue;
    const agg = orderAgg.get(id) ?? emptyAgg();
    rows.push({
      user_id: id,
      email: "",
      email_confirmed_at: null,
      last_sign_in_at: null,
      registered_at: agg.first_order_at ?? new Date().toISOString(),
      banned_until: null,
      display_name: profile.display_name,
      phone: profile.phone,
      invoice_type: profile.invoice_type,
      order_count: agg.order_count,
      active_orders: agg.active_count,
      total_revenue: agg.total_revenue,
      avg_order: agg.avg_order,
      last_order_at: agg.last_order_at,
      last_order_id: agg.last_order_id,
      first_order_at: agg.first_order_at,
      total_loyalty_granted: loyaltySum.get(id) ?? 0,
      has_2fa: false,
      tags: tagsByUser.get(id) ?? [],
      notes_count: notesCount.get(id) ?? 0,
      marketing_subscribed: false,
    });
  }

  return rows;
}
