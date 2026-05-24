/**
 * GET /api/admin/customers/export
 *
 * Müşteri listesini CSV olarak indir. KVKK uyum:
 *   - Sadece admin auth ile erişilir
 *   - Tüm kayıtlar audit_log'a yazılır (kim ne zaman export aldı)
 *
 * Query: ?segment=...&search=... (liste endpoint ile aynı filter)
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminCustomerWithSegment } from "@/app/api/admin/customers/route";

const DAY = 24 * 60 * 60 * 1000;

function deriveSegment(
  row: {
    order_count: number;
    last_order_at: string | null;
  }
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

// Excel'in TR locale'i okuyabilmesi için BOM + UTF-8 + ;
function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const auth = await assertPermission("customers", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const segment = url.searchParams.get("segment") ?? "all";
  const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";

  const admin = createAdminClient();
  const { data, error } = await admin.from("v_admin_customers").select("*");

  if (error) {
    return NextResponse.json(
      { error: "query_failed", detail: error.message },
      { status: 500 }
    );
  }

  let rows = ((data ?? []) as Array<{
    user_id: string;
    email: string;
    display_name: string | null;
    phone: string | null;
    invoice_type: string | null;
    order_count: number;
    total_revenue: number;
    avg_order: number;
    last_order_at: string | null;
    registered_at: string;
    email_confirmed_at: string | null;
    has_2fa: boolean;
    tags: string[];
    marketing_subscribed: boolean;
  }>).map((r) => ({
    ...r,
    segment: deriveSegment(r),
  }));

  // Filtreler
  if (segment !== "all") {
    rows = rows.filter((r) => r.segment === segment);
  }
  if (search) {
    rows = rows.filter((r) =>
      [r.email, r.display_name ?? "", r.phone ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }

  // CSV header — Excel TR için ; ayraç + BOM
  const headers = [
    "Email",
    "Ad Soyad",
    "Telefon",
    "Segment",
    "Fatura tipi",
    "Sipariş sayısı",
    "Toplam ciro (₺)",
    "Ort. sepet (₺)",
    "Son sipariş",
    "Kayıt tarihi",
    "Email doğrulanmış",
    "2FA aktif",
    "Pazarlama izni",
    "Etiketler",
  ];

  const lines = [headers.map(escapeCsv).join(";")];
  for (const r of rows) {
    lines.push(
      [
        r.email,
        r.display_name ?? "",
        r.phone ?? "",
        r.segment,
        r.invoice_type ?? "",
        r.order_count,
        Math.round(Number(r.total_revenue)),
        Math.round(Number(r.avg_order)),
        r.last_order_at
          ? new Date(r.last_order_at).toLocaleDateString("tr-TR")
          : "",
        new Date(r.registered_at).toLocaleDateString("tr-TR"),
        r.email_confirmed_at ? "Evet" : "Hayır",
        r.has_2fa ? "Evet" : "Hayır",
        r.marketing_subscribed ? "Evet" : "Hayır",
        r.tags.join(", "),
      ]
        .map(escapeCsv)
        .join(";")
    );
  }

  // KVKK audit log — export işlemini kaydet
  try {
    await admin.from("audit_log").insert([
      {
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        action: "customer_csv_export",
        target_type: "customers",
        target_id: null,
        metadata: {
          rows: rows.length,
          segment,
          search: search || undefined,
        },
      },
    ] as never);
  } catch {
    /* audit log error silent */
  }

  // BOM + content
  const bom = "﻿";
  const csv = bom + lines.join("\r\n");
  const filename = `pimetiket-musteriler-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
