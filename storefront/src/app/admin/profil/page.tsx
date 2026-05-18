/**
 * Pim Etiket — /admin/profil
 *
 * Sefa 18 May v68 (admin UX denetim — KVKK m.12):
 * Admin hesap yönetimi + güvenlik. Şu an /admin/profile, /admin/hesap,
 * /admin/security 404 dönüyordu. Tek sayfa altında:
 *
 *   - Email + display name görüntüleme
 *   - Şifre değiştirme (Supabase updateUser)
 *   - 2FA (TOTP) enrollment + disenrollment (Supabase MFA)
 *   - Aktif oturumlar listesi + kapatma
 *   - Hesap audit log linki
 *
 * KVKK m.12: "Veri sorumlusu uygun güvenlik düzeyini sağlamak amacıyla
 * her türlü teknik ve idari tedbiri almak zorundadır."
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Eyebrow, Input, Button, useToast, Skeleton } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";

interface ProfileInfo {
  id: string;
  email: string;
  displayName: string | null;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  mfaEnabled: boolean;
  mfaFactors: Array<{ id: string; type: string; createdAt: string }>;
}

export default function AdminProfilPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // MFA enrollment
  const [mfaEnrolling, setMfaEnrolling] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState("");
  const [mfaVerifying, setMfaVerifying] = useState(false);

  async function loadProfile() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // MFA factors
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const totpFactors = factorsData?.totp ?? [];

    // Display name (profiles tablosundan)
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    setProfile({
      id: user.id,
      email: user.email ?? "",
      displayName: (prof as { display_name?: string | null } | null)?.display_name ?? null,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      mfaEnabled: totpFactors.length > 0,
      mfaFactors: totpFactors.map((f) => ({
        id: f.id,
        type: f.factor_type,
        createdAt: f.created_at,
      })),
    });
    setLoading(false);
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Şifre en az 8 karakter olmalı");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Şifre eşleşmiyor");
      return;
    }
    setPasswordSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Şifre güncellendi");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function handleMfaEnroll() {
    setMfaEnrolling(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Pim Etiket Admin TOTP",
      });
      if (error || !data) {
        toast.error(error?.message ?? "MFA enrollment başarısız");
        return;
      }
      setMfaQrCode(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
      setMfaFactorId(data.id);
    } finally {
      setMfaEnrolling(false);
    }
  }

  async function handleMfaVerify() {
    if (!mfaFactorId || mfaVerifyCode.length !== 6) {
      toast.error("6 haneli kod girmen gerek");
      return;
    }
    setMfaVerifying(true);
    try {
      const supabase = createClient();
      // Challenge yaratıp doğrula
      const { data: challengeData, error: chErr } =
        await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (chErr || !challengeData) {
        toast.error(chErr?.message ?? "Challenge başarısız");
        return;
      }
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaVerifyCode,
      });
      if (verifyErr) {
        toast.error(verifyErr.message);
        return;
      }
      toast.success("2FA aktif edildi 🎉");
      setMfaQrCode(null);
      setMfaSecret(null);
      setMfaFactorId(null);
      setMfaVerifyCode("");
      await loadProfile();
    } finally {
      setMfaVerifying(false);
    }
  }

  async function handleMfaUnenroll(factorId: string) {
    if (!confirm("2FA'yı kaldırmak istediğine emin misin? Güvenlik düşer.")) {
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("2FA kaldırıldı");
    await loadProfile();
  }

  async function handleSignOutAllOther() {
    if (
      !confirm(
        "Diğer cihazlardaki tüm oturumları kapatmak istediğine emin misin? Bu cihaz hariç tüm girişler sonlandırılır."
      )
    ) {
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Diğer oturumlar kapatıldı");
  }

  function formatDateTime(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-[900px] px-4 py-6 md:px-6">
        <Skeleton className="h-48 w-full" />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-[900px] px-4 py-6 md:px-6">
        <Card padding="p-6">
          <p>Oturum bulunamadı. Yeniden giriş yap.</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[900px] px-4 py-6 md:px-6">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-[13px] text-gri-700 hover:text-pim-mercan"
      >
        ← Dashboard'a dön
      </Link>

      <div className="mb-6">
        <Eyebrow>Hesap & Güvenlik</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-lacivert md:text-3xl">
          Profilim
        </h1>
        <p className="mt-1 text-sm text-gri-700">
          KVKK m.12 — uygun güvenlik düzeyi için 2FA mutlaka aktif olmalı.
        </p>
      </div>

      {/* Genel bilgi */}
      <Card padding="p-5" className="mb-4">
        <h2 className="text-lg font-semibold mb-4">Genel</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
          <div>
            <div className="text-[11px] text-gri-700 mb-0.5">E-posta</div>
            <div className="font-medium text-lacivert">{profile.email}</div>
          </div>
          <div>
            <div className="text-[11px] text-gri-700 mb-0.5">Ad</div>
            <div className="font-medium text-lacivert">
              {profile.displayName ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-gri-700 mb-0.5">
              E-posta onayı
            </div>
            <div className="font-medium">
              {profile.emailConfirmedAt ? (
                <span className="text-yesil-koyu">
                  ✓ {formatDateTime(profile.emailConfirmedAt)}
                </span>
              ) : (
                <span className="text-kirmizi-koyu">⚠️ Onaysız</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-gri-700 mb-0.5">Son giriş</div>
            <div className="font-medium text-lacivert">
              {formatDateTime(profile.lastSignInAt)}
            </div>
          </div>
        </div>
      </Card>

      {/* 2FA */}
      <Card padding="p-5" className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">İki adımlı doğrulama (2FA)</h2>
          {profile.mfaEnabled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-yesil-soft px-2 py-0.5 text-[11.5px] font-semibold text-yesil-koyu">
              ✓ Aktif
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-kirmizi-soft px-2 py-0.5 text-[11.5px] font-semibold text-kirmizi-koyu">
              ⚠️ Devre dışı
            </span>
          )}
        </div>
        <p className="text-[12.5px] text-gri-700 mb-4 leading-relaxed">
          Authenticator uygulaması (Google Authenticator, Authy, 1Password)
          ile 6 haneli kod üretirsin, giriş yaparken şifreden sonra istenir.
          Phishing veya şifre sızması olsa bile hesabın korunur.
        </p>

        {profile.mfaEnabled ? (
          <div className="space-y-2">
            {profile.mfaFactors.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg bg-gri-50 p-3"
              >
                <div>
                  <div className="text-[13px] font-semibold text-lacivert">
                    {f.type.toUpperCase()} cihazı
                  </div>
                  <div className="text-[11.5px] text-gri-500">
                    Eklendi: {formatDateTime(f.createdAt)}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleMfaUnenroll(f.id)}
                >
                  Kaldır
                </Button>
              </div>
            ))}
          </div>
        ) : !mfaQrCode ? (
          <Button variant="primary" onClick={handleMfaEnroll} disabled={mfaEnrolling}>
            {mfaEnrolling ? "Hazırlanıyor..." : "🔒 2FA'yı şimdi kur"}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-mavi-soft p-4 text-[12.5px] text-mavi-koyu">
              <strong>Adım 1:</strong> Authenticator uygulamana QR'ı okut veya
              gizli anahtarı manuel ekle.
            </div>
            <div className="flex flex-col md:flex-row gap-4 items-start">
              <div
                className="rounded-lg ring-1 ring-gri-200 p-3 bg-white"
                dangerouslySetInnerHTML={{ __html: mfaQrCode }}
              />
              <div className="flex-1 text-[12.5px]">
                <div className="text-gri-700 mb-1">Manuel anahtar:</div>
                <code className="block bg-gri-100 px-2 py-1 rounded font-mono text-[11.5px] break-all">
                  {mfaSecret}
                </code>
              </div>
            </div>
            <div className="rounded-lg bg-mavi-soft p-4 text-[12.5px] text-mavi-koyu">
              <strong>Adım 2:</strong> Uygulamadan görünen 6 haneli kodu gir.
            </div>
            <div className="flex gap-2">
              <Input
                value={mfaVerifyCode}
                onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                className="w-32 font-mono text-center text-lg"
              />
              <Button
                variant="primary"
                onClick={handleMfaVerify}
                disabled={mfaVerifying || mfaVerifyCode.length !== 6}
              >
                {mfaVerifying ? "Doğrulanıyor..." : "Doğrula + Aktif et"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Şifre */}
      <Card padding="p-5" className="mb-4">
        <h2 className="text-lg font-semibold mb-3">Şifre değiştir</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3 max-w-md">
          <div>
            <label className="text-[12.5px] font-medium text-lacivert mb-1 block">
              Yeni şifre (en az 8 karakter)
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <div>
            <label className="text-[12.5px] font-medium text-lacivert mb-1 block">
              Yeni şifre tekrar
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={passwordSubmitting || newPassword.length < 8}
          >
            {passwordSubmitting ? "Güncelleniyor..." : "Şifreyi güncelle"}
          </Button>
        </form>
      </Card>

      {/* Aktif oturumlar */}
      <Card padding="p-5" className="mb-4">
        <h2 className="text-lg font-semibold mb-3">Aktif oturumlar</h2>
        <p className="text-[12.5px] text-gri-700 mb-3 leading-relaxed">
          Şifren sızdıysa veya unutulmuş bir cihaz varsa, bu cihaz hariç tüm
          oturumları kapat. Bir sonraki girişte tekrar şifre + 2FA istenir.
        </p>
        <Button variant="secondary" onClick={handleSignOutAllOther}>
          🚪 Diğer cihazlardaki oturumları kapat
        </Button>
      </Card>

      {/* Audit link */}
      <Card padding="p-5">
        <h2 className="text-lg font-semibold mb-2">Audit log</h2>
        <p className="text-[12.5px] text-gri-700 mb-3">
          Hesabınla ilgili tüm önemli aksiyonlar (giriş, ayarlar değiştirme,
          KVKK işlemleri) /admin/audit-log'da kayıtlı.
        </p>
        <Link
          href="/admin/audit-log"
          className="inline-flex items-center gap-1 text-pim-mercan font-semibold text-[13px] hover:underline"
        >
          Denetim kaydına git <Icon.ArrowR size={14} />
        </Link>
      </Card>
    </main>
  );
}
