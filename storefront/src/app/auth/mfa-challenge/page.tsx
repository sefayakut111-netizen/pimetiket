/**
 * /auth/mfa-challenge — 2FA login challenge sayfası
 *
 * Sefa 16 May üyelik audit Kritik 4 — Admin 2FA Enforcement.
 *
 * Akış:
 *   1. signInWithPassword başarılı (AAL1 session)
 *   2. Kullanıcının TOTP factor'u var ve admin/staff role
 *   3. Bu sayfaya redirect (?factor=<factorId>&next=...)
 *   4. 6 haneli code → challenge + verify
 *   5. AAL2 session → /admin'e izin
 *
 * Code yanlış girilirse 3 deneme sonra session iptal edilir
 * (Supabase tarafı otomatik handle eder).
 */

"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Eyebrow, Input, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";

export default function MfaChallengePage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-64px)]" />}>
      <MfaChallengeInner />
    </Suspense>
  );
}

function MfaChallengeInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const next = sp.get("next") ?? "/admin";

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signOutInProgress, setSignOutInProgress] = useState(false);

  // Kullanıcının TOTP factor'unu otomatik bul
  const loadFactor = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Session yok — login'e dön
        router.replace("/auth");
        return;
      }
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        toast.error(`Faktör listesi: ${error.message}`);
        return;
      }
      const totp = data?.totp?.find((f) => f.status === "verified");
      if (!totp) {
        // Verified TOTP yok — direkt geç (admin değilse)
        toast.error("Aktif 2FA faktörü bulunamadı");
        router.replace(next);
        return;
      }
      setFactorId(totp.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Beklenmedik hata");
    } finally {
      setLoading(false);
    }
  }, [router, toast, next]);

  useEffect(() => {
    void loadFactor();
  }, [loadFactor]);

  const verify = async () => {
    if (!factorId) return;
    if (!/^\d{6}$/.test(code)) {
      toast.error("6 haneli kod gir");
      return;
    }
    setVerifying(true);
    try {
      const supabase = createClient();
      // 1. Challenge
      const { data: chData, error: chErr } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (chErr || !chData) {
        toast.error(`Challenge: ${chErr?.message ?? "?"}`);
        return;
      }
      // 2. Verify
      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: chData.id,
        code,
      });
      if (verErr) {
        toast.error(`Doğrulama: ${verErr.message}`);
        setCode("");
        return;
      }
      toast.success("Doğrulandı 🎉");
      router.push(next);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Beklenmedik hata");
    } finally {
      setVerifying(false);
    }
  };

  const cancelAndSignOut = async () => {
    if (signOutInProgress) return;
    setSignOutInProgress(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/auth");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Çıkış hatası");
      setSignOutInProgress(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-64px)] grid place-items-center px-4 py-12 bg-gri-50">
      <div className="w-full max-w-[440px]">
        <Card padding="p-7">
          <div className="text-center mb-5">
            <div className="text-[40px] mb-2">🔐</div>
            <Eyebrow>İki Faktör Doğrulama</Eyebrow>
            <h1 className="mt-2 text-[22px] font-semibold text-lacivert leading-tight">
              Authenticator app kodunu gir
            </h1>
            <p className="mt-1.5 text-[13px] text-gri-700 leading-relaxed">
              Telefonundaki authenticator app&apos;te (Google
              Authenticator, 1Password, Authy) Pim Etiket için
              gösterilen 6 haneli kodu gir.
            </p>
          </div>

          {loading ? (
            <div className="animate-pulse text-center text-gri-700 py-4">
              Yükleniyor…
            </div>
          ) : factorId ? (
            <>
              <Input
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 6) void verify();
                }}
                placeholder="123456"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                className="tabular-nums tracking-[0.3em] text-center text-[22px] h-14"
              />

              <Button
                variant="primary"
                block
                size="lg"
                onClick={() => void verify()}
                disabled={verifying || code.length !== 6}
                className="mt-4"
              >
                {verifying ? "Doğrulanıyor..." : "Doğrula ve Giriş Yap"}{" "}
                {!verifying && <Icon.ArrowR size={16} />}
              </Button>

              <button
                type="button"
                onClick={() => void cancelAndSignOut()}
                disabled={signOutInProgress}
                className="block w-full text-center text-[12.5px] text-gri-700 hover:text-pim-mercan transition-colors mt-4 font-semibold"
              >
                ← İptal et ve çık
              </button>

              <p className="text-[11.5px] text-gri-500 text-center leading-relaxed mt-5 pt-4 border-t border-gri-100">
                Authenticator app&apos;ine erişimin yoksa{" "}
                <Link
                  href="mailto:info@pimetiket.com?subject=2FA%20yardim"
                  className="text-pim-mercan font-semibold hover:underline"
                >
                  destek
                </Link>
                &apos;e yaz.
              </p>
            </>
          ) : (
            <p className="text-center text-gri-700 text-[14px]">
              Faktör bulunamadı, yönlendiriliyor...
            </p>
          )}
        </Card>
      </div>
    </main>
  );
}
