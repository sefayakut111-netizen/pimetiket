/**
 * Auth callback — Magic link / OAuth dönüş noktası.
 *
 * Supabase email'deki link şu URL'e döner:
 *   /auth/callback?code=<exchange_code>
 *
 * Burada code → session swap edilir, cookie set edilir, /panelim'e yönlendirilir.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/panelim";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Hata durumunda /auth'a fallback (mesaj query)
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(error.message)}`
    );
  }

  // Code yok — direkt /auth'a dön
  return NextResponse.redirect(`${origin}/auth`);
}
