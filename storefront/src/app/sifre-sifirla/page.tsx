/**
 * Pim Etiket — /sifre-sifirla (E.2.1)
 *
 * 2-step şifre sıfırlama:
 *   Step 1: e-posta gir → "link gönderildi" ekrana
 *   Step 2: ?token=... ile yeni şifre belirle (URL parameter)
 *
 * Mock — gerçek email gönderim, token doğrulama F+I adımlarında.
 */

"use client";

import { Suspense, useState } from "react";
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
  // Supabase token query param `code` ya da Step 2'de `recovery` flow ile gelir
  const token = searchParams.get("token") ?? searchParams.get("code");

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const configured = isSupabaseConfigured();

  const onRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.length < 4) return;
    if (!configured) {
      toast.error("Auth henüz yapılandırılmadı.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/sifre-sifirla`,
      });
      if (error) {
        toast.error(`Sıfırlama linki gönderilemedi: ${error.message}`);
      } else {
        setEmailSent(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Beklenmedik hata");
    } finally {
      setLoading(false);
    }
  };

  const onUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(pw.length >= 8 && pw === pw2)) return;
    if (!configured) {
      toast.error("Auth henüz yapılandırılmadı.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      // recovery flow: link tıklandığında Supabase otomatik session açar
      // (recovery type), updateUser direkt çalışır
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        toast.error(`Şifre güncellenemedi: ${error.message}`);
        setLoading(false);
        return;
      }
      setResetDone(true);
      setLoading(false);
      setTimeout(() => router.push("/auth"), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Beklenmedik hata");
      setLoading(false);
    }
  };

  // Step 2: token varsa yeni şifre belirleme
  if (token) {
    const canSubmit = pw.length >= 8 && pw === pw2;
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[440px] px-6">
          <div className="text-center mb-8">
            <Pim pose={resetDone ? "happy" : "think"} size={120} />
            <Eyebrow>Şifre sıfırlama</Eyebrow>
            <h1 className="mt-3 text-[28px] font-semibold tracking-tight leading-tight">
              {resetDone ? "Yeni şifren hazır!" : "Yeni şifreni belirle"}
            </h1>
          </div>

          <div className="bg-white rounded-2xl shadow-1 ring-1 ring-black/[0.04] p-7">
            {resetDone ? (
              <div className="text-center">
                <p className="text-base text-gri-700 leading-relaxed mb-5">
                  Şifren güncellendi. Giriş sayfasına yönlendiriyoruz.
                </p>
                <Button variant="primary" block href="/auth">
                  Giriş yap <Icon.ArrowR />
                </Button>
              </div>
            ) : (
              <form
                onSubmit={onUpdatePassword}
                className="flex flex-col gap-3.5"
              >
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    Yeni şifre
                  </span>
                  <Input
                    type="password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="En az 8 karakter"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    Şifreyi tekrarla
                  </span>
                  <Input
                    type="password"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    placeholder="Yeniden gir"
                    autoComplete="new-password"
                    required
                  />
                  {pw2.length > 0 && pw !== pw2 && (
                    <span className="text-[13px] text-kirmizi mt-1.5 block">
                      Şifreler eşleşmiyor
                    </span>
                  )}
                </label>
                <Button
                  variant="primary"
                  size="lg"
                  block
                  type="submit"
                  disabled={!canSubmit || loading}
                  className="mt-3"
                >
                  {loading ? "Bekle..." : "Şifremi güncelle"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Step 1: e-posta gir, link iste
  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
      <div className="mx-auto max-w-[440px] px-6">
        <div className="text-center mb-8">
          <Pim pose={emailSent ? "wave" : "think"} size={120} />
          <Eyebrow>Şifre sıfırlama</Eyebrow>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight leading-tight">
            {emailSent ? "Postanı kontrol et" : "Şifreni mi unuttun?"}
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-1 ring-1 ring-black/[0.04] p-7">
          {emailSent ? (
            <div>
              <p className="text-base text-gri-700 leading-relaxed mb-5">
                <strong className="text-lacivert">{email}</strong> adresine bir
                sıfırlama linki gönderdik. 5 dakika içinde gelmediyse spam
                klasörünü kontrol et veya tekrar dene.
              </p>
              <Button
                variant="secondary"
                block
                onClick={() => {
                  setEmailSent(false);
                  setEmail("");
                }}
              >
                Tekrar dene
              </Button>
              <Link
                href="/auth"
                className="block text-center text-[13px] font-semibold text-pim-mercan hover:underline mt-4"
              >
                ← Giriş sayfasına dön
              </Link>
            </div>
          ) : (
            <form
              onSubmit={onRequestReset}
              className="flex flex-col gap-3.5"
            >
              <p className="text-[14px] text-gri-700 leading-relaxed">
                Hesabınla ilişkili e-posta adresini gir, sana sıfırlama linki
                gönderelim.
              </p>
              <label className="block">
                <span className="text-[13px] font-semibold mb-1.5 block">
                  E-posta
                </span>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="merhaba@pimetiket.com"
                  autoComplete="email"
                  required
                />
              </label>
              <Button
                variant="primary"
                size="lg"
                block
                type="submit"
                disabled={email.length < 4 || loading}
                className="mt-2"
              >
                {loading ? "Gönderiliyor..." : "Sıfırlama linki gönder"}{" "}
                {!loading && <Icon.ArrowR />}
              </Button>
              <Link
                href="/auth"
                className="text-center text-[13px] font-semibold text-pim-mercan hover:underline mt-2"
              >
                ← Giriş sayfasına dön
              </Link>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
