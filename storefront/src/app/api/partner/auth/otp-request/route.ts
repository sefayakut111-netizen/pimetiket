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
 * Rate limit: Supabase Auth tarafında (email_rate_limit_per_hour env).
 * Ek rate limit gerekirse partner_otp_attempts tablo eklenebilir (Faz 2).
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export const runtime = "nodejs";

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

  const admin = createAdminClient();

  // 1) partner_contacts'ta email var mı? (case-insensitive)
  const { data: contactRow } = await admin
    .from("partner_contacts")
    .select("id, partner_id, name, user_id")
    .ilike("email", email)
    .maybeSingle();
  type ContactRow = {
    id: string;
    partner_id: string;
    name: string;
    user_id: string | null;
  };
  const contact = contactRow as ContactRow | null;

  if (!contact) {
    // Info leak guard: aynı generic mesajı dön (timing attack için de delay yok)
    return NextResponse.json(GENERIC_RESPONSE);
  }

  // 2) user_id yoksa auth.users oluştur + link
  let userId = contact.user_id;
  if (!userId) {
    // createUser email_confirm: true → email doğrulanmış sayılır (OTP zaten yapacak)
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
      // Email zaten auth.users'ta varsa (önceden customer olarak kayıt olmuş)
      // → o user'ı bul, partner_contacts'a link et (re-use)
      if (createErr?.message?.toLowerCase().includes("already")) {
        const { data: list } = await admin.auth.admin.listUsers();
        const existing = list?.users?.find(
          (u) => u.email?.toLowerCase() === email
        );
        if (existing) {
          userId = existing.id;
        } else {
          console.error(
            "[partner/otp-request] createUser already-exists ama listUsers'ta yok:",
            email
          );
          return NextResponse.json(
            { error: "auth_user_link_failed" },
            { status: 500 }
          );
        }
      } else {
        console.error("[partner/otp-request] createUser error:", createErr);
        return NextResponse.json(
          { error: "auth_user_create_failed", detail: createErr?.message },
          { status: 500 }
        );
      }
    } else {
      userId = created.user.id;
    }

    // partner_contacts.user_id update
    await admin
      .from("partner_contacts")
      .update({ user_id: userId } as never)
      .eq("id", contact.id);
  }

  // 3) profiles.role = 'partner' ensure (upsert)
  // Bir kullanıcı önceden 'customer' olarak kayıtsa, partner olarak login
  // olduğunda role 'partner'a yükselsin. Geri dönüş ihtiyacı olursa admin
  // /admin/musteriler'den geri çevirir.
  await admin
    .from("profiles")
    .upsert(
      { id: userId, role: "partner" } as never,
      { onConflict: "id" } as never
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
