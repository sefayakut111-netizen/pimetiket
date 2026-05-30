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
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { resolveAdminPathModule } from "@/lib/admin-rbac";
import { getMaintenanceModeActive } from "@/lib/maintenance-cache";
import {
  hasSupabaseAuthCookie,
  isRscPrefetchRequest,
} from "@/lib/middleware-request";
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
  "/onay",
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
const ADMIN_ACTIVITY_COOKIE = "pim_admin_activity";
const ADMIN_ACTIVITY_THROTTLE_MS = 15 * 60 * 1000;

async function touchAdminProfileActivity(userId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await admin
    .from("profiles")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", userId);
}

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

async function isMaintenanceModeActive(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return false;

  try {
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data } = await admin
      .from("site_settings")
      .select("maintenance_mode")
      .eq("id", 1)
      .maybeSingle();
    return !!(data as { maintenance_mode?: boolean } | null)?.maintenance_mode;
  } catch {
    return false;
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Env yoksa fail-closed (Sefa 23 May v68 — P1.4).
  // Production'da env eksikse /admin /odeme /partner /panelim gibi
  // korumalı sayfalara erişim 503 ile bloke. Public sayfalar serbest
  // (anasayfa, /sticker, /etiket, blog görünür kalır).
  // Dev/test'te (NODE_ENV !== 'production') eskiden olduğu gibi no-op
  // — local geliştirici Supabase olmadan UI'da gezebilir.
  if (!url || !anonKey) {
    if (process.env.NODE_ENV === "production") {
      const pathname = request.nextUrl.pathname;
      const sensitive =
        isProtected(pathname) ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/partner") ||
        pathname.startsWith("/odeme");
      if (sensitive) {
        return new NextResponse(
          "Service Unavailable — Auth not configured. Lütfen daha sonra tekrar deneyin.",
          { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
        );
      }
    }
    return supabaseResponse;
  }

  const pathname = request.nextUrl.pathname;
  const prefetch = isRscPrefetchRequest(request);

  // RSC prefetch — public rotalarda auth + bakım atla (503 burst azaltır).
  // Gerçek navigasyonda tam middleware çalışır.
  if (
    prefetch &&
    !isProtected(pathname) &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/partner")
  ) {
    return supabaseResponse;
  }

  // Korumalı rota prefetch + oturum cookie yok → Supabase çağrısına gerek yok
  if (prefetch && isProtected(pathname) && !hasSupabaseAuthCookie(request)) {
    return supabaseResponse;
  }

  // Bakım modu — admin/API/bakim sayfası hariç müşteri trafiğini yönlendir
  const isAdminPath = pathname.startsWith("/admin");
  const isApiPath = pathname.startsWith("/api");
  const isMaintenancePath = pathname === "/bakim";

  if (!prefetch && !isAdminPath && !isApiPath && !isMaintenancePath) {
    try {
      if (
        await getMaintenanceModeActive(() => isMaintenanceModeActive())
      ) {
        return NextResponse.rewrite(new URL("/bakim", request.url));
      }
    } catch {
      // DB erişimi başarısızsa siteyi kapatma — fail-open
    }
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

  // pathname yukarıda tanımlandı (bakım modu kontrolü)

  // 1) Korumalı rota + login değil → /auth?next=<path>
  if (!user && isProtected(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    redirectUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  // 1a) /partner — partner rolü VEYA admin/staff partner preview cookie
  if (user && pathname.startsWith("/partner") && pathname !== "/partner/giris") {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const role = (profile as { role?: string } | null)?.role;
      const viewMode = parseViewMode(
        request.cookies.get(VIEW_MODE_COOKIE)?.value
      );
      const isPartnerPreview =
        (role === "admin" || role === "staff") && viewMode === "partner";

      if (role !== "partner" && !isPartnerPreview) {
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

      // Sefa 16 May Kritik 4 + 23 May v68 (P1.5): Admin 2FA enforcement
      //
      // İki katman:
      //   A) MFA enrolled + session aal1 → /auth/mfa-challenge (zorla)
      //   B) MFA enroll edilmemiş ise:
      //      - ADMIN_2FA_REQUIRED env var "true" ise → /ayarlar/2fa enroll'a zorla
      //      - Yoksa /admin'e izin ver (Sefa solo, kendisi enroll yapana kadar
      //        bypass açık; enroll yaptıktan sonra env'i set ederek aktif eder).
      try {
        const { data: aalData } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        // (A) Enrolled ama aal1 — challenge sayfasına
        if (
          aalData?.currentLevel === "aal1" &&
          aalData?.nextLevel === "aal2"
        ) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = "/auth/mfa-challenge";
          redirectUrl.searchParams.set("next", pathname + request.nextUrl.search);
          return NextResponse.redirect(redirectUrl);
        }

        // (B) Enroll edilmemiş — feature flag ile zorla
        // currentLevel='aal1' + nextLevel='aal1' = MFA enroll edilmemiş
        const enforce2fa = process.env.ADMIN_2FA_REQUIRED === "true";
        if (
          enforce2fa &&
          aalData?.currentLevel === "aal1" &&
          aalData?.nextLevel === "aal1" &&
          !pathname.startsWith("/admin/ayarlar/2fa") &&
          !pathname.startsWith("/admin/profil") // profil sayfası 2FA enroll içerir
        ) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = "/admin/profil";
          redirectUrl.searchParams.set("force_2fa", "1");
          return NextResponse.redirect(redirectUrl);
        }
      } catch {
        // AAL check başarısız olursa admin'e izin ver (Supabase MFA env'i yoksa)
      }

      const viewMode = parseViewMode(
        request.cookies.get(VIEW_MODE_COOKIE)?.value
      );

      // Admin ama "müşteri görünümü" cookie aktif → /admin'i bloke et
      if (viewMode === "customer") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/panelim";
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }

      // Admin ama "partner analiz" modu → /admin'i bloke et
      if (viewMode === "partner") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/partner";
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }

      // Modül bazlı route guard (RBAC)
      const pathModule = resolveAdminPathModule(pathname);
      if (pathModule) {
        const { data: hasPerm, error: permErr } = await supabase.rpc(
          "fn_has_permission",
          { p_module: pathModule, p_action: "view" }
        );
        if (permErr) {
          if (process.env.NODE_ENV === "production") {
            return new NextResponse(
              "Service Unavailable — Permission check failed.",
              {
                status: 503,
                headers: { "content-type": "text/plain; charset=utf-8" },
              }
            );
          }
          console.error("[middleware] fn_has_permission error:", permErr);
        } else if (hasPerm !== true) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = "/admin";
          redirectUrl.searchParams.set("denied", pathModule);
          return NextResponse.redirect(redirectUrl);
        }
      }

      const lastTouchRaw = request.cookies.get(ADMIN_ACTIVITY_COOKIE)?.value;
      const lastTouchMs = lastTouchRaw ? Number(lastTouchRaw) : 0;
      if (
        !lastTouchMs ||
        Date.now() - lastTouchMs > ADMIN_ACTIVITY_THROTTLE_MS
      ) {
        try {
          await touchAdminProfileActivity(user.id);
          supabaseResponse.cookies.set(
            ADMIN_ACTIVITY_COOKIE,
            String(Date.now()),
            {
              maxAge: 3600,
              path: "/",
              httpOnly: true,
              sameSite: "lax",
            }
          );
        } catch {
          /* sessiz */
        }
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
