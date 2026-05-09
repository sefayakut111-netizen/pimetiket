/**
 * POST /api/payment/init
 *
 * Müşteri /odeme sayfasında "Güvenli ödemeye geç" tıkladığında çağrılır.
 *
 * Akış:
 *   1. Auth kontrolü (login zorunlu)
 *   2. Body validation (cart items + address + invoice)
 *   3. (Opsiyonel) kupon validate + cüzdan düşümü
 *   4. iyzico CheckoutForm Initialize → token + paymentPageUrl
 *   5. payments tablosuna pending kayıt (idempotency_key ile)
 *   6. JSON: { paymentPageUrl, conversationId, token }
 *
 * Müşteri paymentPageUrl'e yönlenir (redirect veya iframe).
 * iyzico 3DS yapar, callback /api/payment/callback'e POST atar.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createCheckoutForm,
  fmtPrice,
  isIyzicoConfigured,
  validateBasketTotals,
  CORPORATE_PLACEHOLDER_TC,
} from "@/lib/payment/iyzico";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  IyzicoBasketItem,
  IyzicoBuyer,
  IyzicoAddress,
} from "@/lib/payment/iyzico-types";

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
  /** Cüzdan kullanılacak tutar (TL). Total'dan düşülür, kalan kart ile alınır */
  walletAmount: z.number().nonnegative().optional(),
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

function generateConversationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// Handler
// ============================================================

export async function POST(req: NextRequest) {
  // 1) Iyzico configured?
  if (!isIyzicoConfigured()) {
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

  // 4) Total tutarlılık kontrolü (server-side recalc)
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

  // 5) Cüzdan ile ödenecek tutar (varsa) — total'dan düşülür
  const walletAmount = body.walletAmount ?? 0;
  const cardAmount = body.total - walletAmount;
  if (cardAmount < 0) {
    return NextResponse.json(
      { error: "wallet_exceeds_total" },
      { status: 400 }
    );
  }
  // Eğer kartla ödenecek tutar yoksa (cüzdan tüm sepeti karşılıyorsa)
  // iyzico'ya gitmeye gerek yok — direkt order create + wallet debit.
  // Bu akış /api/payment/wallet-only endpoint'inde (P0-3.8); şimdilik
  // tutar 0'a düşmesin diye min 1 TL şartı (iyzico zaten reddeder).
  if (cardAmount < 1) {
    return NextResponse.json(
      { error: "use_wallet_only_endpoint" },
      { status: 400 }
    );
  }

  // 6) iyzico basket items
  // KRİTİK: items[].price toplamı paidPrice'a EŞIT olmalı. Kargo ve cüzdan
  // farkını items üzerinde dağıtırız (basit yaklaşım: ilk item'a ekle).
  let runningRemainder = cardAmount;
  const basketItems: IyzicoBasketItem[] = body.items.map((it, idx) => {
    const isLast = idx === body.items.length - 1;
    let itemPrice: number;
    if (isLast) {
      itemPrice = parseFloat(runningRemainder.toFixed(2));
    } else {
      // Proportional pay: cardAmount oranında
      const ratio = it.total / body.subtotal;
      itemPrice = parseFloat((cardAmount * ratio).toFixed(2));
      runningRemainder -= itemPrice;
    }
    return {
      id: it.id,
      name: it.title,
      category1: it.product === "sticker" ? "Sticker" : "Etiket",
      itemType: "PHYSICAL",
      price: fmtPrice(itemPrice),
    };
  });

  if (!validateBasketTotals(basketItems, fmtPrice(cardAmount))) {
    return NextResponse.json(
      { error: "basket_totals_mismatch" },
      { status: 500 }
    );
  }

  // 7) iyzico buyer
  const tc =
    body.invoice.type === "individual" && body.invoice.tc
      ? body.invoice.tc
      : CORPORATE_PLACEHOLDER_TC;

  const nameParts = body.address.name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? "Müşteri";
  const lastName = nameParts.slice(1).join(" ") || "—";

  const buyer: IyzicoBuyer = {
    id: user.id,
    name: firstName,
    surname: lastName,
    gsmNumber: body.address.phone.replace(/\s+/g, "") || undefined,
    email: user.email ?? "no-reply@pimetiket.com",
    identityNumber: tc,
    registrationAddress: body.address.addr,
    ip: getClientIp(req),
    city: body.address.city,
    country: "Turkey",
  };

  const shippingAddress: IyzicoAddress = {
    contactName: body.address.name,
    city: body.address.city,
    country: "Turkey",
    address: body.address.addr,
  };

  const billingAddress: IyzicoAddress = {
    contactName:
      body.invoice.type === "corporate"
        ? body.invoice.companyName ?? body.address.name
        : body.address.name,
    city: body.address.city,
    country: "Turkey",
    address: body.address.addr,
  };

  // 8) Conversation ID + idempotency
  const conversationId = generateConversationId();
  const idempotencyKey = `init:${user.id}:${conversationId}`;

  // 9) iyzico initialize
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  let init;
  try {
    init = await createCheckoutForm({
      locale: "tr",
      conversationId,
      price: fmtPrice(cardAmount),
      paidPrice: fmtPrice(cardAmount),
      currency: "TRY",
      basketId: conversationId,
      paymentGroup: "PRODUCT",
      callbackUrl: `${siteUrl}/api/payment/callback`,
      enabledInstallments: [1, 2, 3, 6, 9, 12],
      buyer,
      shippingAddress,
      billingAddress,
      basketItems,
    });
  } catch (err) {
    console.error("[payment/init] iyzico error:", err);
    return NextResponse.json(
      { error: "iyzico_call_failed" },
      { status: 502 }
    );
  }

  if (init.status !== "success") {
    console.error("[payment/init] iyzico failed:", init.errorMessage);
    return NextResponse.json(
      {
        error: "iyzico_initialize_failed",
        code: init.errorCode,
        message: init.errorMessage,
      },
      { status: 400 }
    );
  }

  // 10) DB'ye payment_intent kaydı (snapshot)
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
      id: conversationId,
      user_id: user.id,
      iyzico_token: init.token,
      card_amount: cardAmount,
      wallet_amount: walletAmount,
      snapshot,
    },
  ] as never);

  if (insertErr) {
    console.error("[payment/init] intent insert error:", insertErr);
    // iyzico session açıldı ama intent kaydedilmedi — callback'te
    // sipariş açılamayacak. User'a hata dön.
    return NextResponse.json(
      { error: "intent_save_failed" },
      { status: 500 }
    );
  }

  // idempotency_key ileride duplicate iyzico initialize engelleme için
  // (aynı body 2x post atılırsa). Şimdilik conversationId ile yeterli.
  void idempotencyKey;

  return NextResponse.json({
    paymentPageUrl: init.paymentPageUrl,
    token: init.token,
    conversationId,
  });
}
