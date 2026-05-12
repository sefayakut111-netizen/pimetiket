/**
 * POST /api/lead/subscribe
 *
 * Email signup endpoint — lead magnet "Ücretsiz Şablonlar" sayfası
 * + Footer bülten formu + sipariş sonrası signup (gelecek).
 *
 * Body: { email, source, interests?: string[] }
 *
 * Davranış:
 *   - Aynı email zaten kayıtlıysa: 200 OK + already_subscribed flag
 *   - Yeni email ise: INSERT + welcome maili sırasına ekle (Resend gelince)
 *   - Rate-limit: IP başına dakikada 5 (spam protection)
 *   - KVKK m.10: consent_at + IP + UA kaydedilir
 *
 * Response:
 *   { ok: true, alreadySubscribed: boolean, downloadUrl?: string }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { enqueueMail } from "@/lib/mail/enqueue";

const SubscribeSchema = z.object({
  email: z
    .string()
    .email("Geçersiz e-posta")
    .max(254)
    .transform((s) => s.trim().toLowerCase()),
  source: z
    .enum([
      "sablonlar",
      "newsletter",
      "order_complete",
      "gated_download",
    ])
    .default("sablonlar"),
  interests: z.array(z.string().max(60)).max(20).optional().default([]),
});

/** Şablon ZIP'i — Sefa şablonları storage'a yükleyince burası güncellenir */
const TEMPLATE_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_TEMPLATE_DOWNLOAD_URL ?? null;

export async function POST(req: Request) {
  // Rate limit — spam mail signup'a karşı IP başına dakikada 5
  const ip = getClientIp(req);
  const limit = await rateLimit({
    key: `lead:ip:${ip}`,
    limit: 5,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        detail: "Çok fazla deneme. Bir dakika sonra tekrar dene.",
      },
      {
        status: 429,
        headers: { "retry-after": String(limit.retryAfter) },
      }
    );
  }

  // Body validate
  let body: z.infer<typeof SubscribeSchema>;
  try {
    const json = await req.json();
    body = SubscribeSchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid_body",
        detail: err instanceof Error ? err.message : "validation_failed",
      },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const ua = req.headers.get("user-agent") ?? null;

  // Mevcut kayıt var mı? (aktif — deleted_at IS NULL)
  const { data: existing } = await admin
    .from("email_subscribers")
    .select("id, subscribed, source")
    .eq("email", body.email)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    const ex = existing as unknown as {
      id: string;
      subscribed: boolean;
      source: string;
    };
    // Zaten kayıtlı — yeniden subscribe ettiyse aktifleştir, interests
    // güncellense de override edebiliriz
    if (!ex.subscribed) {
      await admin
        .from("email_subscribers")
        .update({
          subscribed: true,
          unsubscribed_at: null,
        } as never)
        .eq("id", ex.id);
    }
    return NextResponse.json({
      ok: true,
      alreadySubscribed: true,
      downloadUrl: TEMPLATE_DOWNLOAD_URL,
    });
  }

  // Yeni kayıt
  const { data: inserted, error } = await admin
    .from("email_subscribers")
    .insert([
      {
        email: body.email,
        source: body.source,
        interests: body.interests,
        consent_at: new Date().toISOString(),
        consent_ip: ip !== "unknown" ? ip : null,
        consent_ua: ua,
      },
    ] as never)
    .select("id")
    .single();

  if (error) {
    // Race condition: aynı anda başka istek INSERT'ladıysa unique violation
    if (error.code === "23505") {
      return NextResponse.json({
        ok: true,
        alreadySubscribed: true,
        downloadUrl: TEMPLATE_DOWNLOAD_URL,
      });
    }
    console.error("[lead/subscribe] insert error:", error);
    return NextResponse.json(
      { error: "db_insert_failed", detail: error.message },
      { status: 500 }
    );
  }

  // Welcome maili kuyruğa düşür — Resend gelince otomatik gönderilir
  const insertedRow = inserted as unknown as { id: string } | null;
  await enqueueMail({
    templateKey: "lead_welcome",
    to: body.email,
    payload: {
      download_url: TEMPLATE_DOWNLOAD_URL ?? "",
      interests: body.interests,
    },
    category: "lead",
    targetType: "subscriber",
    targetId: insertedRow?.id,
  });

  return NextResponse.json({
    ok: true,
    alreadySubscribed: false,
    downloadUrl: TEMPLATE_DOWNLOAD_URL,
  });
}
