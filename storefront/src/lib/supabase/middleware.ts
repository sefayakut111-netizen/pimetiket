/**
 * Supabase auth middleware helper — Next.js middleware.ts'ten çağrılır.
 *
 * Görev: her request'te session refresh + cookie sync + route protection.
 *
 * Korumalı rotalar:
 *   - /panelim, /siparislerim, /siparis/*, /iadelerim, /iade-talep,
 *     /profil, /adreslerim, /fatura-bilgileri,
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
import { VIEW_MODE_COOKIE, parseViewMode } from "@/lib/view-mode";

const PROTECTED_PATHS: ReadonlyArray<string> = [
  "/panelim",
  "/siparislerim",
  "/siparis/",
  "/iadelerim",
  "/iade-talep",
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

/**
 * Sefa 21 May v68 — Public path exception listesi.
 *
 * PROTECTED_PATHS prefix-match yapıyor; bazı sub-path'ler login GEREKTİRMEZ
 * (mail unsubscribe confirm, yorum token sayfaları gibi).
 *
 * KRİTİK: `/bildirim-tercihleri/cikis` mail'den linkle gelen müşteriler için.
 * Müşterinin hesabı olmayabilir (lead mail), login zorunluluğu KVKK m.5/1
 * "açık rıza geri çekme" hakkını engeller + spam complaint rate'i yükseltir.
 */
const PUBLIC_PATHS: ReadonlyArray<string> = [
  "/bildirim-tercihleri/cikis", // unsubscribe confirm sayfası
];

const AUTH_PATHS: ReadonlyArray<string> = ["/auth", "/sifre-sifirla"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function isProtected(pathname: string): boolean {
  // Public exception önceliklidir
  if (isPublic(pathname)) return false;
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

  // 1a) /partner için role check — sadece 'partner' rolü girebilir
  // (Sefa 23 May v68 Partner P1). admin/staff istisna YOK — impersonation
  // için ayrı bir mekanizma planlanıyor (Faz 2).
  if (user && pathname.startsWith("/partner") && pathname !== "/partner/giris") {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const role = (profile as { role?: string } | null)?.role;
      if (role !== "partner") {
        // Yetkili değil — partner girişine yönlendir
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/partner/giris";
        redirectUrl.searchParams.set("error", "not_partner");
        return NextResponse.redirect(redirectUrl);
      }
    } catch {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/partner/giris";
      return NextResponse.redirect(redirectUrl);
    }
  }
  // /partner login değil ve user yoksa → /partner/giris
  if (!user && pathname.startsWith("/partner") && pathname !== "/partner/giris") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/partner/giris";
    redirectUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }
  // Login olmuş partner /partner/giris'e giderse → /partner (dashboard)
  if (user && pathname === "/partner/giris") {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const role = (profile as { role?: string } | null)?.role;
      if (role === "partner") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/partner";
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }
    } catch {
      // Sessiz fail — giriş sayfasında kalsın
    }
  }

  // 1b) /admin için role check + view_mode (impersonation)
  // - admin/staff dışı kullanıcı asla giremez
  // - admin/staff ama cookie pim_view_mode=customer ise → "müşteri görünümünde"
  //   sayar, /admin'i bloke et (cookie'yi silmek için /'a redirect değil — banner
  //   "Admin'e dön" butonu cookie'yi siler)
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

      // Sefa 16 May Kritik 4: Admin için 2FA enforcement
      // Eğer kullanıcı MFA enroll etmişse (factor var) ama AAL2 session değilse
      // mfa-challenge sayfasına yönlendir.
      try {
        const { data: aalData } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (
          aalData?.currentLevel === "aal1" &&
          aalData?.nextLevel === "aal2"
        ) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = "/auth/mfa-challenge";
          redirectUrl.searchParams.set("next", pathname + request.nextUrl.search);
          return NextResponse.redirect(redirectUrl);
        }
        // NOT: currentLevel='aal1' + nextLevel='aal1' = MFA enroll edilmemiş.
        // Sefa enroll edene kadar /admin'e izin ver. İlerde enroll'a zorlanacak:
        //   if (!hasEnrolledFactor) redirect to /ayarlar/2fa?force=admin
      } catch {
        // AAL check başarısız olursa admin'e izin ver (Supabase MFA env'i yoksa)
      }

      // Admin ama "müşteri görünümü" cookie aktif → /admin'i bloke et
      const viewMode = parseViewMode(
        request.cookies.get(VIEW_MODE_COOKIE)?.value
      );
      if (viewMode === "customer") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/panelim";
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
