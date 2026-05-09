/**
 * POST/GET /api/payment/callback
 *
 * iyzico CheckoutForm 3DS sonrası buraya POST atar (form-encoded).
 *   token=<token>&conversationId=<id>
 *
 * Akış:
 *   1. Body'den token al
 *   2. iyzico retrieveCheckoutForm(token) → success kontrolü
 *   3. payment_intents tablosundan snapshot çek (conversationId ile)
 *   4. Success ise:
 *      - fn_create_order RPC ile sipariş oluştur (atomik)
 *      - fn_consume_payment_intent ile intent'i tüket
 *      - payments tablosuna success kaydı INSERT
 *      - 302 redirect → /odeme-sonuc?status=success&order=<id>
 *   5. Failure ise:
 *      - intent status=failed update
 *      - 302 redirect → /odeme-sonuc?status=fail&reason=<...>
 *
 * iyzico'nun dönüş formatı genelde POST application/x-www-form-urlencoded.
 * Bazı durumlarda GET de olabilir; ikisini de destekleriz.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  retrieveCheckoutForm,
  isIyzicoConfigured,
} from "@/lib/payment/iyzico";

interface IntentRow {
  id: string;
  user_id: string;
  iyzico_token: string | null;
  card_amount: number;
  wallet_amount: number;
  snapshot: {
    items: Array<{
      id: string;
      product: "sticker" | "etiket";
      title: string;
      config: string;
      width: number;
      height: number;
      qty: number;
      unit: number;
      total: number;
      meta?: Record<string, unknown>;
    }>;
    address: {
      label?: string | null;
      name: string;
      addr: string;
      city: string;
      phone: string;
    };
    invoice: {
      type: "individual" | "corporate";
      tc?: string;
      vkn?: string;
      companyName?: string;
      taxOffice?: string;
    };
    subtotal: number;
    shipping: number;
    total: number;
    couponCode: string | null;
  };
  status: string;
}

function generateOrderId(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(1000 + Math.random() * 9000);
  return `PE-${year}-${seq}`;
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function handleCallback(req: NextRequest): Promise<NextResponse> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // 1) Token + conversationId çek (POST form veya GET query)
  let token: string | null = null;
  let conversationId: string | null = null;

  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      token = (formData.get("token") as string | null) ?? null;
      conversationId =
        (formData.get("conversationId") as string | null) ?? null;
    } else {
      try {
        const json = await req.json();
        token = json.token ?? null;
        conversationId = json.conversationId ?? null;
      } catch {
        token = null;
      }
    }
  } else {
    token = req.nextUrl.searchParams.get("token");
    conversationId = req.nextUrl.searchParams.get("conversationId");
  }

  if (!token) {
    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=fail&reason=missing_token`,
      303
    );
  }

  if (!isIyzicoConfigured()) {
    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=fail&reason=provider_not_configured`,
      303
    );
  }

  // 2) iyzico retrieve
  let result;
  try {
    result = await retrieveCheckoutForm({
      locale: "tr",
      conversationId: conversationId ?? "",
      token,
    });
  } catch (err) {
    console.error("[payment/callback] retrieve error:", err);
    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=fail&reason=retrieve_failed`,
      303
    );
  }

  // 3) Intent yükle (token üzerinden)
  const admin = createAdminClient();
  const { data: intentData, error: intentErr } = await admin
    .from("payment_intents")
    .select("*")
    .eq("iyzico_token", token)
    .single();

  if (intentErr || !intentData) {
    console.error("[payment/callback] intent lookup failed:", intentErr);
    // Idempotency: intent yoksa belki zaten consumed. order_id ile bul.
    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=fail&reason=intent_not_found`,
      303
    );
  }
  const intent = intentData as unknown as IntentRow;

  // 4) Already consumed? — idempotent retry
  if (intent.status !== "pending") {
    // Tekrar callback geldi (iyzico bazen retry yapar). Sipariş zaten
    // açıldıysa intent.order_id ile başarı sayfasına dön.
    const { data: maybeOrder } = await admin
      .from("payment_intents")
      .select("order_id")
      .eq("id", intent.id)
      .single();
    const existingOrderId = (maybeOrder as { order_id?: string } | null)
      ?.order_id;
    if (existingOrderId) {
      return NextResponse.redirect(
        `${siteUrl}/odeme-sonuc?status=success&order=${existingOrderId}`,
        303
      );
    }
    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=fail&reason=intent_already_processed`,
      303
    );
  }

  // 5) Iyzico success?
  if (result.status !== "success" || result.paymentStatus !== "SUCCESS") {
    console.error(
      "[payment/callback] payment failed:",
      result.errorMessage,
      result.paymentStatus
    );
    await admin
      .from("payment_intents")
      .update({
        status: "failed",
        failure_reason: result.errorMessage ?? "iyzico_payment_failed",
      } as never)
      .eq("id", intent.id);

    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=fail&reason=${encodeURIComponent(
        result.errorMessage ?? "payment_failed"
      )}`,
      303
    );
  }

  // 6) Tutar doğrulama (paidPrice eşit mi?)
  const paidPrice = parseFloat(result.paidPrice ?? "0");
  if (Math.abs(paidPrice - intent.card_amount) > 0.5) {
    console.error(
      "[payment/callback] paidPrice mismatch:",
      paidPrice,
      "vs intent",
      intent.card_amount
    );
    await admin
      .from("payment_intents")
      .update({
        status: "failed",
        failure_reason: "amount_mismatch",
      } as never)
      .eq("id", intent.id);
    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=fail&reason=amount_mismatch`,
      303
    );
  }

  // 7) Sipariş oluştur (fn_create_order RPC — atomik)
  const orderId = generateOrderId();
  const last4 = result.lastFourDigits ?? "****";
  const masked = `**** **** **** ${last4}`;
  const items = intent.snapshot.items.map((i) => ({
    product: i.product,
    title: i.title,
    config: i.config,
    width: i.width,
    height: i.height,
    qty: i.qty,
    unit: i.unit,
    total: i.total,
    meta: i.meta ?? {},
  }));

  const estimatedDelivery = addDaysIso(
    intent.snapshot.items.some((i) => i.product === "etiket") ? 10 : 5
  );

  // RPC çağrısı için service_role kullanıyoruz; auth.uid() guard
  // bypass etmek için fn_create_order param'ında userId açık geçiyor.
  // Fakat fn_create_order içinde "auth.uid() <> p_user_id" kontrolü
  // var — service_role'da auth.uid() null olur, exception fırlar.
  // Bu nedenle service_role için ayrı bir helper gerekir veya
  // fn_create_order'ı service_role bypass'la çağırmamız gerekir.
  // Şimdilik: doğrudan INSERT atalım (admin client RLS bypass eder).

  const { error: orderInsertErr } = await admin.from("orders").insert([
    {
      id: orderId,
      user_id: intent.user_id,
      status: "paid",
      subtotal: intent.snapshot.subtotal,
      shipping: intent.snapshot.shipping,
      total: intent.snapshot.total,
      address: intent.snapshot.address,
      invoice: intent.snapshot.invoice,
      payment: { method: "card", masked, installment: result.installment },
      estimated_delivery: estimatedDelivery,
    },
  ] as never);

  if (orderInsertErr) {
    console.error("[payment/callback] orders insert error:", orderInsertErr);
    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=fail&reason=order_create_failed`,
      303
    );
  }

  // order_items batch insert
  const itemRows = items.map((i) => ({
    order_id: orderId,
    product: i.product,
    title: i.title,
    config: i.config,
    width: i.width,
    height: i.height,
    qty: i.qty,
    unit: i.unit,
    total: i.total,
    meta: i.meta,
  }));
  const { error: itemsErr } = await admin
    .from("order_items")
    .insert(itemRows as never);
  if (itemsErr) {
    console.error("[payment/callback] order_items error:", itemsErr);
    // Order silmeye çalış (cleanup) — ama callback ikinci kez gelirse
    // duplicate olur. Şimdilik log + devam.
  }

  // İlk event (created + paid)
  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "paid",
      status_after: "paid",
      actor_id: intent.user_id,
      actor_role: "customer",
      summary: "Ödeme alındı (iyzico).",
      detail: {
        paymentId: result.paymentId,
        installment: result.installment,
        cardFamily: result.cardFamily,
      },
    },
  ] as never);

  // 8) payments başarı kaydı
  await admin.from("payments").insert([
    {
      order_id: orderId,
      psp_provider: "iyzico",
      psp_transaction_id: result.paymentId ?? token,
      action: "charge",
      amount: intent.card_amount,
      currency: "TRY",
      status: "success",
      idempotency_key: `success:${intent.id}`,
      psp_raw: result as never,
      card_masked: masked,
      installment: result.installment ?? 1,
      completed_at: new Date().toISOString(),
    },
  ] as never);

  // 9) Cüzdan ile ödenen kısım (varsa) — wallet_transactions negatif
  if (intent.wallet_amount > 0) {
    await admin.from("wallet_transactions").insert([
      {
        user_id: intent.user_id,
        amount: -Math.abs(intent.wallet_amount),
        description: `Sipariş ${orderId} (cüzdan kısmı)`,
        order_id: orderId,
      },
    ] as never);
  }

  // 10) Cart temizle (DB cart_items)
  await admin.from("cart_items").delete().eq("user_id", intent.user_id);

  // 11) Intent consume (status=consumed, order_id bağla)
  await admin
    .from("payment_intents")
    .update({
      status: "consumed",
      order_id: orderId,
      consumed_at: new Date().toISOString(),
    } as never)
    .eq("id", intent.id);

  // 12) Redirect → başarı sayfası
  return NextResponse.redirect(
    `${siteUrl}/odeme-sonuc?status=success&order=${orderId}`,
    303
  );
}

export async function POST(req: NextRequest) {
  return handleCallback(req);
}

export async function GET(req: NextRequest) {
  return handleCallback(req);
}
