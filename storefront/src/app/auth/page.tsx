/**
 * Pim Etiket — /auth (E.2.1)
 *
 * Magic link tabanlı authentication — Supabase auth.
 * Sefa kararı: parolasız akış (UX kolaylık + güvenlik).
 *
 * Akış:
 *   1. User email girer
 *   2. supabase.auth.signInWithOtp({ email }) → email gönderilir
 *   3. User email'deki linke tıklar
 *   4. /auth/callback session oluşturur, /panelim'e redirect
 *
 * Google OAuth alternatif: signInWithOAuth({ provider: "google" })
 *
 * Supabase env yoksa fallback: "Auth yapılandırılmamış" mesajı.
 */

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Input, Eyebrow, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-64px)]" />}>
      <AuthPageInner />
    </Suspense>
  );
}

function AuthPageInner() {
  const toast = useToast();
  const { t } = useT();
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/panelim";
  const [email, setEmail] = useState("");
  const [acceptKvkk, setAcceptKvkk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  const configured = isSupabaseConfigured();
  const canSubmit = email.length > 3 && email.includes("@") && acceptKvkk;

  const onMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validation feedback — silent fail değil, açık mesaj
    if (!email || !email.includes("@")) {
      toast.error("Geçerli bir e-posta gir");
      return;
    }
    if (!acceptKvkk) {
      toast.error("Önce KVKK ve Şartlar'ı işaretle");
      return;
    }
    if (!configured) {
      toast.error(
        "Auth altyapısı henüz yapılandırılmadı, birazdan tekrar dene"
      );
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        toast.error(`Giriş bağlantısı gönderilemedi: ${error.message}`);
      } else {
        setLinkSent(true);
        toast.success("Giriş bağlantısı e-postana gönderildi");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Beklenmedik hata"
      );
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth — Supabase provider aktive olunca buraya handler eklenir.
  // (Eski onGoogleLogin temizlendi; UX audit P1 — provider config olmadan
  // butonun çalışmadığı görüldü.)

  // Supabase yapılandırılmamış uyarı
  if (!configured) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[480px] px-6">
          <div className="text-center mb-8">
            <Pim pose="think" size={140} />
            <Eyebrow>{t.auth.notReady}</Eyebrow>
            <h1 className="mt-3 text-[26px] font-semibold tracking-tight">
              {t.auth.notReady}
            </h1>
          </div>
          <div className="bg-white rounded-2xl shadow-1 ring-1 ring-black/[0.04] p-6 text-[14px] text-gri-700 leading-relaxed">
            {t.auth.notReadyDesc}
            <div className="mt-5 flex gap-3 flex-wrap">
              <Button variant="primary" size="sm" href="/etiket">
                <Icon.Roll size={14} /> {t.home.ctaEtiket}
              </Button>
              <Button variant="secondary" size="sm" href="/sticker">
                <Icon.Sticker size={14} /> {t.home.ctaSticker}
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Magic link gönderildi — kontrol et ekranı
  if (linkSent) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[480px] px-6 text-center">
          <Pim pose="happy" size={140} />
          <Eyebrow>{t.auth.linkSentTitle}</Eyebrow>
          <h1 className="mt-3 text-[26px] font-semibold tracking-tight">
            {t.auth.linkSentTitle}
          </h1>
          <div className="bg-white rounded-2xl shadow-1 ring-1 ring-black/[0.04] p-6 mt-6 text-left">
            <p className="text-[14px] text-gri-700 leading-relaxed">
              <strong className="text-lacivert">{email}</strong>{" "}
              {t.auth.linkSentDesc}
            </p>
            <p className="text-[12.5px] text-gri-500 mt-4 leading-relaxed">
              {t.auth.linkSentSpam}
            </p>
            <button
              type="button"
              onClick={() => {
                setLinkSent(false);
                setEmail("");
              }}
              className="text-[13px] text-pim-mercan font-semibold hover:underline mt-5"
            >
              {t.auth.linkSentDifferent}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
      <div className="mx-auto max-w-[440px] px-6">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-block">
            <Pim pose="wave" size={120} />
          </div>
          <Eyebrow>{t.auth.eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight leading-tight">
            {t.auth.title}
          </h1>
          <p className="mt-2 text-[14px] text-gri-700 leading-relaxed">
            {t.auth.subtitle}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-1 ring-1 ring-black/[0.04] p-7">
          <form onSubmit={onMagicLink} className="flex flex-col gap-4">
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                {t.auth.emailLabel}
              </span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.auth.emailPlaceholder}
                autoComplete="email"
                required
                disabled={loading}
              />
            </label>

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
                >
                  KVKK
                </Link>
                ,{" "}
                <Link
                  href="/sartlar"
                  className="text-pim-mercan font-semibold hover:underline"
                >
                  Kullanım Şartları
                </Link>{" "}
                ve{" "}
                <Link
                  href="/cerez"
                  className="text-pim-mercan font-semibold hover:underline"
                >
                  Çerez Politikası
                </Link>
                'nı kabul ediyorum.
              </span>
            </label>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              disabled={!canSubmit || loading}
            >
              {loading ? t.auth.sending : t.auth.sendLink}{" "}
              {!loading && <Icon.ArrowR />}
            </Button>
          </form>

          {/* Google OAuth — Supabase'de provider aktive edilince geri ekle.
              UX audit P1: provider config olmadan tıklayan kullanıcı hata
              alır. Resend mail aktif olunca + Google Cloud OAuth client kurulunca
              bu blok geri açılır.

              <div className="flex items-center gap-3 my-5">
                <span className="flex-1 h-px bg-gri-200" />
                <span className="text-[11.5px] text-gri-500 uppercase tracking-[0.04em]">
                  {t.auth.or}
                </span>
                <span className="flex-1 h-px bg-gri-200" />
              </div>
              <Button type="button" variant="secondary" size="lg" block
                onClick={onGoogleLogin} disabled={loading}>
                <GoogleIcon /> {t.auth.googleContinue}
              </Button>
          */}

          <p className="text-[11.5px] text-gri-500 mt-5 text-center leading-relaxed">
            {t.auth.autoCreateNote}
          </p>
        </div>

        <p className="text-[13px] text-gri-700 text-center mt-6">
          {t.auth.helpText}{" "}
          <Link
            href="/iletisim"
            className="text-pim-mercan font-semibold underline underline-offset-2 decoration-1 hover:decoration-2"
          >
            {t.auth.helpLink}
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
