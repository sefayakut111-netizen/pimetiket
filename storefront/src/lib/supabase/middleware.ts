/**
 * Supabase auth middleware helper — Next.js middleware.ts'ten çağrılır.
 *
 * Görev: her request'te session refresh + cookie sync + route protection.
 *
 * Korumalı rotalar:
 *   - /panelim, /siparislerim, /siparis/*, /iadelerim, /iade-talep,
 *     /cuzdan, /profil, /adreslerim, /fatura-bilgileri,
 *     /bildirim-tercihleri, /odeme, /odeme-sonuc
 *   - /admin/* (gelecekte staff role check ile)
 *
 * Login olmayan kullanıcı korumalı rotaya gelirse → /auth?next=<path>
 *
 * Login olan kullanıcı /auth veya /sifre-sifirla'ya giderse → /panelim
 *
 * Supabase env yoksa middleware no-op (uygulama çalışsın).
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATHS: ReadonlyArray<string> = [
  "/panelim",
  "/siparislerim",
  "/siparis/",
  "/iadelerim",
  "/iade-talep",
  "/cuzdan",
  "/profil",
  "/adreslerim",
  "/fatura-bilgileri",
  "/bildirim-tercihleri",
  "/odeme",
  "/odeme-sonuc",
  "/yorum-yaz",
  "/demo", // staff/test sayfası — public erişimden gizlendi (UX audit P0)
  "/admin", // staff role check ileride; şimdilik login zorunlu
];

const AUTH_PATHS: ReadonlyArray<string> = ["/auth", "/sifre-sifirla"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/") || pathname === p.replace(/\/$/, "")
  );
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p);
}

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 1) Korumalı rota + login değil → /auth?next=<path>
  if (!user && isProtected(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    redirectUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  // 1b) /admin için role check — admin/staff dışı kullanıcı 404 görür
  if (user && pathname.startsWith("/admin")) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const role = (profile as { role?: string } | null)?.role;
      if (role !== "admin" && role !== "staff") {
        // Yetkili değil — anasayfaya yönlendir (404 yerine zarif düşüş)
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/";
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }
    } catch {
      // DB hatası olursa güvenli taraf — admin'e izin verme
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 2) Login olan kullanıcı /auth'a giderse → /panelim
  // (recovery flow için /sifre-sifirla'ya istisna: ?code=... parametre varsa
  // izin ver — kullanıcı recovery linkinden geliyor olabilir)
  if (user && isAuthPath(pathname)) {
    const hasCode = request.nextUrl.searchParams.has("code") ||
      request.nextUrl.searchParams.has("token");
    if (!hasCode) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/panelim";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
