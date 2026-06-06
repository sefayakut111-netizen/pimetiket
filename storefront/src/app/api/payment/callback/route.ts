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
import * as Sentry from "@sentry/nextjs";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyCallback,
  isPayTrConfigured,
} from "@/lib/payment/paytr";
import { recoverPendingPaymentIntentWithRetries } from "@/lib/payment/recover-with-retries";
import { resolveOrderIdFromIntent } from "@/lib/payment/resolve-order-from-intent";
import {
  sendOrderConfirmation,
  sendOrderProofRequiredIfEligible,
} from "@/lib/mail/notifications";
import { ensureOrderDesignsPromoted } from "@/lib/storage/promote-temp-designs";
import { buildOrderItemMeta, orderItemsMetaHasDesignTempIds } from "@/lib/order-item-meta";
import { applyCouponAfterOrder } from "@/lib/payment/coupon-server";
import { enqueueMail } from "@/lib/mail/enqueue";
import { withAdminTestOrderMarker } from "@/lib/admin-test-order";
import { isAdminOrStaffUserId } from "@/lib/supabase/assert-admin";
import { logServerAudit } from "@/lib/audit-log-server";
import type { Json } from "@/lib/supabase/types";

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
    couponDiscount?: number | null;
    couponKind?: string | null;
    effectiveShipping?: number | null;
  };
  status: string;
}

// Sefa kuralı (12 May): orderId 8-char nanoid (~218 trilyon kombinasyon).
// Tek kaynak: src/lib/customer-order.ts. Duplicate logic kaldırıldı.
import { generateOrderId } from "@/lib/customer-order";

const SITE_URL = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function resolveHasDesignsForRedirect(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  userId: string
): Promise<boolean> {
  const { hasDesignFiles } = await ensureOrderDesignsPromoted({
    admin,
    orderId,
    userId,
  });
  if (hasDesignFiles) return true;

  const { data: orderRow } = await admin
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  const orderStatus = (orderRow as { status: string } | null)?.status;
  if (orderStatus && orderStatus !== "awaiting_upload") {
    return true;
  }

  const { data: items } = await admin
    .from("order_items")
    .select("meta")
    .eq("order_id", orderId);

  return orderItemsMetaHasDesignTempIds(
    (items as Array<{ meta: Record<string, unknown> | null }> | null) ?? []
  );
}

function successRedirectUrl(siteUrl: string, orderId: string, hasDesigns: boolean) {
  return `${siteUrl}/odeme-sonuc?status=success&order=${encodeURIComponent(orderId)}&hasDesigns=${hasDesigns}`;
}

// ============================================================
// POST — IPN handler (server-to-server)
//
// PayTR retry yapmaması için **MUTLAKA "OK" string yanıt** dönmeliyiz.
// Hash başarısız olsa bile "OK" dönmek doğru — PayTR yine retry yapsın
// ki audit trail hızlı dolsun. Ama biz hash invalidse "OK" dönmeyiz —
// fraud protection için.
// ============================================================

export const runtime = "nodejs";
export const maxDuration = 120;

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
    Sentry.captureMessage("PayTR callback: intent bulunamadı", {
      level: "warning",
      extra: { merchant_oid: merchantOid },
    });
    void logServerAudit(admin, {
      actorId: null,
      actorEmail: null,
      actorRole: "system",
      action: "settings.update",
      targetType: "payment_intent",
      targetId: merchantOid,
      summary: "PayTR callback: intent bulunamadı",
      detail: {
        kind: "paytr_callback_intent_missing",
        merchant_oid: merchantOid,
      },
    });
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
    const failureReason =
      data.failed_reason_msg ??
      data.failed_reason_code ??
      "paytr_failed";
    await admin
      .from("payment_intents")
      .update({
        status: "failed",
        failure_reason: failureReason,
      })
      .eq("id", merchantOid);

    const { sendPaymentFailed } = await import("@/lib/mail/notifications");
    void sendPaymentFailed({
      userId: intent.user_id,
      amount: intent.card_amount + intent.wallet_amount,
      failureHint: failureReason,
      merchantOid,
    }).catch((err) =>
      console.error("[payment/callback] payment_failed mail:", err)
    );

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
      })
      .eq("id", merchantOid);
    return new NextResponse("OK");
  }

  // 6) ATOMIC FINALIZE (Migration 033 — Sefa kuralı 12 May P0)
  // Tüm 5 işlem (intent consume + orders + order_items +
  // order_events + payments) tek RPC içinde transaction.
  // Hata olursa otomatik ROLLBACK. Duplicate IPN → existing order_id.
  const installmentCount = parseInt(data.installment_count ?? "1", 10) || 1;
  const cardPan = data.card_pan ?? "****";
  const masked = `**** **** **** ${cardPan.slice(-4).padStart(4, "*")}`;

  const itemsPayload = intent.snapshot.items.map((i) => ({
    product: i.product,
    title: i.title,
    config: i.config,
    width: i.width,
    height: i.height,
    qty: i.qty,
    unit: i.unit,
    total: i.total,
    meta: buildOrderItemMeta(i) as Json,
  }));

  const { estimatedDeliveryIsoForItems } = await import(
    "@/lib/site-settings-server"
  );
  const estimatedDelivery = await estimatedDeliveryIsoForItems(
    intent.snapshot.items
  );
  const markAdminTestOrder = await isAdminOrStaffUserId(intent.user_id);
  const paymentMeta = withAdminTestOrderMarker(
    {
      method: "card",
      masked,
      installment: installmentCount,
      provider: "paytr",
      cardPan,
      paymentType: data.payment_type,
      merchantOid,
    },
    markAdminTestOrder
  );

  // Mig 078: client DDMMYYYY+rand4 üretir, RPC bunu kullanır. Çakışma
  // (unique_violation, PG kodu 23505) durumunda yeni ID ile 3 kez retry.
  // Pratik çakışma olasılığı ~0% (günde 1-10 sipariş × 10K kombinasyon)
  // ama defansif olarak retry koymak güvenli.
  let candidateOrderId = generateOrderId();
  let rpcData: { order_id: string; was_duplicate: boolean }[] | null = null;
  let rpcErr: { message?: string; code?: string } | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data: d, error: e } = await admin.rpc("fn_finalize_paid_order", {
        p_merchant_oid: merchantOid,
        p_order_id: candidateOrderId,
        p_items: itemsPayload as Json,
        p_payment_meta: paymentMeta,
        p_estimated_delivery: estimatedDelivery,
      });
    rpcData = d;
    rpcErr = e as { message?: string; code?: string } | null;

    // unique_violation (23505) → yeni ID üret, tekrar dene
    if (rpcErr && rpcErr.code === "23505" && attempt < 3) {
      console.warn(
        `[payment/callback] order_id çakışması (attempt ${attempt}): ${candidateOrderId} → yeni üretiliyor`
      );
      candidateOrderId = generateOrderId();
      continue;
    }
    break;
  }

  if (rpcErr) {
    console.error("[payment/callback] finalize RPC error:", rpcErr);
    Sentry.captureException(rpcErr, {
      tags: {
        scope: "payment.callback.rpc",
        merchant_oid: merchantOid,
      },
      extra: {
        order_id: candidateOrderId,
        rpc: "fn_finalize_paid_order",
      },
    });
    await admin
      .from("payment_intents")
      .update({
        failure_reason: `RPC error: ${rpcErr.message ?? "unknown"}`,
        status: "pending",
      })
      .eq("id", merchantOid);
    // PayTR retry yapsın — sipariş oluşturma tekrar denenebilir
    return new NextResponse("finalize_failed", { status: 500 });
  }

  const rpcRow = rpcData?.[0];
  const orderId = rpcRow?.order_id ?? candidateOrderId;
  const wasDuplicate = rpcRow?.was_duplicate ?? false;

  // GET redirect + polling için order_id hemen yaz (promote/QC hatası siparişi kaybettirmesin)
  await admin
    .from("payment_intents")
    .update({ order_id: orderId })
    .eq("id", merchantOid);

  // Duplicate IPN: var olan order'ı PayTR'a yine "OK" döneriz,
  // promote/referral'i tekrar çalıştırmıyoruz.
  if (wasDuplicate) {
    console.log(
      `[payment/callback] duplicate IPN ${merchantOid} → existing ${orderId}`
    );
    await ensureOrderDesignsPromoted({
      admin,
      orderId,
      userId: intent.user_id,
    });
    return new NextResponse("OK");
  }

  if (intent.snapshot.couponCode) {
    const applyResult = await applyCouponAfterOrder(admin, {
      code: intent.snapshot.couponCode,
      subtotal: intent.snapshot.subtotal,
      userId: intent.user_id,
      orderId,
      chargedDiscount: intent.snapshot.couponDiscount ?? undefined,
    });
    if (!applyResult.ok) {
      console.warn(
        "[payment/callback] coupon apply failed:",
        applyResult.reason,
        merchantOid
      );
    }
  }

  // 7) Pre-purchase tasarım promote (idempotent — IPN retry kurtarır)
  await ensureOrderDesignsPromoted({
    admin,
    orderId,
    userId: intent.user_id,
  });

  // (11) Cüzdan akışı KALDIRILDI — Migration 015

  // (11b) Referans tamamlama — bu kullanıcının ilk siparişi mi?
  // Eğer referred_by_user_id varsa ve bu ilk siparişiyse, referrer'a kupon ver
  try {
    const { count: priorOrders } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", intent.user_id)
      .neq("id", orderId);
    if (priorOrders === 0 || priorOrders === null) {
      // İlk sipariş — referral tamamla
      await admin.rpc("fn_complete_referral", {
        p_referred_user_id: intent.user_id,
      });
    }
  } catch (err) {
    console.error("[payment/callback] referral completion error:", err);
    // referral hatası ödemeyi etkilemez
  }

  // 12) Cart temizle
  await admin.from("cart_items").delete().eq("user_id", intent.user_id);

  // 14) Order confirmation maili (fire-and-forget)
  void sendOrderConfirmation({
    userId: intent.user_id,
    orderId,
  }).catch((err) =>
    console.error("[payment/callback] order mail failed:", err)
  );

  // 14a) Baskı onay maili — yalnız prova aşamasında (awaiting_upload/qc'de yok).
  // Prova hazır olunca run-order-cutline → sendProofReady ayrıca tetiklenir.
  void sendOrderProofRequiredIfEligible({
    userId: intent.user_id,
    orderId,
  }).catch((err) =>
    console.error("[payment/callback] proof_required mail failed:", err)
  );

  // QC artık promote sonrası (veya upload-complete) tetikleniyor — race önlemek için
  // burada doğrudan çağrılmıyor.

  // 14c) Admin anlık sipariş bildirimi (Sefa 21 May v68 — admin operasyon
  // konforu). ADMIN_NOTIFICATION_EMAIL env'i set ise yeni siparişte
  // Sefa'ya mail atılır. Birden fazla admin için virgülle ayrılmış liste.
  // Resend env yoksa enqueue NO-OP (outbox'a yazılır ama gönderim olmaz).
  void notifyAdminNewOrder({ admin, orderId, userId: intent.user_id }).catch(
    (err) => console.error("[payment/callback] admin notify failed:", err)
  );

  // 15) PayTR'ye "OK" yanıtı (KRİTİK — yoksa retry yapar)
  return new NextResponse("OK");
}

// ============================================================
// Admin bildirim helper (Sefa 21 May v68)
// ============================================================
async function notifyAdminNewOrder({
  admin,
  orderId,
  userId,
}: {
  admin: ReturnType<typeof createAdminClient>;
  orderId: string;
  userId: string;
}): Promise<void> {
  const adminEmails = (process.env.ADMIN_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (adminEmails.length === 0) return; // env yok → skip

  // Sipariş + items özet için tek query
  type OrderRow = {
    total: number | string;
    address: { fullName?: string } | null;
    status: string;
    order_items: Array<{ product: string; qty: number; title: string }>;
  };
  const { data: orderData } = await admin
    .from("orders")
    .select("total, address, status, order_items(product, qty, title)")
    .eq("id", orderId)
    .maybeSingle();
  const order = orderData as unknown as OrderRow | null;
  if (!order) return;

  // Müşteri bilgisi auth.users'tan email
  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const customerEmail = userData?.user?.email ?? "—";

  const addr = order.address ?? {};
  const items = order.order_items ?? [];
  const itemsSummary = items
    .map((i) => `${i.qty}× ${i.title} (${i.product})`)
    .join(" · ");
  const total = Number(order.total) || 0;
  const totalText = `${Math.round(total).toLocaleString("tr-TR")} ₺`;
  const hasDesign = (order.status as string) !== "awaiting_upload";

  // Her admin için ayrı outbox kaydı
  for (const to of adminEmails) {
    await enqueueMail({
      to,
      templateKey: "admin_new_order",
      category: "admin",
      targetType: "order",
      targetId: orderId,
      payload: {
        order_id: orderId,
        customer_email: customerEmail,
        customer_name: addr.fullName ?? "Yeni müşteri",
        total_text: totalText,
        items_summary: itemsSummary || "—",
        has_design: hasDesign,
      },
    });
  }
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

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("payment_intents")
    .select("status, order_id, failure_reason, user_id")
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
    user_id: string;
  };

  if (!user) {
    const nextPath =
      ret === "ok"
        ? `/odeme-sonuc?status=success&oid=${encodeURIComponent(oid)}`
        : `/odeme-sonuc?status=fail&reason=login_required`;
    const redirectUrl = new URL("/auth", siteUrl);
    redirectUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(redirectUrl.toString(), 303);
  }

  if (intent.user_id !== user.id) {
    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=fail&reason=forbidden`,
      303
    );
  }

  if (intent.status === "consumed") {
    const orderId = await resolveOrderIdFromIntent(
      admin,
      oid,
      intent.order_id
    );
    if (orderId) {
      const hasDesigns = await resolveHasDesignsForRedirect(
        admin,
        orderId,
        intent.user_id
      );
      return NextResponse.redirect(
        successRedirectUrl(siteUrl, orderId, hasDesigns),
        303
      );
    }
  }

  if (intent.status === "failed") {
    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=fail&reason=${encodeURIComponent(
        intent.failure_reason ?? "payment_failed"
      )}`,
      303
    );
  }

  // Pending — IPN henüz gelmemiş olabilir. PayTR Durum Sorgu ile recover dene.
  if (ret === "ok") {
    const recovered = await recoverPendingPaymentIntentWithRetries(admin, oid, {
      userId: user.id,
      maxAttempts: 5,
      delayMs: 1500,
    });
    if (recovered.status === "consumed") {
      const hasDesigns = await resolveHasDesignsForRedirect(
        admin,
        recovered.orderId,
        intent.user_id
      );
      return NextResponse.redirect(
        successRedirectUrl(siteUrl, recovered.orderId, hasDesigns),
        303
      );
    }
    if (recovered.status === "failed") {
      return NextResponse.redirect(
        `${siteUrl}/odeme-sonuc?status=fail&reason=${encodeURIComponent(
          recovered.reason
        )}`,
        303
      );
    }
    // Hâlâ pending — /odeme-sonuc polling ile devam eder
    return NextResponse.redirect(
      `${siteUrl}/odeme-sonuc?status=success&order=pending&oid=${encodeURIComponent(oid)}`,
      303
    );
  }

  return NextResponse.redirect(
    `${siteUrl}/odeme-sonuc?status=fail&reason=user_cancelled`,
    303
  );
}
