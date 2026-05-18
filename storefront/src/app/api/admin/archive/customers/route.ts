/**
 * GET /api/admin/archive/customers
 *
 * Pim Etiket 18 May v68 (R2 cold storage admin panel):
 * Arşivdeki / arşivlenebilir müşterilerin listesini döner.
 *
 * Query params:
 *   ?status=cold|hot|archiving|restoring|deleted|all  (default cold)
 *   ?search=<email|name>  (opsiyonel)
 *   ?limit=50  (max 200)
 *   ?offset=0
 *
 * Sefa karar: Sadece arşivdekiler değil, "hot" filter da var — admin
 * önceden bir müşteriyi manuel arşivlemek için seçebilsin.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export const runtime = "nodejs";

export interface ArchiveCustomerRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  archive_status: "hot" | "archiving" | "cold" | "restoring" | "deleted";
  archived_at: string | null;
  archive_path: string | null;
  registered_at: string;
  last_order_at: string | null;
  order_count: number;
}

export async function GET(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "cold";
  const search = url.searchParams.get("search")?.trim() ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select(
      `id, display_name, archive_status, archived_at, archive_path, created_at`,
      { count: "exact" }
    )
    .range(offset, offset + limit - 1)
    .order("archived_at", { ascending: false, nullsFirst: false });

  if (status !== "all") {
    query = query.eq("archive_status", status);
  }

  if (search) {
    query = query.ilike("display_name", `%${search}%`);
  }

  const { data, error, count } = await query;
  type ProfileRow = {
    id: string;
    display_name: string | null;
    archive_status: ArchiveCustomerRow["archive_status"];
    archived_at: string | null;
    archive_path: string | null;
    created_at: string;
  };
  const profiles = (data ?? []) as ProfileRow[];

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (profiles.length === 0) {
    return NextResponse.json({ customers: [], total: 0 });
  }

  // auth.users için service client ile email çek
  const ids = profiles.map((p) => p.id);
  const { createClient: createServiceClient } = await import(
    "@supabase/supabase-js"
  );
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const serviceClient = createServiceClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // auth.users email'leri çek (admin API üzerinden)
  const emailMap = new Map<string, string>();
  for (const uid of ids) {
    const { data: u } = await serviceClient.auth.admin.getUserById(uid);
    if (u?.user?.email) emailMap.set(uid, u.user.email);
  }

  // Order özet bilgi (count + last order)
  const { data: orderStats } = await serviceClient
    .from("orders")
    .select("user_id, created_at")
    .in("user_id", ids);

  type OrderRow = { user_id: string; created_at: string };
  const orderRows = (orderStats ?? []) as OrderRow[];
  const orderMap = new Map<string, { count: number; last: string | null }>();
  for (const o of orderRows) {
    const row = orderMap.get(o.user_id) ?? { count: 0, last: null };
    row.count += 1;
    if (!row.last || o.created_at > row.last) {
      row.last = o.created_at;
    }
    orderMap.set(o.user_id, row);
  }

  const customers: ArchiveCustomerRow[] = profiles.map((p) => {
    const stats = orderMap.get(p.id) ?? { count: 0, last: null };
    return {
      user_id: p.id,
      email: emailMap.get(p.id) ?? null,
      display_name: p.display_name,
      archive_status: p.archive_status ?? "hot",
      archived_at: p.archived_at,
      archive_path: p.archive_path,
      registered_at: p.created_at,
      last_order_at: stats.last,
      order_count: stats.count,
    };
  });

  return NextResponse.json({
    customers,
    total: count ?? customers.length,
  });
}
