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

  // Sefa 19 May v68 (Agent denetim P0 #3):
  // Eski kod ne olursa olsun "100y" geçiyordu, body.until tamamen
  // yoksayılıyordu → geçici ban koyulamıyordu. Supabase auth admin API
  // `ban_duration` parametresi süre cinsinden string ister ("24h", "7d",
  // "Ns"). ISO tarihi → fark saniyesi → "Ns" string.
  let banDuration: string;
  let bannedUntilIso: string | null;

  if (body.until === null || body.until === undefined) {
    banDuration = "none";
    bannedUntilIso = null;
  } else if (body.until === "permanent") {
    banDuration = "876000h"; // 100 yıl
    bannedUntilIso = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000)
      .toISOString();
  } else {
    const t = new Date(body.until);
    if (isNaN(t.getTime())) {
      return NextResponse.json(
        { error: "invalid_until", hint: "ISO 8601 tarih veya 'permanent'" },
        { status: 400 }
      );
    }
    const diffMs = t.getTime() - Date.now();
    if (diffMs < 60_000) {
      return NextResponse.json(
        {
          error: "until_too_short",
          hint: "Tarih en az 1 dakika ileri olmalı (geçmiş tarih ban için anlamsız)",
        },
        { status: 400 }
      );
    }
    const seconds = Math.ceil(diffMs / 1000);
    banDuration = `${seconds}s`;
    bannedUntilIso = t.toISOString();
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, {
    ban_duration: banDuration,
  } as never);

  if (error) {
    return NextResponse.json(
      { error: "suspend_failed", detail: error.message },
      { status: 500 }
    );
  }

  // Customer_notes auto-log (insan-okunabilir tarihle)
  const untilLabel = bannedUntilIso
    ? body.until === "permanent"
      ? "kalıcı"
      : new Date(bannedUntilIso).toLocaleString("tr-TR", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Istanbul",
        })
    : null;

  await admin.from("customer_notes").insert([
    {
      user_id: id,
      author_id: auth.user.id,
      author_name: auth.user.email ?? "admin",
      body: bannedUntilIso
        ? `🚫 Hesap donduruldu (${untilLabel}) — Sebep: ${reason}`
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
