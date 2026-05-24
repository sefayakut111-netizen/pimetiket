/**
 * /api/auth/auto-confirm — Resend gelene kadar geçici endpoint.
 *
 * Yeni signup yapan kullanıcının email_confirmed_at'ını otomatik set eder.
 * Mail altyapısı bağlanınca (Resend domain doğrulaması) bu endpoint
 * KAPATILACAK ve mail-tabanlı confirm akışına dönülecek.
 *
 * Sefa 23 May v68 (Güvenlik analizi P0.3 sertleştirme):
 *   - Rate limit: IP başına 60 sn'de 5 istek
 *   - Generic 200 response — kullanıcı var/yok ayrımı kaybedildi
 *     (enumeration koruması)
 *   - userId artık response'da dönmüyor
 *   - listUsers paging: 100 → 1000 (mevcut ölçekte yeterli, mali pencere
 *     sonrası direct getUserByEmail RPC ile değiştirilecek)
 *   - SIGNUP_WINDOW_SECONDS dışında olan kullanıcı için "already confirmed"
 *     gibi davran (eski 403 mesajı bilgi sızıntısıydı)
 *
 * Güvenlik:
 *   - Sadece email_confirmed_at NULL olan, son 60 saniyede kayıt olmuş
 *     kullanıcıyı confirm eder (signup-flow attack guard)
 *   - Service role key server-only kullanılır
 *   - IP başına rate limit (Upstash varsa kalıcı, yoksa in-memory)
 *   - Response gövdesi her zaman generic (kullanıcı keşfi engellendi)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const SIGNUP_WINDOW_SECONDS = 60;

// IP başına 60 sn'de 5 istek — yeni kayıt akışı en kötü 1-2 retry yapar
const RATE_LIMIT_PER_IP = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface BodyShape {
  email?: unknown;
}

/**
 * Generic success response — kullanıcı var/yok, confirmed/değil
 * ayrımı yapmıyor. Saldırgan bilgi çıkaramaz.
 */
function genericOk() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  // 0) Rate limit — IP başına
  const ip = getClientIp(req);
  const rl = await rateLimit({
    key: `auto-confirm:${ip}`,
    limit: RATE_LIMIT_PER_IP,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "rate_limit_exceeded" },
      {
        status: 429,
        headers: { "retry-after": String(rl.retryAfter) },
      }
    );
  }

  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Geçersiz e-posta" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[auto-confirm] missing env: SUPABASE_URL or SERVICE_ROLE_KEY");
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik" },
      { status: 500 }
    );
  }

  // Service role client — RLS bypass + admin API
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Email ile kullanıcıyı bul. Sefa 23 May v68 (P1.6):
    // listUsers paging hatası kaldırıldı — fn_find_auth_user_by_email RPC
    // ile email-by-email lookup (Mig 088).
    const { data: lookupRows, error: lookupErr } = await admin.rpc(
      "fn_find_auth_user_by_email" as never,
      { p_email: email } as never
    );
    if (lookupErr) {
      console.error("[auto-confirm] rpc lookup error:", lookupErr);
      return genericOk();
    }
    const lookup =
      (lookupRows as Array<{ user_id: string; email_confirmed_at: string | null }> | null)?.[0];

    // Kullanıcı yok → generic 200 (enumeration koruması)
    if (!lookup) {
      return genericOk();
    }

    // Zaten confirmed → no-op generic 200
    if (lookup.email_confirmed_at) {
      return genericOk();
    }

    // SIGNUP_WINDOW_SECONDS kontrolü için created_at gerek; RPC dönmüyor,
    // updateUserById çağrısı için user_id yeterli. Ama age check zorunlu
    // (eski hesabı yeniden onaylama saldırısı engeli). admin.auth.admin
    // .getUserById ile created_at çek.
    const { data: userData, error: userErr } =
      await admin.auth.admin.getUserById(lookup.user_id);
    if (userErr || !userData?.user) {
      console.error("[auto-confirm] getUserById error:", userErr);
      return genericOk();
    }
    const createdAt = userData.user.created_at
      ? new Date(userData.user.created_at).getTime()
      : 0;
    const ageSec = (Date.now() - createdAt) / 1000;
    if (ageSec > SIGNUP_WINDOW_SECONDS) {
      console.warn(
        `[auto-confirm] out-of-window attempt — email ${email}, age ${Math.round(ageSec)}s`
      );
      return genericOk();
    }

    // Onayla
    const { error: updateErr } = await admin.auth.admin.updateUserById(
      lookup.user_id,
      { email_confirm: true }
    );
    if (updateErr) {
      console.error("[auto-confirm] update error:", updateErr);
      return genericOk();
    }

    // userId artık dönmüyor — enumeration koruması
    return genericOk();
  } catch (e) {
    console.error("[auto-confirm] unexpected:", e);
    return genericOk();
  }
}
