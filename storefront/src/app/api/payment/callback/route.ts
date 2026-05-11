/**
 * POST/GET /api/payment/callback
 *
 * PayTR ödeme sonrası 2 yolla çağırır:
 *   A) IPN POST (server-to-server): PayTR ödemeyi doğrular, body'de
 *      merchant_oid + status + total_amount + hash gelir.
 *      PayTR "OK" string yanıtı bekler, yoksa retry yapar.
 *   B) Browser redirect (GET): merchant_ok_url / merchant_fail_url
 *      query params ile gelir (?return=ok&oid=...).
 *
 * Bizim mantık:
 *   - POST geldiğinde: hash doğrula → fn_create_order RPC + payments INSERT
 *     → "OK" yanıt (PayTR retry önlemi)
 *   - GET geldiğinde: zaten POST callback işlemiş olur, kullanıcıyı
 *     /odeme-sonuc?status=success&order=<id>'ye redirect et.
 *
 * Idempotency: aynı merchant_oid 2. kez gelirse intent.status kontrol
 * (consumed ise atla).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyCallback,
  isPayTrConfigured,
} from "@/lib/payment/paytr";
import { sendOrderConfirmation } from "@/lib/mail/notifications";
import { promoteOrderDesigns } from "@/lib/storage/promote-temp-designs";

interface IntentRow {
  id: string;
  user_id: string;
  iyzico_token: string | null; // legacy alan adı, PayTR token tutuyor
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
      designTempId?: string;
      shape?: string;
      cut?: string;
      softCorners?: boolean;
      material?: string;
      finish?: string;
      hediyeAdet?: number;
      materialId?: string;
      coatingId?: string;
      customizationId?: string;
      winding?: number;
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

const SITE_URL = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// ============================================================
// POST — IPN handler (server-to-server)
//
// PayTR retry yapmaması için **MUTLAKA "OK" string yanıt** dönmeliyiz.
// Hash başarısız olsa bile "OK" dönmek doğru — PayTR yine retry yapsın
// ki audit trail hızlı dolsun. Ama biz hash invalidse "OK" dönmeyiz —
// fraud protection için.
// ============================================================

export async function POST(req: NextRequest) {
  if (!isPayTrConfigured()) {
    // PayTR retry yapacak, ama biz config yokken "OK" demeyeceğiz
    return new NextResponse("provider_not_configured", { status: 503 });
  }

  // Form-encoded body parse
  let formObj: Record<string, string> = {};
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      formData.forEach((v, k) => {
        formObj[k] = v.toString();
      });
    } else if (contentType.includes("application/json")) {
      formObj = (await req.json()) as Record<string, string>;
    }
  } catch (err) {
    console.error("[payment/callback] body parse error:", err);
    return new NextResponse("invalid_body", { status: 400 });
  }

  // 1) Hash doğrula
  const verify = verifyCallback(formObj);
  if (!verify.ok || !verify.data) {
    console.error("[payment/callback] hash verify failed:", verify.reason);
    // PayTR'ye "OK" yazma — retry yapsın, fraud yakala
    return new NextResponse(`hash_invalid: ${verify.reason}`, { status: 400 });
  }

  const data = verify.data;
  const merchantOid = data.merchant_oid;
  const isSuccess = data.status === "success";

  // 2) Intent yükle
  const admin = createAdminClient();
  const { data: intentRow, error: intentErr } = await admin
    .from("payment_intents")
    .select("*")
    .eq("id", merchantOid)
    .single();

  if (intentErr || !intentRow) {
    console.error("[payment/callback] intent not found:", merchantOid);
    // Intent yoksa "OK" dönelim — PayTR retry'lamasın, biz manuel düzeltiriz
    return new NextResponse("OK");
  }

  const intent = intentRow as unknown as IntentRow;

  // 3) Idempotency — zaten consumed ise atla
  if (intent.status === "consumed") {
    return new NextResponse("OK");
  }

  // 4) Failure path
  if (!isSuccess) {
    await admin
      .from("payment_intents")
      .update({
        status: "failed",
        failure_reason:
          data.failed_reason_msg ??
          data.failed_reason_code ??
          "paytr_failed",
      } as never)
      .eq("id", merchantOid);
    return new NextResponse("OK");
  }

  // 5) Tutar doğrulama (kuruş cinsinden)
  const expectedKurus = Math.round(intent.card_amount * 100);
  const incomingKurus = parseInt(data.total_amount, 10);
  if (Math.abs(expectedKurus - incomingKurus) > 1) {
    console.error(
      "[payment/callback] amount mismatch:",
      expectedKurus,
      "vs",
      incomingKurus
    );
    await admin
      .from("payment_intents")
      .update({
        status: "failed",
        failure_reason: "amount_mismatch",
      } as never)
      .eq("id", merchantOid);
    return new NextResponse("OK");
  }

  // 6) Sipariş oluştur
  const orderId = generateOrderId();
  const installmentCount = parseInt(data.installment_count ?? "1", 10) || 1;
  const cardPan = data.card_pan ?? "****";
  const masked = `**** **** **** ${cardPan.slice(-4).padStart(4, "*")}`;

  const items = intent.snapshot.items.map((i) => ({
    product: i.product,
    title: i.title,
    config: i.config,
    width: i.width,
    height: i.height,
    qty: i.qty,
    unit: i.unit,
    total: i.total,
    meta: {
      ...(i.meta ?? {}),
      designTempId: i.designTempId,
      shape: i.shape,
      cut: i.cut,
      softCorners: i.softCorners,
      material: i.material,
      finish: i.finish,
      hediyeAdet: i.hediyeAdet,
      materialId: i.materialId,
      coatingId: i.coatingId,
      customizationId: i.customizationId,
      winding: i.winding,
    },
  }));

  const estimatedDelivery = addDaysIso(
    intent.snapshot.items.some((i) => i.product === "etiket") ? 10 : 5
  );

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
      payment: {
        method: "card",
        masked,
        installment: installmentCount,
        provider: "paytr",
      },
      estimated_delivery: estimatedDelivery,
    },
  ] as never);

  if (orderInsertErr) {
    console.error("[payment/callback] orders insert error:", orderInsertErr);
    return new NextResponse("OK"); // PayTR retry yapmasın
  }

  // 7) order_items
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
  const { data: insertedItems, error: itemsErr } = await admin
    .from("order_items")
    .insert(itemRows as never)
    .select("id, product, meta");
  if (itemsErr) {
    console.error("[payment/callback] order_items error:", itemsErr);
  }

  // 8) Pre-purchase tasarım promote
  const orderItemsForPromote = (
    (insertedItems as unknown as Array<{
      id: string;
      product: "sticker" | "etiket";
      meta: Record<string, unknown>;
    }>) ?? []
  ).filter((i) => (i.meta as { designTempId?: string })?.designTempId);

  if (orderItemsForPromote.length > 0) {
    try {
      await promoteOrderDesigns({
        admin,
        orderId,
        userId: intent.user_id,
        orderItems: orderItemsForPromote,
      });
    } catch (err) {
      console.error("[payment/callback] promote failed:", err);
    }
  }

  // 9) order_events 'paid' log
  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "paid",
      status_after: "paid",
      actor_id: intent.user_id,
      actor_role: "customer",
      summary: "Ödeme alındı (PayTR).",
      detail: {
        merchantOid,
        installment: installmentCount,
        cardPan,
        paymentType: data.payment_type,
      },
    },
  ] as never);

  // 10) payments başarı kaydı
  await admin.from("payments").insert([
    {
      order_id: orderId,
      psp_provider: "paytr",
      psp_transaction_id: merchantOid,
      action: "charge",
      amount: intent.card_amount,
      currency: "TRY",
      status: "success",
      idempotency_key: `success:${merchantOid}`,
      psp_raw: data as never,
      card_masked: masked,
      installment: installmentCount,
      completed_at: new Date().toISOString(),
    },
  ] as never);

  // (11) Cüzdan akışı KALDIRILDI — Migration 015

  // 12) Cart temizle
  await admin.from("cart_items").delete().eq("user_id", intent.user_id);

  // 13) Intent consume
  await admin
    .from("payment_intents")
    .update({
      status: "consumed",
      order_id: orderId,
      consumed_at: new Date().toISOString(),
    } as never)
    .eq("id", merchantOid);

  // 14) Order confirmation maili (fire-and-forget)
  void sendOrderConfirmation({
    userId: intent.user_id,
    orderId,
  }).catch((err) =>
    console.error("[payment/callback] order mail failed:", err)
  );

  // 15) PayTR'ye "OK" yanıtı (KRİTİK — yoksa retry yapar)
  return new NextResponse("OK");
}

// ============================================================
// GET — Browser redirect (merchant_ok_url / merchant_fail_url)
//
// Müşteri PayTR iframe'inden çıkar, success/fail URL'imize gelir.
// IPN POST muhtemelen zaten geldi, biz sadece /odeme-sonuc'a redirect.
// ============================================================

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ret = sp.get("return"); // "ok" veya "fail"
  const oid = sp.get("oid");
  const siteUrl = SITE_URL();

  if (!oid) {
    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=fail&reason=missing_oid`,
      303
    );
  }

  // Intent'in son durumuna bak (POST callback işledi mi?)
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("payment_intents")
    .select("status, order_id, failure_reason")
    .eq("id", oid)
    .single();

  if (!row) {
    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=fail&reason=intent_not_found`,
      303
    );
  }

  const intent = row as unknown as {
    status: string;
    order_id: string | null;
    failure_reason: string | null;
  };

  if (intent.status === "consumed" && intent.order_id) {
    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=success&order=${intent.order_id}`,
      303
    );
  }

  if (intent.status === "failed") {
    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=fail&reason=${encodeURIComponent(
        intent.failure_reason ?? "payment_failed"
      )}`,
      303
    );
  }

  // Pending — IPN henüz işlemedi. Ret ok ise success, fail ise fail göster.
  if (ret === "ok") {
    // PayTR IPN gelene kadar /odeme-sonuc kendi polling yapsın
    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=success&order=pending&oid=${oid}`,
      303
    );
  }

  return NextResponse.redirect(
    `${siteUrl}/odeme-sonuc?status=fail&reason=user_cancelled`,
    303
  );
}
