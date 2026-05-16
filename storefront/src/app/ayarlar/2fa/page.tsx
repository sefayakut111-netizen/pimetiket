/**
 * /ayarlar/2fa — İki faktör auth (TOTP) yönetimi
 *
 * Sefa 16 May üyelik audit Kritik 4: Admin 2FA.
 *
 * Akış:
 *   1. Mevcut factor'u listele (auth.mfa.listFactors)
 *   2. Aktif TOTP yoksa "Etkinleştir" butonu → enroll
 *      - enroll() → factorId + QR (data-uri) + secret
 *      - Kullanıcı authenticator app'e ekle (Google Authenticator, 1Password, vb)
 *      - 6 haneli kod gir → challenge + verify
 *      - factor "verified" duruma geçer
 *   3. Aktif factor varsa "Kaldır" butonu (unenroll)
 *
 * Login enforcement (signInWithPassword sonrası AAL2 zorla) ayrı
 * bir iş — şu an opsiyonel enroll.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Eyebrow, Input, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

interface Factor {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string;
  created_at?: string;
}

interface EnrollResult {
  factorId: string;
  qrCode: string; // data:image/svg+xml... veya data:image/png...
  secret: string;
  uri: string;
}

export default function TwoFactorPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrollment, setEnrollment] = useState<EnrollResult | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const configured = isSupabaseConfigured();

  const loadFactors = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        toast.error(`Faktör listesi: ${error.message}`);
      } else {
        setFactors((data?.all ?? []) as Factor[]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Beklenmedik hata");
    } finally {
      setLoading(false);
    }
  }, [configured, toast]);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  const startEnroll = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Pim Etiket — " + new Date().toLocaleDateString("tr-TR"),
      });
      if (error) {
        toast.error(`Enroll: ${error.message}`);
        return;
      }
      if (data) {
        setEnrollment({
          factorId: data.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
          uri: data.totp.uri,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Beklenmedik hata");
    } finally {
      setLoading(false);
    }
  };

  const verifyEnroll = async () => {
    if (!enrollment) return;
    if (!/^\d{6}$/.test(code)) {
      toast.error("6 haneli kod gir");
      return;
    }
    setVerifying(true);
    try {
      const supabase = createClient();
      // 1. Challenge oluştur
      const { data: chData, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: enrollment.factorId,
      });
      if (chErr || !chData) {
        toast.error(`Challenge: ${chErr?.message}`);
        return;
      }
      // 2. Verify
      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: chData.id,
        code,
      });
      if (verErr) {
        toast.error(`Doğrulama hatası: ${verErr.message}`);
        return;
      }
      toast.success("2FA etkinleştirildi 🎉");
      setEnrollment(null);
      setCode("");
      await loadFactors();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Beklenmedik hata");
    } finally {
      setVerifying(false);
    }
  };

  const removeFactor = async (factorId: string) => {
    if (!confirm("2FA faktörünü kaldırmak istediğine emin misin?")) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        toast.error(`Kaldırma: ${error.message}`);
      } else {
        toast.success("Faktör kaldırıldı");
        await loadFactors();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Beklenmedik hata");
    } finally {
      setLoading(false);
    }
  };

  const cancelEnroll = async () => {
    if (!enrollment) return;
    setEnrollment(null);
    setCode("");
    // Pending factor'u cleanup
    try {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    } catch {
      /* silently */
    }
    await loadFactors();
  };

  const verifiedFactor = factors.find(
    (f) => f.factor_type === "totp" && f.status === "verified"
  );

  if (!configured) {
    return (
      <main className="py-12 px-6 max-w-[600px] mx-auto">
        <p className="text-gri-700">Auth yapılandırılmamış.</p>
      </main>
    );
  }

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[720px] px-4 md:px-6">
        {/* Header */}
        <div className="mb-6">
          <div className="text-[12.5px] mb-2">
            <Link
              href="/panelim"
              className="text-gri-700 hover:text-pim-mercan transition-colors"
            >
              ← Panelim
            </Link>
          </div>
          <Eyebrow>Güvenlik</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-tight">
            İki Faktör Doğrulama (2FA)
          </h1>
          <p className="mt-1.5 text-[14px] text-gri-700 leading-relaxed">
            Telefonundaki authenticator app (Google Authenticator, 1Password,
            Authy) ile giriş güvenliğini ikiye katla. Hesabın ele geçirilse
            bile şifre yetmez.
          </p>
        </div>

        {/* Loading */}
        {loading && !enrollment && (
          <Card padding="p-6">
            <div className="animate-pulse text-gri-700">Yükleniyor…</div>
          </Card>
        )}

        {/* Aktif TOTP varsa */}
        {!loading && verifiedFactor && !enrollment && (
          <Card padding="p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <div className="text-[11.5px] uppercase tracking-[0.04em] font-semibold text-yesil mb-1">
                  ✓ Aktif
                </div>
                <h2 className="text-[18px] font-semibold text-lacivert">
                  Authenticator app etkin
                </h2>
                <p className="text-[12.5px] text-gri-700 mt-1">
                  {verifiedFactor.friendly_name ?? "TOTP Authenticator"}
                  {verifiedFactor.created_at && (
                    <span className="text-gri-500">
                      {" "}
                      ·{" "}
                      {new Date(verifiedFactor.created_at).toLocaleDateString(
                        "tr-TR"
                      )}
                    </span>
                  )}
                </p>
              </div>
              <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-yesil-soft/40 text-yesil ring-1 ring-yesil/30 text-[11px] font-bold">
                🔒 Korumalı
              </span>
            </div>
            <div className="bg-saman/10 ring-1 ring-saman/20 rounded-lg p-3 text-[13px] text-saman-koyu mb-4">
              ⚠ Faktörü kaldırırsan giriş şifre + email ile yapılır,
              ekstra güvenlik kalkmış olur.
            </div>
            <Button
              variant="ghost"
              onClick={() => void removeFactor(verifiedFactor.id)}
              disabled={loading}
            >
              Faktörü Kaldır
            </Button>
          </Card>
        )}

        {/* TOTP yoksa enroll başlat */}
        {!loading && !verifiedFactor && !enrollment && (
          <Card padding="p-6">
            <h2 className="text-[18px] font-semibold text-lacivert mb-2">
              2FA henüz etkin değil
            </h2>
            <p className="text-[13px] text-gri-700 leading-relaxed mb-4">
              Authenticator app yükle, QR kodu tarat, 6 haneli kodu gir.
              Hesabın daha güvenli hale gelir.
            </p>
            <p className="text-[12.5px] text-gri-700 mb-4">
              <strong>Önerilen uygulamalar:</strong> Google Authenticator
              (Android/iOS), 1Password, Authy, Microsoft Authenticator.
            </p>
            <Button
              variant="primary"
              onClick={() => void startEnroll()}
              disabled={loading}
            >
              🔐 2FA&apos;yı Etkinleştir
            </Button>
          </Card>
        )}

        {/* Enroll akışı */}
        {enrollment && (
          <Card padding="p-6">
            <h2 className="text-[18px] font-semibold text-lacivert mb-4">
              2 Adımda Etkinleştir
            </h2>

            <div className="mb-5">
              <div className="text-[11.5px] uppercase tracking-[0.04em] font-semibold text-gri-700 mb-2">
                1. Authenticator app&apos;e ekle
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 items-start">
                <div className="bg-white p-3 rounded-lg ring-1 ring-gri-200">
                  {/* QR code SVG/PNG data-URI */}
                  <img
                    src={enrollment.qrCode}
                    alt="2FA QR code"
                    width={180}
                    height={180}
                    className="block w-full h-auto"
                  />
                </div>
                <div className="text-[12.5px] text-gri-700 leading-relaxed">
                  <p>
                    QR kodu authenticator app ile tarat. Tarama olmuyorsa
                    aşağıdaki anahtarı manuel gir:
                  </p>
                  <div className="bg-gri-50 ring-1 ring-gri-200 rounded-lg p-2 mt-2 font-mono text-[11px] text-lacivert break-all">
                    {enrollment.secret}
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[11.5px] uppercase tracking-[0.04em] font-semibold text-gri-700 mb-2">
                2. App&apos;teki 6 haneli kodu gir
              </div>
              <Input
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="tabular-nums tracking-[0.3em] text-center text-[18px]"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                variant="primary"
                onClick={() => void verifyEnroll()}
                disabled={verifying || code.length !== 6}
              >
                {verifying ? "Doğrulanıyor..." : "Doğrula ve Etkinleştir"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void cancelEnroll()}
                disabled={verifying}
              >
                Vazgeç
              </Button>
            </div>

            <p className="text-[11.5px] text-gri-500 mt-4 leading-relaxed">
              <Icon.Info size={12} className="inline mr-1" />
              Doğrulama tamamlanana kadar 2FA aktif değildir. Vazgeçersen
              hiçbir değişiklik kaydedilmez.
            </p>
          </Card>
        )}

        {/* Footer note */}
        <p className="text-[11.5px] text-gri-500 mt-6 text-center leading-relaxed">
          Login zorlaması henüz aktif değil — şu an 2FA opsiyonel. Sefa
          admin hesaplar için ileride zorunlu kılacak.
        </p>
      </div>
    </main>
  );
}
