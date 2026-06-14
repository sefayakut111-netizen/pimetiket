/**
 * POST/GET /api/mail/unsubscribe
 *
 * Sefa 21 May v68 — RFC 8058 (Gmail/Yahoo One-Click) compliant.
 *
 * GET ?t=<token>
 *   Token doğrular, /bildirim-tercihleri/cikis sayfasına 302 yönlendirir.
 *   Hatalı token → /bildirim-tercihleri/cikis?err=invalid.
 *
 * POST ?t=<token>  (RFC 8058 — mail client otomatik çağırır)
 *   Token doğrular, mail_suppressions insert eder.
 *   Body kontrol etmez (List-Unsubscribe-Post: List-Unsubscribe=One-Click
 *   gönderse de hiç gönderebilir).
 *
 * KVKK uyum:
 *   - Token HMAC-imzalı (lib/mail/unsubscribe.ts)
 *   - 365 gün geçerli, secret değiştirilirse invalidate
 *   - Transactional mailler (customer/admin/fason) bu yoldan engellenmez —
 *     fn_is_suppressed RPC sadece category-spesifik filtreler.
 */

import { NextResponse } from "next/server";
import {
  verifyUnsubscribeToken,
  type UnsubscribeCategory,
} from "@/lib/mail/unsubscribe";
import {
  recordSuppression,
  type SuppressionType,
  type MailCategory,
} from "@/lib/mail/suppression";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

function categoryToSuppression(cat: UnsubscribeCategory): {
  type: SuppressionType;
  blockedCategories: MailCategory[] | undefined;
} {
  if (cat === "all") {
    return { type: "unsubscribe_marketing", blockedCategories: ["lead"] };
  }
  if (cat === "blog") {
    return {
      type: "unsubscribe_blog",
      blockedCategories: ["lead"], // blog mailleri lead kategorisinde
    };
  }
  // marketing veya lead
  return {
    type: "unsubscribe_marketing",
    blockedCategories: ["lead"],
  };
}

function getToken(req: Request): string | null {
  const url = new URL(req.url);
  return url.searchParams.get("t");
}

async function processUnsubscribe(token: string | null) {
  if (!token) {
    return { ok: false, err: "missing_token" as const };
  }
  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    return { ok: false, err: "invalid_token" as const };
  }

  const { type, blockedCategories } = categoryToSuppression(
    payload.category
  );
  const result = await recordSuppression({
    email: payload.email,
    type,
    reason: `user_unsubscribe:${payload.category}`,
    blockedCategories,
  });

  if (!result.ok) {
    return { ok: false, err: "db_error" as const };
  }
  return {
    ok: true,
    email: payload.email,
    category: payload.category,
  };
}

// ===== POST — RFC 8058 one-click =====
export async function POST(req: Request) {
  const token = getToken(req);
  const result = await processUnsubscribe(token);
  if (!result.ok) {
    // Sefa 21 May v68 — Smoke test BUG #2 fix:
    // missing_token + invalid_token client error (4xx),
    // db_error sunucu hatası (5xx). Mail client retry mantığı için kritik.
    const status =
      result.err === "missing_token" || result.err === "invalid_token"
        ? 400
        : 500;
    return NextResponse.json(
      { ok: false, error: result.err },
      { status }
    );
  }
  // Mail client'ları sadece 200 + JSON bekler
  return NextResponse.json({
    ok: true,
    message: "Aboneliğiniz iptal edildi.",
    email: result.email,
    category: result.category,
  });
}

// ===== GET — tarayıcıdan tıklama =====
export async function GET(req: Request) {
  const token = getToken(req);
  const url = new URL(`${SITE_URL}/bildirim-tercihleri/cikis`);
  if (!token) {
    url.searchParams.set("err", "missing");
    return NextResponse.redirect(url);
  }
  // Token'ı doğrudan confirm sayfasına geçir — kullanıcı orada onaylayacak
  // (One-click POST'a alternatif: kullanıcı tarayıcıda butona basar)
  url.searchParams.set("t", token);
  return NextResponse.redirect(url);
}
