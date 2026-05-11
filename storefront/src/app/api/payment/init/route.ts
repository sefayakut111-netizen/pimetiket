/**
 * POST /api/payment/init
 *
 * Müşteri /odeme'de "Güvenli ödemeye geç" tıkladığında çağrılır.
 *
 * Akış:
 *   1. Auth kontrolü (login zorunlu)
 *   2. Body validation (cart + address + invoice + totals)
 *   3. Server-side recalc (subtotal/total tutarsızlık kontrolü)
 *   4. Tüm tutar kart üzerinden (cüzdan kaldırıldı — Migration 015)
 *   5. PayTR get-token → token + iframe URL
 *   6. payment_intents tablosuna snapshot kaydet
 *   7. JSON: { paymentPageUrl, merchantOid }
 *
 * PayTR iyzico'dan farkı:
 *   - merchantOid alfanumerik max 64 char (UUID dash'leri kaldırılır)
 *   - Sepet base64 JSON, format: [["başlık", "199.99", 1], ...]
 *   - Tutar kuruş cinsinden (199.99 → 19999)
 *   - HMAC-SHA256 imza
 *   - Callback POST'a "OK" string yanıtı zorunlu
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createCheckoutToken,
  buildBasket,
  isPayTrConfigured,
} from "@/lib/payment/paytr";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// Validation
// ============================================================

const CartItemSchema = z.object({
  id: z.string(),
  product: z.enum(["sticker", "etiket"]),
  title: z.string().min(1),
  config: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  qty: z.number().int().positive(),
  unit: z.number().nonnegative(),
  total: z.number().nonnegative(),
  meta: z.record(z.string(), z.unknown()).optional(),
  designTempId: z.string().uuid().optional(),
  designPreviewUrl: z.string().optional(),
  designFileName: z.string().optional(),
  shape: z.string().optional(),
  cut: z.string().optional(),
  softCorners: z.boolean().optional(),
  material: z.string().optional(),
  finish: z.string().optional(),
  hediyeAdet: z.number().optional(),
  materialId: z.string().optional(),
  coatingId: z.string().optional(),
  customizationId: z.string().optional(),
  winding: z.number().optional(),
});

const AddressSchema = z.object({
  label: z.string().nullable().optional(),
  name: z.string().min(1),
  addr: z.string().min(1),
  city: z.string().min(1),
  phone: z.string().min(1),
});

const InvoiceSchema = z.object({
  type: z.enum(["individual", "corporate"]),
  tc: z.string().optional(),
  vkn: z.string().optional(),
  companyName: z.string().optional(),
  taxOffice: z.string().optional(),
});

const InitBodySchema = z.object({
  items: z.array(CartItemSchema).min(1),
  address: AddressSchema,
  invoice: InvoiceSchema,
  subtotal: z.number().nonnegative(),
  shipping: z.number().nonnegative(),
  total: z.number().positive(),
  couponCode: z.string().optional(),
});

// ============================================================
// Helpers
// ============================================================

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri;
  return "127.0.0.1";
}

/**
 * PayTR merchant_oid formatı: alfanumerik, max 64 char.
 * UUID v4 dash'leri kaldırıp 32 char hex döner.
 */
function generateMerchantOid(): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}${Math.random()}`;
  // PE prefix + UUID hex (dash'siz). Total ~34 char, PayTR limit 64.
  return `PE${uuid.replace(/-/g, "")}`;
}

// ============================================================
// Handler
// ============================================================

export async function POST(req: NextRequest) {
  // 1) PayTR yapılandırılmış mı?
  if (!isPayTrConfigured()) {
    return NextResponse.json(
      { error: "payment_provider_not_configured" },
      { status: 503 }
    );
  }

  // 2) Auth check
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 3) Body validate
  let body: z.infer<typeof InitBodySchema>;
  try {
    const json = await req.json();
    body = InitBodySchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid_body",
        detail: err instanceof Error ? err.message : "validation_failed",
      },
      { status: 400 }
    );
  }

  // 4) Server-side recalc
  const calcSubtotal = body.items.reduce((s, i) => s + i.total, 0);
  if (Math.abs(calcSubtotal - body.subtotal) > 0.5) {
    return NextResponse.json(
      { error: "subtotal_mismatch", expected: calcSubtotal },
      { status: 400 }
    );
  }
  const calcTotal = body.subtotal + body.shipping;
  if (Math.abs(calcTotal - body.total) > 0.5) {
    return NextResponse.json(
      { error: "total_mismatch", expected: calcTotal },
      { status: 400 }
    );
  }

  // 5) Tüm tutar kart ile (cüzdan kaldırıldı — Migration 015)
  const cardAmount = body.total;

  if (cardAmount < 1) {
    return NextResponse.json(
      { error: "amount_too_low" },
      { status: 400 }
    );
  }

  // 6) PayTR sepeti
  const cardItems = body.items.map((i) => ({
    title: i.title,
    qty: i.qty,
    total: i.total,
  }));

  const basket = buildBasket(cardItems);

  // 7) merchantOid + URL'ler
  const merchantOid = generateMerchantOid();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // 8) PayTR get-token
  const result = await createCheckoutToken({
    merchantOid,
    email: user.email ?? "no-reply@pimetiket.com",
    amountTL: cardAmount,
    basket,
    userIp: getClientIp(req),
    userName: body.address.name,
    userAddress: body.address.addr.slice(0, 400),
    userPhone: body.address.phone,
    okUrl: `${siteUrl}/api/payment/callback?return=ok&oid=${merchantOid}`,
    failUrl: `${siteUrl}/api/payment/callback?return=fail&oid=${merchantOid}`,
    timeoutLimit: 30,
    currency: "TL",
    maxInstallment: 12,
    noInstallment: 0,
  });

  if (!result.ok) {
    console.error("[payment/init] PayTR token failed:", result.reason);
    return NextResponse.json(
      {
        error: "paytr_token_failed",
        reason: result.reason,
        code: result.errCode,
      },
      { status: 502 }
    );
  }

  // 9) payment_intents snapshot
  const admin = createAdminClient();
  const snapshot = {
    items: body.items,
    address: body.address,
    invoice: body.invoice,
    subtotal: body.subtotal,
    shipping: body.shipping,
    total: body.total,
    couponCode: body.couponCode ?? null,
  };
  const { error: insertErr } = await admin.from("payment_intents").insert([
    {
      id: merchantOid,
      user_id: user.id,
      iyzico_token: result.token, // legacy alan adı, PayTR token saklıyoruz
      card_amount: cardAmount,
      wallet_amount: 0, // legacy column (Migration 015 sonrası kullanılmıyor)
      snapshot,
    },
  ] as never);

  if (insertErr) {
    console.error("[payment/init] intent insert error:", insertErr);
    return NextResponse.json(
      { error: "intent_save_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    paymentPageUrl: result.iframeUrl,
    token: result.token,
    merchantOid,
  });
}
