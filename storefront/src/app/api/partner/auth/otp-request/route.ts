/**
 * POST /api/partner/auth/otp-request
 *
 * Sefa 23 May v68 (Partner P1):
 * Üretim partneri /partner/giris'te email girer. Bu endpoint:
 *   1) partner_contacts.email kontrolü (case-insensitive)
 *   2) Email yoksa → 404 "partner_not_found" (info leak'i önlemek için
 *      generic mesaj döndürür — "kod gönderildi" gibi)
 *   3) partner_contacts.user_id null ise → auth.users oluştur + link
 *   4) profiles.role = 'partner' ensure
 *   5) Supabase signInWithOtp ile 6 haneli kod gönder
 *
 * Body: { email: string }
 * Response: { ok: true, message: string }
 *
 * Rate limit: Supabase Auth + IP/email throttle (15 dk pencere).
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail } from "@/lib/auth-user-lookup";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const OTP_WINDOW_MS = 15 * 60_000;
const OTP_IP_LIMIT = 10;
const OTP_EMAIL_LIMIT = 5;

const BodySchema = z.object({
  email: z.string().email().max(150),
});

// Güvenlik: hangi durumda olursa olsun aynı mesaj dön (email enumeration
// saldırısını önlemek için). Sadece "geçersiz email format" 400 verir.
const GENERIC_RESPONSE = {
  ok: true,
  message:
    "Email adresiniz partner sistemimize kayıtlıysa 6 haneli giriş kodu gönderildi.",
};

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipRl = await rateLimit({
    key: `partner-otp:ip:${ip ?? "unknown"}`,
    limit: OTP_IP_LIMIT,
    windowMs: OTP_WINDOW_MS,
  });
  if (!ipRl.success) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Çok fazla deneme. Lütfen bir süre sonra tekrar deneyin.",
      },
      { status: 429, headers: { "Retry-After": String(ipRl.retryAfter) } }
    );
  }

  // Body parse
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

  const emailRl = await rateLimit({
    key: `partner-otp:email:${email}`,
    limit: OTP_EMAIL_LIMIT,
    windowMs: OTP_WINDOW_MS,
  });
  if (!emailRl.success) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Çok fazla deneme. Lütfen bir süre sonra tekrar deneyin.",
      },
      { status: 429, headers: { "Retry-After": String(emailRl.retryAfter) } }
    );
  }

  const admin = createAdminClient();

  // 1) partner_contacts'ta email var mı? (case-insensitive, unique index Mig 171)
  const { data: contactRows, error: contactErr } = await admin
    .from("partner_contacts")
    .select("id, partner_id, name, user_id")
    .ilike("email", email);
  if (contactErr) {
    console.error("[partner/otp-request] contact lookup error:", contactErr);
    return NextResponse.json(
      { error: "contact_lookup_failed" },
      { status: 500 }
    );
  }
  type ContactRow = {
    id: string;
    partner_id: string;
    name: string;
    user_id: string | null;
  };
  const contacts = (contactRows as ContactRow[] | null) ?? [];
  if (contacts.length > 1) {
    console.error("[partner/otp-request] duplicate partner emails", {
      email,
      count: contacts.length,
    });
    return NextResponse.json(
      {
        error: "duplicate_partner_email",
        detail:
          "Bu e-posta birden fazla partner kaydına bağlı. Admin ile iletişime geçin.",
      },
      { status: 409 }
    );
  }
  const contact = contacts[0] ?? null;

  if (!contact) {
    // Info leak guard: aynı generic mesajı dön (timing attack için de delay yok)
    return NextResponse.json(GENERIC_RESPONSE);
  }

  // 2) user_id yoksa auth.users lookup → mevcut user var mı?
  //    Sefa 23 May v68 (P1.6 + P1.7):
  //      • listUsers paging hatası → fn_find_auth_user_by_email RPC
  //      • Customer rolündeki email partner'a YÜKSELTİLMEZ — kayıp riski
  let userId = contact.user_id;
  if (!userId) {
    // a) Önce mevcut user var mı? (RPC ile email lookup — paging-free)
    const existingUserId = await findAuthUserIdByEmail(admin, email);

    if (existingUserId) {
      // b) Mevcut user var — profile role kontrol et
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", existingUserId)
        .maybeSingle();
      const existingRole = (existingProfile as { role?: string } | null)?.role;

      // P1.7 guard: customer hesabıyla kayıt → reddet (kayıp engelle)
      if (existingRole === "customer") {
        console.warn("[partner/otp-request] role conflict — customer→partner blocked", { email });
        return NextResponse.json(
          {
            error: "role_conflict",
            detail:
              "Bu email zaten müşteri hesabıyla kayıtlı. Partner hesabı için farklı bir email kullanın veya admin ile iletişime geçin.",
          },
          { status: 409 }
        );
      }
      // admin/staff hesabıyla aynı email — güvenlik riski (privilege escalation)
      if (existingRole === "admin" || existingRole === "staff") {
        console.warn("[partner/otp-request] admin/staff role conflict", {
          email,
          role: existingRole,
        });
        return NextResponse.json(
          { error: "role_conflict_privileged" },
          { status: 409 }
        );
      }

      // Geri kalan: role 'partner' (zaten link kayıp), null (orphan), veya unknown
      // → user_id'yi partner_contacts'a re-link et + role 'partner' ensure
      userId = existingUserId;
    } else {
      // c) Mevcut user yok → yeni oluştur
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          partner_contact_id: contact.id,
          partner_id: contact.partner_id,
          name: contact.name,
        },
      });
      if (createErr || !created?.user) {
        console.error("[partner/otp-request] createUser error:", createErr);
        return NextResponse.json(
          { error: "auth_user_create_failed" },
          { status: 500 }
        );
      }
      userId = created.user.id;
    }

    // partner_contacts.user_id link
    await admin
      .from("partner_contacts")
      .update({ user_id: userId })
      .eq("id", contact.id);
  }

  // 3) profiles.role = 'partner' ensure (upsert)
  //    Sefa 23 May v68 (P1.7): Burada artık sadece 'partner', 'orphan'
  //    veya yeni kullanıcılar var — customer/admin/staff yukarıda
  //    reddedildi. Bu upsert güvenli.
  await admin
    .from("profiles")
    .upsert(
      { id: userId, role: "partner" },
      { onConflict: "id" }
    );

  // 4) Supabase OTP gönder (signInWithOtp — 6 haneli email kodu)
  // shouldCreateUser: false — user zaten oluşturuldu yukarıda.
  const supabase = await createServerClient();
  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  });
  if (otpErr) {
    console.error("[partner/otp-request] signInWithOtp error:", otpErr);
    // Rate limit veya provider sorunu olabilir — generic 503
    return NextResponse.json(
      { error: "otp_send_failed", detail: otpErr.message },
      { status: 503 }
    );
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
