/**
 * Cron endpoint auth helper.
 *
 * Timing-safe karşılaştırma — string equality leak'i kapatır.
 * Vercel Cron Authorization header'ı `Bearer <CRON_SECRET>` formatında
 * gönderir.
 *
 * Kullanım:
 *   const guard = assertCronAuth(req);
 *   if (guard) return guard; // 401/500 NextResponse
 */

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export function assertCronAuth(req: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron-auth] CRON_SECRET env var eksik");
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;

  // Buffer boyutları eşit olmazsa timingSafeEqual fırlatır; önce boyut
  // karşılaştır (boyut leak'i kabul edilebilir, mantıken kaçınılmaz).
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
