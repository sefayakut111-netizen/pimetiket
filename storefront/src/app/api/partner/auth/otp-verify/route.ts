/**
 * POST /api/partner/auth/otp-verify
 *
 * Sefa 23 May v68 (Partner P1):
 * Partner /partner/giris'te 6 haneli kodu girer. Bu endpoint:
 *   1) supabase.auth.verifyOtp ile kodu doğrular
 *   2) Session başlar (cookie set — Supabase SSR cookie wrapper)
 *   3) profiles.role kontrolü — sadece 'partner' bu endpoint'i kullanabilir
 *      (admin/staff/customer için ayrı /auth flow var)
 *   4) partner_contacts.last_login_at update
 *   5) Response: { ok: true, redirect: '/partner' }
 *
 * Body: { email: string, token: string (6 hane) }
 *
 * Güvenlik:
 *   - Yanlış kod denemesi → Supabase tarafında sayılır (auto-lock 5 hatadan sonra)
 *   - Kod 60sn geçerli (Supabase default — env'den ayarlanır)
 *   - Customer/admin email'i verifyOtp ile giriş yapabilir AMA aşağıdaki role
 *     check 'partner' değilse session'ı siler ve 403 döner.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: z.string().email().max(150),
  token: z
    .string()
    .regex(/^\d{6}$/, "6 haneli sayısal kod olmalı"),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", detail: parsed.error.issues },
      { status: 400 }
    );
  }
  const email = parsed.data.email.trim().toLowerCase();
  const { token } = parsed.data;

  const supabase = await createServerClient();

  // 1) OTP doğrula — başarılıysa Supabase cookie set eder
  const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (verifyErr || !verifyData?.user) {
    return NextResponse.json(
      {
        error: "otp_invalid",
        message:
          verifyErr?.message?.includes("expired") ||
          verifyErr?.message?.includes("Token has expired")
            ? "Kodun süresi doldu — yeni kod isteyin"
            : "Kod yanlış veya geçersiz",
      },
      { status: 401 }
    );
  }
  const user = verifyData.user;

  // 2) profiles.role partner mı?
  const admin = createAdminClient();
  const { data: profileRow } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profileRow as { role?: string } | null)?.role;

  if (role !== "partner") {
    // Bu endpoint sadece partnerler için. Customer/admin yanlışlıkla buraya
    // gelirse session'ı sil ve 403 dön.
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        error: "not_a_partner",
        message:
          "Bu giriş ekranı sadece üretim partnerlerimiz için. Müşteri hesabıyla giriş yapmak için ana giriş sayfasını kullanın.",
      },
      { status: 403 }
    );
  }

  // 3) partner_contacts.last_login_at update + contact bilgisini al
  const { data: contactRow } = await admin
    .from("partner_contacts")
    .select("id, partner_id, name")
    .eq("user_id", user.id)
    .maybeSingle();
  const contact = contactRow as {
    id: string;
    partner_id: string;
    name: string;
  } | null;

  if (contact) {
    await admin
      .from("partner_contacts")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", contact.id);
  }

  return NextResponse.json({
    ok: true,
    redirect: "/partner",
    partner: contact
      ? { id: contact.partner_id, name: contact.name }
      : null,
  });
}
