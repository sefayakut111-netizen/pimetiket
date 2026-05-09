/**
 * Supabase auth middleware helper — Next.js middleware.ts'ten çağrılır.
 *
 * Görev: her request'te session refresh + cookie sync. Auth flow'un
 * çalışması için kritik.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Env yoksa middleware no-op (Supabase kurulmadan önce uygulama çalışsın)
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // KRİTİK: bu çağrı session refresh yapar (token rotation).
  // Atlanırsa cookie'ler senkronize olmaz.
  await supabase.auth.getUser();

  return supabaseResponse;
}
