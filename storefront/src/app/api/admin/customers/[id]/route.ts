/**
 * /api/admin/customers/[id]
 *
 * Müşteri 360° admin endpoint'i. Sefa 23 May v68 (P0 #4 — Grup D):
 * Bu dosya daha önce CSV export handler'ının kopyasıydı; UI 360°
 * sayfası açılırken yanlışlıkla CSV indiriyordu. Sıfırdan yazıldı.
 *
 * UI sözleşmesi (src/app/admin/musteriler/[id]/page.tsx):
 *   GET    → { ok, data?: Customer360, error? }
 *   PATCH  → { ok, error? }   (profile alanları güncelleme; UI henüz çağırmıyor)
 *   DELETE → { ok, error? }   (hesap kapatma; UI henüz çağırmıyor)
 *
 * Audit:
 *   - GET her çağrıda 'customer.view_360' yazar (KVKK m.7 — kim
 *     hangi müşterinin profilini açtı izlenir).
 *   - PATCH/DELETE mutation audit'i.
 *
 * RPC fn_admin_customer_360 security definer + admin RLS check
 * içerir; yetkisiz çağrılar 'forbidden' fırlatır.
 */

import { NextResponse, type NextRequest } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCustomerOnlyTarget } from "@/lib/admin/assert-customer-target";
import type { Enums, TablesUpdate } from "@/lib/supabase/types";

export const runtime = "nodejs";

const PatchBodySchema = z.object({
  display_name: z.string().trim().min(1).max(120).nullish(),
  phone: z.string().trim().max(40).nullish(),
  invoice_type: z.enum(["individual", "corporate"]).nullish(),
});

function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

function userAgent(req: Request): string | null {
  return req.headers.get("user-agent") ?? null;
}

// ---------------------------------------------------------------------
// GET — Customer 360° (overview + activity + orders + notes + tags + grants)
// ---------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("customers", "view");
  if (!auth) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  // RPC: fn_admin_customer_360 — security definer, admin RLS check yapıyor.
  // (Cast: Supabase tipleri generic RPC için Database<...> ister; bu projede
  //  generated types yok, runtime'da JSONB döndüğünü biliyoruz.)
  const { data, error } = await admin.rpc(
    "fn_admin_customer_360",
    { p_user_id: id }
  );

  if (error) {
    if (error.message?.toLowerCase().includes("forbidden")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "query_failed", detail: error.message },
      { status: 500 }
    );
  }

  // Audit — KVKK m.7 izlenebilirlik (kim ne zaman hangi profili açtı)
  try {
    await admin.from("audit_log").insert([
      {
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        actor_role: "admin",
        action: "customer.view_360" as Enums<"audit_action">,
        target_type: "user",
        target_id: id,
        summary: `Müşteri 360° görüntülendi: ${id}`,
        detail: {},
        ip_address: clientIp(req),
        user_agent: userAgent(req),
      },
    ]);
  } catch {
    /* audit log error silent */
  }

  return NextResponse.json({ ok: true, data });
}

// ---------------------------------------------------------------------
// PATCH — profil alanlarını güncelle (display_name / phone / invoice_type)
// ---------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("customers", "update");
  if (!auth) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const raw = await req.json().catch(() => ({}));
  const parsed = PatchBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", detail: parsed.error.message },
      { status: 400 }
    );
  }

  // Sadece gönderilen alanları güncelle (null = temizle, undefined = dokunma)
  const patch: TablesUpdate<"profiles"> = {};
  if (parsed.data.display_name !== undefined)
    patch.display_name = parsed.data.display_name;
  if (parsed.data.phone !== undefined) patch.phone = parsed.data.phone;
  if (parsed.data.invoice_type !== undefined)
    patch.invoice_type = parsed.data.invoice_type;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update(patch)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "update_failed", detail: error.message },
      { status: 500 }
    );
  }

  try {
    await admin.from("audit_log").insert([
      {
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        actor_role: "admin",
        action: "profile.delete", // TODO: enum'a 'customer.profile_update' eklenince değiştir
        target_type: "user",
        target_id: id,
        summary: `Müşteri profili güncellendi: ${Object.keys(patch).join(", ")}`,
        detail: { patch },
        ip_address: clientIp(req),
        user_agent: userAgent(req),
      },
    ]);
  } catch {
    /* audit log error silent */
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------
// DELETE — hesap kapat (auth.users sil → profiles cascade)
// ---------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("customers", "delete");
  if (!auth) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Kendini silmeye izin verme
  if (id === auth.user.id) {
    return NextResponse.json(
      { error: "cannot_delete_self" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const roleBlock = await assertCustomerOnlyTarget(admin, id);
  if (roleBlock) return roleBlock;

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json(
      { error: "delete_failed", detail: error.message },
      { status: 500 }
    );
  }

  try {
    await admin.from("audit_log").insert([
      {
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        actor_role: "admin",
        action: "profile.delete",
        target_type: "user",
        target_id: id,
        summary: `Müşteri hesabı silindi (admin tarafından): ${id}`,
        detail: { deleted_user_id: id },
        ip_address: clientIp(req),
        user_agent: userAgent(req),
      },
    ]);
  } catch {
    /* audit log error silent */
  }

  return NextResponse.json({ ok: true });
}
