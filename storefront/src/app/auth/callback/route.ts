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
 *   4. Davet kodu cookie/ref fallback ile uygulanır (Google OAuth)
 *   5. /panelim'e yönlendir
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeNextPath } from "@/lib/auth/sanitize-next-path";
import {
  applyReferralCodeIfNeeded,
  clearReferralCookie,
  readReferralCodeFromRequest,
} from "@/lib/auth/apply-referral-on-callback";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));
  const referralCode = readReferralCodeFromRequest(
    request.cookies.get("pim_referral_code")?.value,
    searchParams.get("ref")
  );

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = data.user;
      if (user?.email_confirmed_at) {
        try {
          const admin = createAdminClient();
          await admin
            .from("profiles")
            .update({
              email_verified_at: user.email_confirmed_at,
            })
            .eq("id", user.id)
            .is("email_verified_at", null);
        } catch {
          // Profile sync hatası login'i bloklamaz
        }
      }

      if (user?.id && referralCode) {
        try {
          const admin = createAdminClient();
          await applyReferralCodeIfNeeded(admin, user.id, referralCode);
        } catch {
          // Davet kodu hatası girişi bloklamaz
        }
      }

      const response = NextResponse.redirect(`${origin}${next}`);
      clearReferralCookie(response);
      return response;
    }
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}/auth`);
}
