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
import { validateCartPricing } from "@/lib/payment-validation";
import type { Json, TablesInsert } from "@/lib/supabase/types";

// ============================================================
// Validation
// ============================================================

// Sefa 21 May v68 — Tüm optional string field'larında `.nullish()` kullanılır.
// Sebep: Cart item'da bir ürün tipi için irrelevant alan `null` olarak gelir
// (örn. etiket ürününde shape/cut/material/finish = null). Zod'da `.optional()`
// sadece `T | undefined` kabul eder, `null` reddeder → 400 invalid_body.
// `.nullish()` = `T | null | undefined` → defansif, üretici-tarafı kırılmaz.
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
  meta: z.record(z.string(), z.unknown()).nullish(),
  designTempId: z.string().uuid().nullish(),
  designPreviewUrl: z.string().nullish(),
  designFileName: z.string().nullish(),
  shape: z.string().nullish(),
  cut: z.string().nullish(),
  softCorners: z.boolean().nullish(),
  material: z.string().nullish(),
  finish: z.string().nullish(),
  hediyeAdet: z.number().nullish(),
  materialId: z.string().nullish(),
  coatingId: z.string().nullish(),
  customizationId: z.string().nullish(),
  winding: z.number().nullish(),
});

const AddressSchema = z.object({
  label: z.string().nullish(),
  name: z.string().min(1),
  addr: z.string().min(1),
  city: z.string().min(1),
  phone: z.string().min(1),
});

const InvoiceSchema = z.object({
  type: z.enum(["individual", "corporate"]),
  tc: z.string().nullish(),
  vkn: z.string().nullish(),
  companyName: z.string().nullish(),
  taxOffice: z.string().nullish(),
});

const InitBodySchema = z.object({
  items: z.array(CartItemSchema).min(1),
  address: AddressSchema,
  invoice: InvoiceSchema,
  subtotal: z.number().nonnegative(),
  shipping: z.number().nonnegative(),
  total: z.number().positive(),
  couponCode: z.string().nullish(),
  // FSEK m.66 telif ihlali davası ispatı için zorunlu (Sefa kuralı 12 May).
  // Müşteri /odeme'deki "tasarımım telif sahibim ben" checkbox'ını
  // işaretlemeden submit edemez (client-side guard). Server-side burada
  // mecburi olarak kontrol edilir + IP + zaman damgası audit log'a yazılır.
  acceptCopyright: z.literal(true, {
    message: "Telif taahhüdü onayı zorunludur",
  }),
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
    // Zod hatasıysa sadece path + ilk message'ı al (URL'e sığsın, debug
    // edilebilsin). Sefa 21 May v68 — fail page'de detail görünüyor.
    let detail = "validation_failed";
    if (err instanceof z.ZodError) {
      const first = err.issues[0];
      const path = first?.path?.join(".") || "?";
      detail = `${path}: ${first?.message ?? "unknown"}`;
      console.error("[payment/init] Zod validation failed:", err.issues);
    } else if (err instanceof Error) {
      detail = err.message.slice(0, 200);
    }
    return NextResponse.json(
      { error: "invalid_body", detail },
      { status: 400 }
    );
  }

  // 4) Server-side recalc
  // ---------------------------------------------------------
  // Sefa 23 May v68 (P0.1 güvenlik analizi): client'tan gelen unit/total
  // değerleri ARTIK körlemesine toplanmıyor. validateCartPricing her item
  // için admin live_config'ten gerçek fiyatı hesaplayıp toleransla
  // karşılaştırır; recalc yapılamayan item'lara sanity floor uygular
  // (unit ≥ 0.40 TL, min alan, total≈unit*qty).
  //
  // Eski davranış: subtotal toleransı 0.5 TL idi; saldırgan total=0.01
  // gönderirse subtotal mismatch'e takılmıyordu. Şimdi her item ayrı
  // doğrulanıyor + toplam tolerans 0.05 TL'ye sıkıştırıldı.
  // ---------------------------------------------------------
  const calcSubtotal = body.items.reduce((s, i) => s + i.total, 0);
  if (Math.abs(calcSubtotal - body.subtotal) > 0.05) {
    return NextResponse.json(
      { error: "subtotal_mismatch", expected: calcSubtotal },
      { status: 400 }
    );
  }
  const calcTotal = body.subtotal + body.shipping;
  if (Math.abs(calcTotal - body.total) > 0.05) {
    return NextResponse.json(
      { error: "total_mismatch", expected: calcTotal },
      { status: 400 }
    );
  }

  // Per-item recalc + sanity floor — P0.1 fix
  const pricingValidation = await validateCartPricing(
    body.items,
    body.subtotal
  );
  if (!pricingValidation.ok) {
    console.warn("[payment/init] pricing validation failed:", {
      userId: user.id,
      failures: pricingValidation.failures,
      recalced: pricingValidation.recalcedItemIds.length,
    });
    return NextResponse.json(
      {
        error: "pricing_validation_failed",
        // Müşteriye ayrıntı yazmıyoruz — saldırgan calibration yapmasın.
        // Detay log'da. Müşteri "Fiyat eşleşmedi, sepeti yenileyin" görür.
        hint: "Fiyat doğrulaması başarısız. Sepeti yenileyip tekrar deneyin.",
      },
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
    // PayTR currency kodu (sembol DEĞİL) — "₺" "Geçersiz parametre"
    // hatasına yol açıyordu. Sefa 21 May v68 fix.
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
  const copyrightAcceptedAt = new Date().toISOString();
  const snapshot = {
    items: body.items,
    address: body.address,
    invoice: body.invoice,
    subtotal: body.subtotal,
    shipping: body.shipping,
    total: body.total,
    couponCode: body.couponCode ?? null,
    // FSEK m.66 telif ispatı — snapshot içinde de saklanır
    copyright_accepted: true,
    copyright_accepted_at: copyrightAcceptedAt,
    copyright_accept_ip: getClientIp(req),
    copyright_accept_ua:
      req.headers.get("user-agent")?.slice(0, 500) ?? null,
  };
  const { error: insertErr } = await admin.from("payment_intents").insert([
    {
      id: merchantOid,
      user_id: user.id,
      iyzico_token: result.token,
      card_amount: cardAmount,
      wallet_amount: 0,
      snapshot: snapshot as Json,
    } satisfies TablesInsert<"payment_intents">,
  ]);

  if (insertErr) {
    console.error("[payment/init] intent insert error:", insertErr);
    return NextResponse.json(
      { error: "intent_save_failed" },
      { status: 500 }
    );
  }

  // FSEK m.66 telif ispatı — order_events'a değil, audit_log'a yaz
  // (henüz order yok — payment_intent var). Callback'te order oluşunca
  // bu kayıt order_events'a kopyalanır.
  await admin.from("audit_log").insert([
    {
      actor_id: user.id,
      actor_email: user.email ?? null,
      actor_role: "customer",
      action: "settings.update",
      target_type: "payment_intent",
      target_id: merchantOid,
      summary: `Telif taahhüt onayı verildi · payment_intent ${merchantOid}`,
      detail: {
        kind: "copyright_accepted",
        merchant_oid: merchantOid,
        accepted_at: copyrightAcceptedAt,
        ip: getClientIp(req),
        user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      } as Json,
      ip_address: getClientIp(req),
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    } satisfies TablesInsert<"audit_log">,
  ]);

  return NextResponse.json({
    paymentPageUrl: result.iframeUrl,
    token: result.token,
    merchantOid,
  });
}
