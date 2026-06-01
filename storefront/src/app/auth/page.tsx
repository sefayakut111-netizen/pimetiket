/**
 * Pim Etiket — /auth (E.2.1)
 *
 * Klasik şifreli authentication — email + password + KVKK.
 * Tek sayfa, mode toggle: Login | Signup
 *
 * Akış:
 *   - Login: supabase.auth.signInWithPassword({ email, password })
 *   - Signup: supabase.auth.signUp({ email, password })
 *     → Supabase email confirmation açıksa kullanıcıya mail atılır
 *     → Confirm sonrası kullanıcı giriş yapabilir
 *   - Forgot password: /sifre-sifirla'ya yönlendirir
 *
 * Supabase env yoksa fallback: "Auth yapılandırılmamış" mesajı.
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Input, Eyebrow, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { sanitizeNextPath } from "@/lib/auth/sanitize-next-path";
import {
  initialReferralCode,
  isReferralCodePresent,
  normalizeReferralCode,
  persistReferralToSession,
  setReferralCookie,
} from "@/lib/auth/referral-code";
import { useSiteImage } from "@/lib/site-images-client";

type AuthMode = "login" | "signup";

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-64px)]" />}>
      <AuthInner />
    </Suspense>
  );
}

function AuthInner() {
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sanitizeNextPath(sp.get("next"), "/panelim");
  const initialMode = (sp.get("mode") === "signup" ? "signup" : "login") as AuthMode;
  const urlReferralCode = sp.get("ref");
  const authHero = useSiteImage("auth_hero");

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState(() =>
    initialReferralCode(urlReferralCode)
  );
  const [showPassword, setShowPassword] = useState(false);
  const [acceptKvkk, setAcceptKvkk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const configured = isSupabaseConfigured();

  useEffect(() => {
    const fromUrl = normalizeReferralCode(urlReferralCode);
    if (fromUrl) setInviteCode(fromUrl);
  }, [urlReferralCode]);

  useEffect(() => {
    persistReferralToSession(inviteCode);
  }, [inviteCode]);

  const resolvedInviteCode = normalizeReferralCode(inviteCode);

  // Sefa 16 May UX bug fix: URL'deki error parametrelerini görünür yap.
  // Hem ?error= (query) hem #error= (hash) parse edilir.
  //
  // Senaryolar:
  //   - OAuth callback DB hatası: /auth#error=server_error&error_description=...
  //   - Supabase generic redirect: /auth?error=access_denied
  //   - Manual: /auth?error=password_invalid
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1) Hash parse (#error=...)
    const hash = window.location.hash.replace(/^#/, "");
    const hashParams = new URLSearchParams(hash);
    const hashError = hashParams.get("error") || hashParams.get("error_code");
    const hashDesc = hashParams.get("error_description");

    // 2) Query parse (?error=...)
    const queryError = sp.get("error");
    const queryDesc = sp.get("error_description");

    const errorCode = hashError || queryError;
    const errorDesc = hashDesc || queryDesc;

    if (errorCode) {
      // Kullanıcı dostu mesajlar
      const friendlyMap: Record<string, string> = {
        server_error:
          "Sunucu hatası. Bir saniye sonra tekrar dene veya farklı yöntem (e-posta/şifre) kullan.",
        unexpected_failure:
          "Beklenmedik bir sorun. Lütfen tekrar dene; sorun devam ederse info@pimetiket.com'a yaz.",
        access_denied: "Giriş iptal edildi.",
        otp_expired:
          "Bağlantı süresi dolmuş. Yeniden mail iste veya şifreyle gir.",
      };

      const friendly = friendlyMap[errorCode] ?? "Giriş hatası.";
      const detail = errorDesc
        ? `\n${errorDesc.replace(/\+/g, " ").replace(/_/g, " ")}`
        : "";

      toast.error(`${friendly}${detail}`);

      // URL'i temizle (hata bir daha gösterilmesin)
      if (window.history.replaceState) {
        const cleanUrl = window.location.pathname + window.location.search.replace(/[?&]error[^&]*/g, "").replace(/[?&]error_description[^&]*/g, "").replace(/[?&]error_code[^&]*/g, "").replace(/^&/, "?");
        window.history.replaceState({}, "", cleanUrl);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // Submit handlers
  // ============================================================

  const validate = (): string | null => {
    if (!email || !email.includes("@")) return "Geçerli bir e-posta gir";
    if (!password) return "Şifreni gir";
    if (password.length < 8) return "Şifre en az 8 karakter olmalı";
    if (mode === "signup") {
      if (password !== passwordConfirm) return "Şifreler eşleşmiyor";
      if (!acceptKvkk) return "KVKK ve Şartlar'ı işaretlemen gerekiyor";
    }
    return null;
  };

  // Sefa 16 May üyelik audit Kritik 2: Google OAuth
  const onGoogleSignIn = async () => {
    if (loading) return;
    if (mode === "signup" && !acceptKvkk) {
      toast.error("Devam etmek için KVKK metnini onayla");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const oauthRedirect = new URL(`${window.location.origin}/auth/callback`);
      oauthRedirect.searchParams.set("next", next);
      if (isReferralCodePresent(resolvedInviteCode)) {
        oauthRedirect.searchParams.set("ref", resolvedInviteCode);
        setReferralCookie(resolvedInviteCode);
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: oauthRedirect.toString(),
          ...(isReferralCodePresent(resolvedInviteCode)
            ? { data: { referral_code: resolvedInviteCode } }
            : {}),
        },
      });
      if (error) {
        if (
          error.message.toLowerCase().includes("provider is not enabled") ||
          error.message.toLowerCase().includes("not configured")
        ) {
          toast.error(
            "Google girişi henüz aktif değil. Email + şifre kullanabilirsin."
          );
        } else {
          toast.error(`Google girişi: ${error.message}`);
        }
        setLoading(false);
      }
      // Başarılıysa Supabase otomatik redirect eder, setLoading(false) gerekmez
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Beklenmedik hata");
      setLoading(false);
    }
  };

  const onLogin = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (!configured) {
      toast.error("Auth altyapısı henüz yapılandırılmadı");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        // Sefa 16 May Migration 041: brute force tespit için
        // başarısız giriş denemesi server-side log'lanır.
        // Fire-and-forget — login akışını bloklamaz.
        const reason = error.message.toLowerCase().includes("invalid login")
          ? "password_invalid"
          : error.message.toLowerCase().includes("email not confirmed")
            ? "email_not_confirmed"
            : "other";
        void fetch("/api/auth/log-failed-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, reason }),
        }).catch(() => {
          /* silently */
        });

        if (error.message.toLowerCase().includes("invalid login")) {
          toast.error("E-posta veya şifre hatalı");
        } else if (error.message.toLowerCase().includes("email not confirmed")) {
          toast.error(
            "E-postanı doğrulaman gerekiyor. Gelen kutunu kontrol et."
          );
        } else {
          toast.error(`Giriş hatası: ${error.message}`);
        }
      } else {
        // Sefa 16 May Kritik 4: 2FA enforcement
        // Login başarılı → MFA factor varsa AAL2 zorla
        try {
          const { data: aalData } =
            await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (
            aalData?.currentLevel === "aal1" &&
            aalData?.nextLevel === "aal2"
          ) {
            // MFA enroll edilmiş ama bu session henüz AAL2 değil
            router.push(`/auth/mfa-challenge?next=${encodeURIComponent(next)}`);
            return;
          }
        } catch {
          // AAL check başarısız olursa normal akışa devam (MFA yoksa zaten gerek yok)
        }
        toast.success("Hoş geldin!");
        router.push(next);
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Beklenmedik hata");
    } finally {
      setLoading(false);
    }
  };

  const onSignup = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (!configured) {
      toast.error("Auth altyapısı henüz yapılandırılmadı");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          ...(isReferralCodePresent(resolvedInviteCode) && {
            data: { referral_code: resolvedInviteCode },
          }),
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes("already registered")) {
          toast.error(
            "Bu e-posta zaten kayıtlı. Giriş yap ya da şifreni sıfırla."
          );
          setMode("login");
        } else {
          toast.error(`Üyelik hatası: ${error.message}`);
        }
      } else {
        // Email confirmation gerekiyorsa session null olur. Resend gelene
        // kadar otomatik onay endpoint'iyle kullanıcıyı geçir.
        if (data.session) {
          // Email confirmation kapalı veya zaten confirmed
          toast.success("Hoş geldin!");
          router.push(next);
          router.refresh();
        } else {
          // Mail bekliyor — auto-confirm endpoint'iyle bypass
          try {
            const confirmRes = await fetch("/api/auth/auto-confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            if (confirmRes.ok) {
              // Otomatik onay başarılı → şifreyle hemen login ol
              const { error: signInErr } =
                await supabase.auth.signInWithPassword({ email, password });
              if (!signInErr) {
                toast.success("Hesabın hazır, hoş geldin!");
                router.push(next);
                router.refresh();
                return;
              }
              // Login fail → success ekranı göster, kullanıcı manuel girsin
              toast.info("Hesabın açıldı, lütfen giriş yap");
              setMode("login");
              setPassword("");
              setPasswordConfirm("");
              return;
            }
          } catch (e) {
            console.error("[auth] auto-confirm error:", e);
          }
          // Fallback: success ekranı (mail bekleme görünümü)
          setSignupSuccess(true);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Beklenmedik hata");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // UI States
  // ============================================================

  // Supabase yapılandırılmamış
  if (!configured) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[480px] px-6 text-center">
          <Pim pose="think" size={140} />
          <Eyebrow>Auth</Eyebrow>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight">
            Giriş yakında açılacak
          </h1>
          <p className="mt-3 text-[14px] text-gri-700 leading-relaxed">
            Auth altyapısı kurulum aşamasında. Şu an sipariş ve sepet
            akışlarını giriş yapmadan da kullanabilirsin.
          </p>
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <Button variant="primary" size="sm" href="/etiket">
              <Icon.Roll size={14} /> Etiket bastır
            </Button>
            <Button variant="secondary" size="sm" href="/sticker">
              <Icon.Sticker size={14} /> Sticker bastır
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Signup tamamlandı, e-posta doğrulama bekleniyor
  if (signupSuccess) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[480px] px-6 text-center">
          <Pim pose="happy" size={140} />
          <Eyebrow>Hesabın oluşturuldu</Eyebrow>
          <h1 className="mt-3 text-[26px] font-semibold tracking-tight">
            E-postanı kontrol et 📩
          </h1>
          <div className="bg-white rounded-2xl shadow-1 ring-1 ring-black/[0.04] p-6 mt-6 text-left">
            <p className="text-[14px] text-gri-700 leading-relaxed">
              <strong className="text-lacivert">{email}</strong> adresine
              doğrulama bağlantısı yolladık. Linke tıkla, hesabını aktive et,
              ardından buraya dönüp giriş yapabilirsin.
            </p>
            <p className="text-[12.5px] text-gri-500 mt-4 leading-relaxed">
              E-posta görünmüyorsa Spam/Gereksiz klasörünü kontrol et —
              gönderim altyapımız henüz domain doğrulamasında, ilk e-posta
              Spam'a düşebilir.
            </p>
            <button
              type="button"
              onClick={() => {
                setSignupSuccess(false);
                setMode("login");
                setPassword("");
                setPasswordConfirm("");
              }}
              className="mt-4 text-[13px] text-pim-mercan font-semibold hover:underline"
            >
              ← Giriş sayfasına dön
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Ana form (login veya signup)
  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
      <div className="mx-auto max-w-[440px] px-6">
        <div className="text-center mb-6">
          {authHero ? (
            <Image
              src={authHero.publicUrl}
              alt={authHero.altText ?? "Pim Etiket"}
              width={160}
              height={160}
              className="mx-auto h-auto object-contain"
            />
          ) : (
            <Pim pose="wave" size={120} />
          )}
          <Eyebrow>{mode === "login" ? "Giriş" : "Üye Ol"}</Eyebrow>
          <h1 className="mt-3 text-[26px] md:text-[30px] font-semibold tracking-tight">
            {mode === "login" ? "Hoş geldin tekrar" : "Aramıza katıl"}
          </h1>
          <p className="mt-2 text-[14px] text-gri-700 leading-relaxed">
            {mode === "login"
              ? "E-posta ve şifrenle hızlıca giriş yap."
              : "30 saniyelik form, sonra sipariş geçmeye hazırsın."}
          </p>
          {mode === "signup" && isReferralCodePresent(resolvedInviteCode) && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-yesil-soft ring-1 ring-yesil/30 text-[12.5px] font-semibold text-yesil">
              <Icon.Check size={12} /> Davet kodu:{" "}
              <code className="font-mono font-bold">{resolvedInviteCode}</code> —
              üye olunca hesabına %10 indirim kuponu tanımlanır
            </div>
          )}
        </div>

        {/* Mode toggle */}
        <div className="bg-white rounded-full ring-1 ring-gri-200 p-1 grid grid-cols-2 gap-1 mb-5 max-w-[340px] mx-auto">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setPassword("");
              setPasswordConfirm("");
            }}
            className={
              mode === "login"
                ? "h-9 rounded-full bg-lacivert text-white text-[13px] font-semibold"
                : "h-9 rounded-full text-gri-700 text-[13px] font-semibold hover:text-lacivert"
            }
          >
            Giriş yap
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setPassword("");
              setPasswordConfirm("");
            }}
            className={
              mode === "signup"
                ? "h-9 rounded-full bg-lacivert text-white text-[13px] font-semibold"
                : "h-9 rounded-full text-gri-700 text-[13px] font-semibold hover:text-lacivert"
            }
          >
            Üye ol
          </button>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-1 ring-1 ring-black/[0.04] p-6 md:p-7">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "login") void onLogin();
              else void onSignup();
            }}
            className="flex flex-col gap-4"
          >
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block text-gri-700">
                E-posta
              </span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="örnek@marka.com"
                autoComplete="email"
                required
                disabled={loading}
              />
            </label>

            <label className="block">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-semibold text-gri-700">
                  Şifre
                </span>
                {mode === "login" && (
                  <Link
                    href="/sifre-sifirla"
                    className="text-[12px] text-pim-mercan font-semibold hover:underline"
                  >
                    Şifremi unuttum
                  </Link>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "En az 8 karakter" : "Şifren"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={8}
                  disabled={loading}
                  className="!pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 p-1 text-gri-500 hover:text-lacivert"
                  tabIndex={-1}
                >
                  {showPassword ? <Icon.EyeOff size={16} /> : <Icon.Eye size={16} />}
                </button>
              </div>
              {mode === "signup" && password.length > 0 && password.length < 8 && (
                <p className="text-[11.5px] text-kirmizi mt-1">
                  En az 8 karakter gerekli ({password.length}/8)
                </p>
              )}
            </label>

            {mode === "signup" && (
              <label className="block">
                <span className="text-[13px] font-semibold mb-1.5 block text-gri-700">
                  Şifre (tekrar)
                </span>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Şifreyi tekrar yaz"
                  autoComplete="new-password"
                  required
                  disabled={loading}
                />
                {passwordConfirm.length > 0 && password !== passwordConfirm && (
                  <p className="text-[11.5px] text-kirmizi mt-1">
                    Şifreler eşleşmiyor
                  </p>
                )}
              </label>
            )}

            {mode === "signup" && (
              <label className="block">
                <span className="text-[13px] font-semibold mb-1.5 block text-gri-700">
                  Davet / referans kodu{" "}
                  <span className="font-normal text-gri-500">(isteğe bağlı)</span>
                </span>
                <Input
                  type="text"
                  value={inviteCode}
                  onChange={(e) =>
                    setInviteCode(e.target.value.toUpperCase())
                  }
                  placeholder="Örn: PIM-ABC12345"
                  autoComplete="off"
                  disabled={loading}
                  className="font-mono uppercase"
                />
              </label>
            )}

            {mode === "signup" && (
              <label className="flex items-start gap-2.5 text-[12.5px] text-gri-700 leading-relaxed cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptKvkk}
                  onChange={(e) => setAcceptKvkk(e.target.checked)}
                  className="mt-0.5 accent-pim-mercan shrink-0"
                />
                <span>
                  <Link
                    href="/kvkk"
                    className="text-pim-mercan font-semibold hover:underline"
                    target="_blank"
                  >
                    KVKK Aydınlatma Metni
                  </Link>
                  ,{" "}
                  <Link
                    href="/sartlar"
                    className="text-pim-mercan font-semibold hover:underline"
                    target="_blank"
                  >
                    Kullanım Şartları
                  </Link>{" "}
                  ve{" "}
                  <Link
                    href="/cerez"
                    className="text-pim-mercan font-semibold hover:underline"
                    target="_blank"
                  >
                    Çerez Politikası
                  </Link>
                  &rsquo;nı okudum, kabul ediyorum.
                  {" "}
                  <strong>Pim asistanını kullandığımda sohbet
                  içeriklerimin OpenAI (ABD) üzerinden işlenebileceğini,
                  ödeme bilgilerimin PayTR&rsquo;ye, e-posta bildirimlerinin
                  Resend (ABD) ile gönderilebileceğini ve verilerimin
                  Supabase Frankfurt&rsquo;ta saklanabileceğini KVKK m.9
                  kapsamında kabul ediyorum.</strong> Detayları{" "}
                  <Link
                    href="/kvkk#5-aktarim"
                    className="text-pim-mercan font-semibold hover:underline"
                    target="_blank"
                  >
                    KVKK Bölüm 5.2-5.5
                  </Link>
                  &rsquo;te okuyabilirim.
                </span>
              </label>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              disabled={loading}
            >
              {loading
                ? "Yükleniyor..."
                : mode === "login"
                  ? "Giriş yap"
                  : "Hesabımı oluştur"}{" "}
              {!loading && <Icon.ArrowR />}
            </Button>

            {/* Sefa 16 May üyelik audit Kritik 2: Google OAuth */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-gri-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[11.5px] text-gri-500 uppercase tracking-[0.06em]">
                  veya
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void onGoogleSignIn()}
              disabled={loading}
              className="w-full h-12 rounded-full bg-white ring-1 ring-gri-300 text-[14px] font-semibold text-lacivert hover:ring-pim-mercan hover:bg-gri-50 transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* Google logo SVG */}
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Google ile devam et
            </button>
          </form>

          <p className="text-[11.5px] text-gri-700 mt-5 text-center leading-relaxed">
            {mode === "login" ? (
              <>
                Hesabın yok mu?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setPassword("");
                    setPasswordConfirm("");
                  }}
                  className="text-pim-mercan font-semibold hover:underline"
                >
                  Üye ol
                </button>{" "}
                — 30 saniye sürer.
              </>
            ) : (
              <>
                Zaten hesabın var mı?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setPassword("");
                    setPasswordConfirm("");
                  }}
                  className="text-pim-mercan font-semibold hover:underline"
                >
                  Giriş yap
                </button>
              </>
            )}
          </p>
        </div>

        <p className="text-[13px] text-gri-700 text-center mt-6">
          Yardım gerekirse{" "}
          <Link
            href="/iletisim"
            className="text-pim-mercan font-semibold underline underline-offset-2 decoration-1 hover:decoration-2"
          >
            bize yaz
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
