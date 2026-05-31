/**
 * Pim Etiket — /sifre-sifirla (E.2.2)
 *
 * 2-step şifre sıfırlama:
 *   Step 1: e-posta gir → "link gönderildi" ekrana
 *   Step 2: ?code=... veya ?token=... ile yeni şifre belirle (Supabase
 *           recovery flow)
 *
 * Akış:
 *   1. Kullanıcı /sifre-sifirla'ya gelir, e-postasını yazar
 *   2. supabase.auth.resetPasswordForEmail(email, { redirectTo })
 *   3. Email'e link gelir → tıklar → /sifre-sifirla?code=... ile geri döner
 *   4. Yeni şifre alanları çıkar
 *   5. supabase.auth.updateUser({ password: newPw })
 *   6. /panelim'e redirect
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Input, Eyebrow, useToast } from "@/components/ui";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function SifreSifirlaPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-64px)]" />}>
      <SifreSifirlaInner />
    </Suspense>
  );
}

function SifreSifirlaInner() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  // Supabase recovery flow query: ?code=... veya hash-based ?token=...
  const recoveryToken =
    searchParams.get("code") || searchParams.get("token");

  const [email, setEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const configured = isSupabaseConfigured();

  // Recovery flow — PKCE code exchange
  useEffect(() => {
    if (!recoveryToken || !configured) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(
          recoveryToken
        );
        if (cancelled) return;
        if (error) {
          toast.error(
            `Şifre sıfırlama linki geçersiz veya süresi dolmuş: ${error.message}`
          );
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Beklenmedik hata");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recoveryToken, configured, toast]);

  // ============================================================
  // Step 1: Reset link iste
  // ============================================================

  const onRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Geçerli bir e-posta gir");
      return;
    }
    if (!configured) {
      toast.error("Auth altyapısı henüz yapılandırılmadı");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/sifre-sifirla`,
      });
      if (error) {
        toast.error(`Sıfırlama hatası: ${error.message}`);
      } else {
        setEmailSent(true);
        toast.success("Sıfırlama bağlantısı yollandı");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Beklenmedik hata");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // Step 2: Yeni şifre belirle
  // ============================================================

  const onUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) {
      toast.error("Şifre en az 8 karakter olmalı");
      return;
    }
    if (newPw !== newPw2) {
      toast.error("Şifreler eşleşmiyor");
      return;
    }
    if (!configured) {
      toast.error("Auth altyapısı henüz yapılandırılmadı");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) {
        toast.error(`Şifre güncelleme hatası: ${error.message}`);
      } else {
        setResetDone(true);
        toast.success("Şifren güncellendi");
        setTimeout(() => {
          router.push("/panelim");
          router.refresh();
        }, 1500);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Beklenmedik hata");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // UI States
  // ============================================================

  if (!configured) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[440px] px-6 text-center">
          <Pim pose="think" size={140} />
          <h1 className="mt-3 text-[24px] font-semibold tracking-tight">
            Auth henüz aktif değil
          </h1>
          <Button variant="primary" size="lg" href="/auth" className="mt-5">
            Giriş sayfasına dön
          </Button>
        </div>
      </main>
    );
  }

  // Reset tamamlandı
  if (resetDone) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[440px] px-6 text-center">
          <Pim pose="excited" size={140} />
          <Eyebrow>Tamamlandı</Eyebrow>
          <h1 className="mt-3 text-[26px] font-semibold tracking-tight">
            Şifren güncellendi 🎉
          </h1>
          <p className="mt-3 text-[14px] text-gri-700 leading-relaxed">
            Yeni şifrenle giriş yapıyorsun, panelime yönlendiriyorum...
          </p>
        </div>
      </main>
    );
  }

  // E-posta yollandı (Step 1 sonrası)
  if (emailSent) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[480px] px-6 text-center">
          <Pim pose="happy" size={140} />
          <Eyebrow>E-posta yollandı</Eyebrow>
          <h1 className="mt-3 text-[26px] font-semibold tracking-tight">
            E-postanı kontrol et 📩
          </h1>
          <div className="bg-white rounded-2xl shadow-1 ring-1 ring-black/[0.04] p-6 mt-6 text-left">
            <p className="text-[14px] text-gri-700 leading-relaxed">
              <strong className="text-lacivert">{email}</strong> adresine
              şifre sıfırlama bağlantısı yolladık. Linke tıkla, yeni şifreni
              belirle.
            </p>
            <p className="text-[12.5px] text-gri-500 mt-4 leading-relaxed">
              E-posta görünmüyorsa Spam/Gereksiz klasörünü kontrol et. Link
              1 saat içinde geçerli.
            </p>
            <button
              type="button"
              onClick={() => {
                setEmailSent(false);
                setEmail("");
              }}
              className="mt-4 text-[13px] text-pim-mercan font-semibold hover:underline"
            >
              ← Farklı e-posta dene
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Step 2: Recovery token ile geldiyse, yeni şifre formu
  if (recoveryToken) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[440px] px-6">
          <div className="text-center mb-6">
            <Pim pose="think" size={120} />
            <Eyebrow>Yeni şifre</Eyebrow>
            <h1 className="mt-3 text-[26px] font-semibold tracking-tight">
              Yeni şifreni belirle
            </h1>
            <p className="mt-2 text-[13.5px] text-gri-700">
              En az 8 karakter, harf+rakam karışık öneririz.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-1 ring-1 ring-black/[0.04] p-6">
            <form onSubmit={onUpdatePassword} className="flex flex-col gap-4">
              <label className="block">
                <span className="text-[13px] font-semibold mb-1.5 block text-gri-700">
                  Yeni şifre
                </span>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="En az 8 karakter"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    disabled={loading}
                    className="!pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Şifreyi gizle" : "Şifreyi göster"}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 p-1 text-gri-500"
                    tabIndex={-1}
                  >
                    {showPw ? <Icon.EyeOff size={16} /> : <Icon.Eye size={16} />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="text-[13px] font-semibold mb-1.5 block text-gri-700">
                  Yeni şifre (tekrar)
                </span>
                <Input
                  type={showPw ? "text" : "password"}
                  value={newPw2}
                  onChange={(e) => setNewPw2(e.target.value)}
                  placeholder="Şifreyi tekrar yaz"
                  autoComplete="new-password"
                  required
                  disabled={loading}
                />
                {newPw2.length > 0 && newPw !== newPw2 && (
                  <p className="text-[11.5px] text-kirmizi mt-1">
                    Şifreler eşleşmiyor
                  </p>
                )}
              </label>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                disabled={loading}
              >
                {loading ? "Güncelleniyor..." : "Şifreyi güncelle"}
              </Button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  // Step 1: E-posta formu
  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
      <div className="mx-auto max-w-[440px] px-6">
        <div className="text-center mb-6">
          <Pim pose="think" size={120} />
          <Eyebrow>Şifremi unuttum</Eyebrow>
          <h1 className="mt-3 text-[26px] font-semibold tracking-tight">
            Şifreni mi unuttun?
          </h1>
          <p className="mt-2 text-[14px] text-gri-700 leading-relaxed">
            E-postanı yaz, sıfırlama bağlantısı yollayalım. Link 1 saat
            geçerli.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-1 ring-1 ring-black/[0.04] p-6">
          <form onSubmit={onRequestReset} className="flex flex-col gap-4">
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

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              disabled={loading}
            >
              {loading ? "Yollanıyor..." : "Sıfırlama bağlantısı yolla"}{" "}
              {!loading && <Icon.ArrowR />}
            </Button>
          </form>
        </div>

        <p className="text-[13px] text-gri-700 text-center mt-6">
          Şifreni hatırladın mı?{" "}
          <Link
            href="/auth"
            className="text-pim-mercan font-semibold underline underline-offset-2 decoration-1"
          >
            Giriş sayfasına dön
          </Link>
        </p>
      </div>
    </main>
  );
}
