/**
 * /api/auth/auto-confirm — Resend gelene kadar geçici endpoint.
 *
 * Yeni signup yapan kullanıcının email_confirmed_at'ını otomatik set eder.
 * Mail altyapısı bağlanınca (Resend domain doğrulaması) bu endpoint
 * KAPATILACAK ve mail-tabanlı confirm akışına dönülecek.
 *
 * Güvenlik:
 *   - Sadece email_confirmed_at NULL olan, son 60 saniyede kayıt olmuş
 *     kullanıcıyı confirm eder (signup-flow attack guard)
 *   - Service role key server-only kullanılır
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SIGNUP_WINDOW_SECONDS = 60;

interface BodyShape {
  email?: unknown;
}

export async function POST(req: Request) {
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
    // Email ile kullanıcıyı bul. listUsers() supabase admin API.
    // Page filter yok, sadece email match. Toplam kullanıcı az olduğunda
    // sorun yok; çoğaldığında getUserByEmail benzeri custom RPC ekleriz.
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      perPage: 100,
    });
    if (listErr) {
      console.error("[auto-confirm] listUsers error:", listErr);
      return NextResponse.json(
        { error: "Kullanıcı listelenemedi" },
        { status: 500 }
      );
    }
    const user = list.users.find(
      (u) => u.email?.toLowerCase() === email
    );
    if (!user) {
      // Race: signUp henüz commit olmamış olabilir; retry yapsın
      return NextResponse.json(
        { error: "Kullanıcı henüz hazır değil, tekrar dene" },
        { status: 404 }
      );
    }

    // Zaten confirmed ise no-op
    if (user.email_confirmed_at) {
      return NextResponse.json({ ok: true, alreadyConfirmed: true });
    }

    // Son 60 saniyede kayıt olmuş mu?
    const createdAt = user.created_at
      ? new Date(user.created_at).getTime()
      : 0;
    const ageSec = (Date.now() - createdAt) / 1000;
    if (ageSec > SIGNUP_WINDOW_SECONDS) {
      // Eski kullanıcı — bu endpoint sadece taze signup'lar için
      return NextResponse.json(
        { error: "Bu hesap auto-confirm penceresi dışında" },
        { status: 403 }
      );
    }

    // Onayla
    const { error: updateErr } = await admin.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );
    if (updateErr) {
      console.error("[auto-confirm] update error:", updateErr);
      return NextResponse.json(
        { error: "Onaylama başarısız" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (e) {
    console.error("[auto-confirm] unexpected:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}
