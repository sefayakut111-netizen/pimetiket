import type { SupabaseClient } from "@supabase/supabase-js";

export interface StepUpCredentials {
  password?: string;
  totpCode?: string;
}

export type StepUpResult =
  | { ok: true; method: "password" | "totp" }
  | { ok: false; message: string; status: number; requiresTotp?: boolean };

/**
 * Geri dönüşsüz KVKK silme talebi öncesi step-up doğrulama.
 * MFA aktifse TOTP, değilse şifre zorunlu.
 */
export async function verifyStepUpAuth(
  supabase: SupabaseClient,
  userEmail: string | undefined,
  credentials: StepUpCredentials
): Promise<StepUpResult> {
  if (!userEmail?.trim()) {
    return { ok: false, message: "Oturum doğrulanamadı", status: 401 };
  }

  const { data: factorsData, error: factorsErr } =
    await supabase.auth.mfa.listFactors();
  if (factorsErr) {
    console.error("[step-up-auth] listFactors:", factorsErr);
    return {
      ok: false,
      message: "Güvenlik doğrulaması başlatılamadı",
      status: 500,
    };
  }

  const verifiedTotp = (factorsData?.totp ?? []).find(
    (f) => f.status === "verified"
  );

  if (verifiedTotp) {
    const code = credentials.totpCode?.trim();
    if (!code) {
      return {
        ok: false,
        message: "Güvenlik için doğrulama kodunu gir",
        status: 403,
        requiresTotp: true,
      };
    }

    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: verifiedTotp.id,
    });
    if (chErr || !challenge) {
      console.error("[step-up-auth] mfa.challenge:", chErr);
      return {
        ok: false,
        message: "Doğrulama kodu kontrol edilemedi",
        status: 500,
      };
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: verifiedTotp.id,
      challengeId: challenge.id,
      code,
    });
    if (verifyErr) {
      return {
        ok: false,
        message: "Doğrulama kodu hatalı",
        status: 403,
        requiresTotp: true,
      };
    }

    return { ok: true, method: "totp" };
  }

  const password = credentials.password?.trim();
  if (!password) {
    return {
      ok: false,
      message: "Güvenlik için şifreni gir",
      status: 403,
    };
  }

  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: userEmail,
    password,
  });
  if (signInErr) {
    return { ok: false, message: "Şifre hatalı", status: 403 };
  }

  return { ok: true, method: "password" };
}
