/**
 * GET /api/admin/customers
 *
 * Admin CRM liste endpoint — Migration 046 v_admin_customers view'inden okur.
 *
 * Query params:
 *   ?segment=vip|repeat|new|risk|lost|no_order|all (default all)
 *   ?search=<text>  (email/name/phone match)
 *   ?tag=<tag>      (specific tag filter)
 *   ?limit=50       (max 200)
 *   ?offset=0
 *   ?sort=ltv|recent|name (default ltv)
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/supabase/assert-admin";

const DAY = 24 * 60 * 60 * 1000;

export interface AdminCustomerRow {
  user_id: string;
  email: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  registered_at: string;
  banned_until: string | null;
  display_name: string | null;
  phone: string | null;
  invoice_type: "individual" | "corporate" | null;
  order_count: number;
  active_orders: number;
  total_revenue: number;
  avg_order: number;
  last_order_at: string | null;
  last_order_id: string | null;
  first_order_at: string | null;
  total_loyalty_granted: number;
  has_2fa: boolean;
  tags: string[];
  notes_count: number;
  marketing_subscribed: boolean;
}

export interface AdminCustomerWithSegment extends AdminCustomerRow {
  segment: "vip" | "repeat" | "new" | "risk" | "lost" | "no_order";
}

function deriveSegment(
  row: AdminCustomerRow
): AdminCustomerWithSegment["segment"] {
  if (row.order_count === 0) return "no_order";
  if (!row.last_order_at) return "no_order";
  const sinceDays = Math.floor(
    (Date.now() - new Date(row.last_order_at).getTime()) / DAY
  );
  if (sinceDays > 180) return "lost";
  if (sinceDays > 90) return "risk";
  if (row.order_count >= 4) return "vip";
  if (row.order_count >= 2) return "repeat";
  return "new";
}

export async function GET(req: Request) {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const segment = url.searchParams.get("segment") ?? "all";
  const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
  const tag = url.searchParams.get("tag")?.trim() ?? "";
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "100", 10),
    200
  );
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const sort = (url.searchParams.get("sort") ?? "ltv") as
    | "ltv"
    | "recent"
    | "name";

  const admin = createAdminClient();

  // View'dan tüm kayıtları çek — segment hesabı server-side (TR locale + 90/180 gün hesabı)
  // Limit + offset üst seviyede uygulanır (segment filter sonrası)
  const { data, error } = await admin
    .from("v_admin_customers")
    .select("*")
    .returns<AdminCustomerRow[]>();

  if (error) {
    // Sefa 18 May v68 (admin UX denetim — kullanıcı dostu hata):
    // v_admin_customers view eksikse veya RLS policy çakışırsa
    // generic "query_failed" gösteriliyordu. Şimdi:
    //   - Code/mesaj loglanır (Sentry'ye)
    //   - Friendly UI mesajı + admin için detail
    console.error("[admin/customers] view query failed:", error);
    const isViewMissing =
      error.code === "42P01" || // PostgreSQL: undefined_table/view
      error.message.toLowerCase().includes("does not exist");
    return NextResponse.json(
      {
        error: isViewMissing
          ? "Müşteri view'u kurulu değil — Migration 046'yı production'a push et."
          : "Müşteri verisi şu an çekilemiyor. Teknik ekip bilgilendirildi.",
        code: error.code,
        detail: error.message,
        hint: isViewMissing
          ? "npx supabase db push --linked çalıştır"
          : "/admin/audit-log'a göz at, son sorgu girişimleri orada",
      },
      { status: 500 }
    );
  }

  let rows: AdminCustomerWithSegment[] = (data ?? []).map((r) => ({
    ...r,
    segment: deriveSegment(r),
  }));

  // Filter: segment
  if (segment !== "all") {
    rows = rows.filter((r) => r.segment === segment);
  }

  // Filter: search
  if (search) {
    rows = rows.filter((r) => {
      const hay = [
        r.email,
        r.display_name ?? "",
        r.phone ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(search);
    });
  }

  // Filter: tag
  if (tag) {
    rows = rows.filter((r) => r.tags.includes(tag));
  }

  // Sort
  if (sort === "ltv") {
    rows.sort((a, b) => b.total_revenue - a.total_revenue);
  } else if (sort === "recent") {
    rows.sort((a, b) => {
      const aT = a.last_sign_in_at ?? a.registered_at;
      const bT = b.last_sign_in_at ?? b.registered_at;
      return new Date(bT).getTime() - new Date(aT).getTime();
    });
  } else if (sort === "name") {
    rows.sort((a, b) =>
      (a.display_name ?? a.email).localeCompare(b.display_name ?? b.email, "tr")
    );
  }

  // KPI hesabı (filter öncesi tüm rows üzerinde)
  const allRows: AdminCustomerWithSegment[] = (data ?? []).map((r) => ({
    ...r,
    segment: deriveSegment(r),
  }));
  const kpi = {
    total: allRows.length,
    vip: allRows.filter((r) => r.segment === "vip").length,
    repeat: allRows.filter((r) => r.segment === "repeat").length,
    new: allRows.filter((r) => r.segment === "new").length,
    risk: allRows.filter((r) => r.segment === "risk").length,
    lost: allRows.filter((r) => r.segment === "lost").length,
    no_order: allRows.filter((r) => r.segment === "no_order").length,
    total_revenue: allRows.reduce((s, r) => s + Number(r.total_revenue), 0),
  };

  const total = rows.length;
  const paged = rows.slice(offset, offset + limit);

  return NextResponse.json({
    ok: true,
    customers: paged,
    total,
    limit,
    offset,
    kpi,
  });
}
