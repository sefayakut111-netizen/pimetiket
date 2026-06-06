import { createHash, randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendMail, isResendConfigured } from "@/lib/mail/resend";

type AdminClient = SupabaseClient<Database>;

const OTP_TTL_MS = 15 * 60_000;

export function hashPartnerEmailOtp(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export function generatePartnerEmailOtp(): string {
  return String(randomInt(100_000, 1_000_000));
}

export async function isPartnerEmailTaken(
  admin: AdminClient,
  email: string,
  excludeContactId?: string
): Promise<boolean> {
  let query = admin
    .from("partner_contacts")
    .select("id")
    .ilike("email", email)
    .limit(1);
  if (excludeContactId) {
    query = query.neq("id", excludeContactId);
  }
  const { data } = await query.maybeSingle();
  return !!data;
}

export async function startPartnerEmailVerification(
  admin: AdminClient,
  contactId: string,
  pendingEmail: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const normalized = pendingEmail.trim().toLowerCase();
  const taken = await isPartnerEmailTaken(admin, normalized, contactId);
  if (taken) {
    return {
      ok: false,
      status: 409,
      error: "Bu e-posta başka bir partner hesabında kayıtlı.",
    };
  }

  const code = generatePartnerEmailOtp();
  const hash = hashPartnerEmailOtp(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { error } = await admin
    .from("partner_contacts")
    .update({
      pending_email: normalized,
      pending_email_otp_hash: hash,
      pending_email_expires_at: expiresAt,
    })
    .eq("id", contactId);

  if (error) {
    console.error("[partner/email-verify] pending update error:", error);
    return { ok: false, status: 500, error: "Doğrulama başlatılamadı" };
  }

  if (isResendConfigured()) {
    try {
      await sendMail({
        to: normalized,
        subject: "Pim Etiket — E-posta doğrulama kodu",
        text: `Partner ayarlarında e-posta değişikliği için doğrulama kodunuz: ${code}\n\nKod 15 dakika geçerlidir.`,
        html: `<p>Partner ayarlarında e-posta değişikliği için doğrulama kodunuz:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>Kod 15 dakika geçerlidir.</p>`,
      });
    } catch (mailErr) {
      console.error("[partner/email-verify] sendMail error:", mailErr);
      return { ok: false, status: 503, error: "Doğrulama kodu gönderilemedi" };
    }
  } else {
    console.warn(
      "[partner/email-verify] RESEND not configured — OTP for dev:",
      code
    );
  }

  return { ok: true };
}

export async function confirmPartnerEmailVerification(
  admin: AdminClient,
  contactId: string,
  code: string
): Promise<{ ok: true; email: string } | { ok: false; error: string; status: number }> {
  const { data: row, error } = await admin
    .from("partner_contacts")
    .select(
      "id, email, pending_email, pending_email_otp_hash, pending_email_expires_at, user_id"
    )
    .eq("id", contactId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, status: 404, error: "Kontak bulunamadı" };
  }

  type ContactRow = {
    id: string;
    email: string;
    pending_email: string | null;
    pending_email_otp_hash: string | null;
    pending_email_expires_at: string | null;
    user_id: string | null;
  };
  const contact = row as ContactRow;

  if (!contact.pending_email || !contact.pending_email_otp_hash) {
    return { ok: false, status: 400, error: "Bekleyen e-posta değişikliği yok" };
  }

  const expires = contact.pending_email_expires_at
    ? new Date(contact.pending_email_expires_at).getTime()
    : 0;
  if (!expires || Date.now() > expires) {
    return { ok: false, status: 410, error: "Doğrulama kodu süresi doldu" };
  }

  const hash = hashPartnerEmailOtp(code);
  if (hash !== contact.pending_email_otp_hash) {
    return { ok: false, status: 400, error: "Doğrulama kodu hatalı" };
  }

  const newEmail = contact.pending_email;
  const taken = await isPartnerEmailTaken(admin, newEmail, contactId);
  if (taken) {
    return {
      ok: false,
      status: 409,
      error: "Bu e-posta başka bir partner hesabında kayıtlı.",
    };
  }

  const { error: updErr } = await admin
    .from("partner_contacts")
    .update({
      email: newEmail,
      pending_email: null,
      pending_email_otp_hash: null,
      pending_email_expires_at: null,
    })
    .eq("id", contactId);

  if (updErr) {
    console.error("[partner/email-verify] confirm update error:", updErr);
    return { ok: false, status: 500, error: "E-posta güncellenemedi" };
  }

  if (contact.user_id) {
    const { error: authErr } = await admin.auth.admin.updateUserById(
      contact.user_id,
      { email: newEmail }
    );
    if (authErr) {
      console.error("[partner/email-verify] auth email update error:", authErr);
    }
  }

  return { ok: true, email: newEmail };
}
