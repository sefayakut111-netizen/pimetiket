/**
 * GET /api/orders/[id]/proof
 *
 * Sefa 19 May v68 (Migration 059):
 * Baskı onay sayfası (/onay/[orderId]) için tek-shot data fetch.
 * fn_proof_summary RPC ile sipariş + tüm itemler + her item'ın son
 * cutline draft'ı + açık helprequest bir kerede gelir.
 *
 * Auth: sipariş sahibi (RPC kendi içinde auth.uid() kontrol eder)
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawOrderId } = await params;
  if (!rawOrderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Case-insensitive lookup: orderId URL'den mixed case gelebilir
  // (örn. PE-2026-eAMNAqXJ vs PE-2026-EAMNAQXJ). DB'deki canonical hali bul.
  const admin = createAdminClient();
  const { data: matchOrder } = await admin
    .from("orders")
    .select("id, user_id")
    .ilike("id", rawOrderId)
    .maybeSingle();
  const orderRow = matchOrder as { id: string; user_id: string } | null;
  if (!orderRow) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  // Sefa 23 May v68: admin/staff bypass. Eski davranis: sahibi degilse 403.
  // Yeni: admin/staff /onay/duzenle sayfasini acabilmeli (musteri tasarimina
  // bicak rotuse). RPC fn_proof_summary auth.uid() kullaniyor ve admin'le
  // çağrılamaz — bu yüzden admin için aynı response shape'i raw query ile
  // /api/admin/orders/[id]/proof endpoint'inden ileri sar (proxy).
  if (orderRow.user_id !== user.id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role;

    // Partner bypass (P4): partner kendine atanmış siparişin proof'unu görsün
    // — POC editör mount edebilmek için lazım. Cross-tenant guard zorunlu.
    if (role === "partner") {
      const { data: contactRow } = await admin
        .from("partner_contacts")
        .select("partner_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const partnerId = (contactRow as { partner_id: string } | null)
        ?.partner_id;
      if (!partnerId) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      const { data: asgRow } = await admin
        .from("order_assignments")
        .select("fason_partner_id")
        .eq("order_id", orderRow.id)
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const asgPartnerId = (asgRow as { fason_partner_id: string } | null)
        ?.fason_partner_id;
      if (asgPartnerId !== partnerId) {
        return NextResponse.json({ error: "not_your_order" }, { status: 403 });
      }
      // Partner için /api/partner/orders/[id] endpoint'ine proxy
      // (PII redacted, partner shape).
      const partnerProofUrl = new URL(
        `/api/partner/orders/${orderRow.id}`,
        new URL(req.url)
      );
      const proxyRes = await fetch(partnerProofUrl.toString(), {
        headers: { cookie: req.headers.get("cookie") ?? "" },
        cache: "no-store",
      });
      const proxyData = (await proxyRes.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      // partner endpoint shape farklı (PII redacted) — /onay/duzenle page
      // çoğunlukla `order.status` ve `items[].id` kullanıyor, bu ikisi var.
      // Eksik field'lar için /onay/duzenle partner için extra guard koyacak.
      return NextResponse.json(proxyData, { status: proxyRes.status });
    }

    if (role !== "admin" && role !== "staff") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    // Admin yolu: internal admin endpoint'ini cagir (ayni cookie ile)
    const adminProofUrl = new URL(
      `/api/admin/orders/${orderRow.id}/proof`,
      new URL(req.url)
    );
    const proxyRes = await fetch(adminProofUrl.toString(), {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    const proxyData = await proxyRes.json().catch(() => ({}));
    return NextResponse.json(proxyData, { status: proxyRes.status });
  }
  const orderId = orderRow.id; // canonical

  const { data, error } = await supabase.rpc(
    "fn_proof_summary" as never,
    { p_order_id: orderId } as never
  );

  if (error) {
    console.error("[GET /orders/proof] RPC error:", error);
    return NextResponse.json(
      { error: "Sipariş özeti alınamadı", detail: error.message },
      { status: 500 }
    );
  }

  if (
    data &&
    typeof data === "object" &&
    "error" in (data as Record<string, unknown>)
  ) {
    const errVal = (data as { error: string }).error;
    const statusCode = errVal === "order_not_found" ? 404 : 403;
    return NextResponse.json({ error: errVal }, { status: statusCode });
  }

  return NextResponse.json(data);
}
