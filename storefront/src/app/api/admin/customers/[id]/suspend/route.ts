/**
 * POST /api/admin/customers/[id]/suspend
 *
 * Hesabı geçici/kalıcı dondur — auth.users.banned_until set eder.
 * Hesap dondurma reversible: banned_until=null ile geri açılır.
 *
 * Body: { until?: ISO string | "permanent" | null, reason: string }
 *   - until=null → ban kaldır
 *   - until="permanent" → 100 yıl ileri
 *   - until=ISO → spesifik tarih
 *
 * NOT: Hesap silme YERINE bunu kullan (KVKK 30 günlük geri alma penceresi).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    until?: string | null;
    reason?: string;
  };
  const reason = (body.reason ?? "").trim();
  if (reason.length < 2 || reason.length > 200) {
    return NextResponse.json(
      { error: "invalid_reason", hint: "2-200 karakter sebep zorunlu" },
      { status: 400 }
    );
  }

  let bannedUntilIso: string | null;
  if (body.until === null || body.until === undefined) {
    bannedUntilIso = null;
  } else if (body.until === "permanent") {
    bannedUntilIso = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000)
      .toISOString();
  } else {
    const t = new Date(body.until);
    if (isNaN(t.getTime())) {
      return NextResponse.json(
        { error: "invalid_until" },
        { status: 400 }
      );
    }
    bannedUntilIso = t.toISOString();
  }

  const admin = createAdminClient();
  // Supabase admin API: banned_until set
  const { error } = await admin.auth.admin.updateUserById(id, {
    ban_duration: bannedUntilIso ? "100y" : "none",
  } as never);

  if (error) {
    return NextResponse.json(
      { error: "suspend_failed", detail: error.message },
      { status: 500 }
    );
  }

  // Customer_notes auto-log
  await admin.from("customer_notes").insert([
    {
      user_id: id,
      author_id: auth.user.id,
      author_name: auth.user.email ?? "admin",
      body: bannedUntilIso
        ? `🚫 Hesap donduruldu — Sebep: ${reason}`
        : `✓ Hesap dondurması kaldırıldı — Sebep: ${reason}`,
      pinned: true,
    },
  ] as never);

  return NextResponse.json({
    ok: true,
    suspended: !!bannedUntilIso,
    until: bannedUntilIso,
  });
}
