/**
 * Auth callback — Magic link / OAuth / Email confirmation dönüş noktası.
 *
 * Supabase email'deki link şu URL'e döner:
 *   /auth/callback?code=<exchange_code>
 *
 * Akış:
 *   1. code → session swap (exchangeCodeForSession)
 *   2. auth.users.email_confirmed_at otomatik dolar (Supabase)
 *   3. profiles.email_verified_at sync edilir (bu callback)
 *   4. /panelim'e yönlendir
 *
 * Sefa 16 May (üyelik audit): profiles.email_verified_at trigger
 * eksikliği bug'ını client-side sync ile çözüyoruz.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Open redirect guard — `next` parametresinin sadece kendi site path'ine
 * yönlendirme yapmasını sağlar.
 *
 * Saldırı: `?next=//kotu-site.com` — tarayıcılar `//` ile başlayan path'i
 * harici URL olarak yorumlar (klasik open redirect / phishing).
 *
 * Kabul ediliyor:
 *   - Tek `/` ile başlayan path'ler: `/panelim`, `/siparislerim`, vb.
 *   - Query string ve fragment dahil: `/panelim?welcome=1`, `/p#hash`
 * Reddediliyor:
 *   - `//` ile başlayan path'ler (protocol-relative)
 *   - `/\` (Windows backslash trick — bazı tarayıcılarda // sayılır)
 *   - Mutlak URL (https://..., http://..., javascript:, vb.)
 *   - Boş / null
 */
function sanitizeNextPath(raw: string | null, fallback = "/panelim"): string {
  if (!raw || typeof raw !== "string") return fallback;
  // Sadece "/" ile başlamalı ve ikinci karakter "/" veya "\" olmamalı.
  if (!raw.startsWith("/")) return fallback;
  if (raw.length > 1 && (raw[1] === "/" || raw[1] === "\\")) return fallback;
  // Aşırı uzun path = anomalies kaynağı
  if (raw.length > 512) return fallback;
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Sefa 16 May: profiles.email_verified_at sync
      // auth.users.email_confirmed_at otomatik doldu, profile'a yansıt
      const user = data.user;
      if (user?.email_confirmed_at) {
        try {
          const admin = createAdminClient();
          await admin
            .from("profiles")
            .update({
              email_verified_at: user.email_confirmed_at,
            } as never)
            .eq("id", user.id)
            .is("email_verified_at", null); // sadece null ise update (idempotent)
        } catch {
          // Profile sync hatası login'i bloklamaz
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}/auth`);
}
