/**
 * Pim Etiket — /partner/giris (Sefa 23 May v68 — Partner P1)
 *
 * Üretim partneri 2-step OTP girişi:
 *   Step 1: Email gir → POST /api/partner/auth/otp-request → kod gönder
 *   Step 2: 6 haneli kodu gir → POST /api/partner/auth/otp-verify → /partner
 *
 * Tasarım: ana /auth sayfasından dar, partner-temalı (lacivert vurgu).
 * Müşteri/admin bu sayfayı görse de yanlışlıkla giriş yapamaz (verify
 * endpoint role kontrolü yapar, partner değilse 403).
 *
 * Önemli not: Yanlış kod 5 deneme sonrası Supabase tarafında IP kilidi
 * tetikler — kullanıcı "Yeni kod iste" ile reset eder.
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pim } from "@/components/Pim";
import { Button, Input, Eyebrow, useToast } from "@/components/ui";

type Step = "email" | "otp";

export default function PartnerGirisPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-64px)]" />}>
      <PartnerGirisInner />
    </Suspense>
  );
}

function PartnerGirisInner() {
  const router = useRouter();
  const toast = useToast();
  const sp = useSearchParams();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  // Resend cooldown — kötüye kullanımı engelle (60sn)
  const [resendCooldown, setResendCooldown] = useState(0);

  // URL'den hata mesajı (middleware redirect'leri)
  const urlError = sp.get("error");
  useEffect(() => {
    if (urlError === "not_partner") {
      toast.error(
        "Bu hesap partner olarak kayıtlı değil. Yönetici ile iletişime geçin."
      );
    }
  }, [urlError, toast]);

  // Cooldown sayacı
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleSendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email.trim()) {
      toast.error("Email gerekli");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/partner/auth/otp-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok && !data.ok) {
        toast.error(data.message ?? data.error ?? "Kod gönderilemedi");
        setLoading(false);
        return;
      }
      // Başarılı (veya generic OK) — Step 2'ye geç
      toast.success(data.message ?? "Kod gönderildi. Email'inizi kontrol edin.");
      setStep("otp");
      setResendCooldown(60);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error("Kod gönderilemedi: " + msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e?: React.FormEvent) {
    e?.preventDefault();
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      toast.error("6 haneli sayısal kod girin");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/partner/auth/otp-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), token: otp }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        redirect?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        toast.error(data.message ?? data.error ?? "Kod doğrulanamadı");
        setLoading(false);
        return;
      }
      toast.success("Giriş başarılı");
      // Hard navigation — middleware role check için cookie'lerin yeniden okunması lazım
      window.location.href = data.redirect ?? "/partner";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error("Doğrulama hatası: " + msg);
      setLoading(false);
    }
  }

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex">
            <Pim pose="wave" size={64} />
          </div>
          <Eyebrow>ÜRETİM PARTNERİ</Eyebrow>
          <h1 className="mt-2 text-2xl font-bold text-lacivert">
            Partner Girişi
          </h1>
          <p className="mt-2 text-sm text-gri-700">
            {step === "email"
              ? "Kayıtlı email adresinize 6 haneli giriş kodu göndereceğiz."
              : `${email} adresine kod gönderildi. Email'inizi kontrol edin.`}
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-gri-200 bg-white p-6 shadow-sm">
          {step === "email" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-lacivert">
                  Email
                </label>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  placeholder="partner@firmaniz.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={loading || !email.trim()}
                className="w-full"
              >
                {loading ? "Gönderiliyor..." : "Giriş kodu gönder"}
              </Button>
              <p className="pt-2 text-center text-xs text-gri-700">
                Müşteri girişi mi arıyorsun?{" "}
                <a
                  href="/auth"
                  className="font-semibold text-pim-mercan hover:underline"
                >
                  /auth
                </a>
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-lacivert">
                  6 Haneli Kod
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="\d{6}"
                  required
                  placeholder="••••••"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={loading}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                />
                <p className="mt-1 text-[11px] text-gri-700">
                  Kodun süresi 60 saniyedir.
                </p>
              </div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={loading || otp.length !== 6}
                className="w-full"
              >
                {loading ? "Doğrulanıyor..." : "Giriş yap"}
              </Button>
              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  className="text-gri-700 hover:text-lacivert"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                  }}
                  disabled={loading}
                >
                  ← Email değiştir
                </button>
                <button
                  type="button"
                  className="font-semibold text-pim-mercan disabled:opacity-50 disabled:hover:no-underline hover:underline"
                  onClick={() => handleSendCode()}
                  disabled={loading || resendCooldown > 0}
                >
                  {resendCooldown > 0
                    ? `Yeni kod (${resendCooldown}sn)`
                    : "Yeni kod iste"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Alt info */}
        <p className="mt-6 text-center text-xs text-gri-700">
          Partner kaydınız yoksa Pim Etiket ekibiyle iletişime geçin:{" "}
          <a
            href="mailto:partnerlik@pimetiket.com"
            className="font-semibold text-lacivert hover:underline"
          >
            partnerlik@pimetiket.com
          </a>
        </p>
      </div>
    </main>
  );
}
