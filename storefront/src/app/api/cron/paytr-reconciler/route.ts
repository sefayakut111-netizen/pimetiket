/**
 * GET /api/cron/paytr-reconciler
 *
 * Sefa 20 May v68 (Agent denetim P0 #1):
 * IPN miss reconciler — PayTR callback'i ulaşmadığında veya müşteri
 * tarayıcıyı erken kapattığında, payment_intents tablosunda 'pending'
 * kalan kayıtları PayTR Durum Sorgu API ile doğrular.
 *
 * Akış:
 *   1. `payment_intents.status='pending' AND created_at < now() - 15min`
 *   2. Her birinin merchant_oid'ini PayTR Durum Sorgu ile sorgu
 *   3. status='success' → fn_finalize_paid_order (mevcut RPC, idempotent)
 *   4. status='failed' → intent.status='failed', notes log
 *   5. status='waiting' → no-op (bir sonraki cron'da bak)
 *
 * Schedule: günlük 03:30 (Hobby plan limit). Pro upgrade sonrası
 * saatlik (0 * * * *) yapılmalı — para kaybı algı süresini düşürür.
 *
 * Güvenlik: CRON_SECRET Bearer kontrolü.
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { assertCronAuth } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { queryPaymentStatus, isPayTrConfigured } from "@/lib/payment/paytr";
import {
  sendOrderConfirmation,
  sendOrderProofRequired,
} from "@/lib/mail/notifications";

export const runtime = "nodejs";
export const maxDuration = 60;

interface IntentRow {
  id: string; // merchant_oid (PayTR intent_id)
  user_id: string;
  card_amount: number;
  snapshot: {
    items?: unknown[];
    address?: unknown;
    invoice?: unknown;
    subtotal?: number;
    shipping?: number;
    total?: number;
  } | null;
  status: string;
  created_at: string;
}

export async function GET(req: Request) {
  const authError = assertCronAuth(req);
  if (authError) return authError;

  if (!isPayTrConfigured()) {
    return NextResponse.json(
      { ok: false, error: "paytr_not_configured" },
      { status: 503 }
    );
  }

  const admin = createAdminClient();

  // 15 dakikadan eski + pending intent'ler (worst-case 24sa kayıp)
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: intentRows, error: selectErr } = await admin
    .from("payment_intents")
    .select("id, user_id, card_amount, snapshot, status, created_at")
    .eq("status", "pending")
    .lt("created_at", fifteenMinAgo)
    .order("created_at", { ascending: true })
    .limit(50); // güvenlik için batch limit

  if (selectErr) {
    Sentry.captureException(selectErr, {
      tags: { scope: "paytr_reconciler.select" },
    });
    return NextResponse.json(
      { ok: false, error: selectErr.message },
      { status: 500 }
    );
  }

  const intents = (intentRows ?? []) as IntentRow[];
  if (intents.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No pending intents to reconcile",
      checked: 0,
    });
  }

  const summary = {
    checked: intents.length,
    recovered: 0, // success → order yaratıldı
    failed: 0, // PayTR fail → intent abandoned
    waiting: 0, // hala ödeme bekleyenlerin sayısı
    errors: 0, // ağ/API hataları
  };

  for (const intent of intents) {
    try {
      const queryResult = await queryPaymentStatus(intent.id);

      if (!queryResult.ok) {
        summary.errors += 1;
        Sentry.captureMessage(
          `paytr_reconciler.query_failed: ${intent.id} — ${queryResult.reason}`,
          { tags: { scope: "paytr_reconciler", merchant_oid: intent.id } }
        );
        continue;
      }

      // Waiting → henüz tamamlanmadı, bir sonraki cron'a bırak
      if (queryResult.status === "waiting") {
        summary.waiting += 1;
        continue;
      }

      // Failed → intent abandoned
      if (queryResult.status === "failed") {
        await admin
          .from("payment_intents")
          .update({
            status: "failed",
            failure_reason:
              `[reconciler] ${queryResult.reason ?? "paytr_failed"}`.slice(
                0,
                200
              ),
          })
          .eq("id", intent.id)
          .eq("status", "pending"); // optimistic lock
        summary.failed += 1;
        continue;
      }

      // Success → order yaratılmamış demek (IPN miss). fn_finalize_paid_order
      // idempotent (intent.status='consumed' guard), güvenli.
      if (queryResult.status === "success") {
        const snapshot = intent.snapshot;
        if (
          !snapshot ||
          !Array.isArray(snapshot.items) ||
          snapshot.items.length === 0
        ) {
          // Snapshot bozuk — manual müdahale gerek
          Sentry.captureMessage(
            `paytr_reconciler.snapshot_invalid: ${intent.id}`,
            {
              tags: { scope: "paytr_reconciler", merchant_oid: intent.id },
            }
          );
          summary.errors += 1;
          continue;
        }

        const paymentMeta = {
          source: "paytr_reconciler",
          payment_amount_kurus: queryResult.paymentAmountKurus,
          payment_total_kurus: queryResult.paymentTotalKurus,
          installment: queryResult.installmentCount,
          recovered_at: new Date().toISOString(),
        };

        // Tahmini teslim 7 gün (mevcut callback ile aynı)
        const estimatedDelivery = new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        )
          .toISOString()
          .split("T")[0];

        const { data: finalizeResult, error: rpcErr } = await admin.rpc(
          "fn_finalize_paid_order",
          {
            p_merchant_oid: intent.id,
            p_order_id: "RECONCILER", // sequence override edilir (Mig 065)
            p_items: snapshot.items as Json,
            p_payment_meta: paymentMeta as Json,
            p_estimated_delivery: estimatedDelivery,
          }
        );

        if (rpcErr) {
          Sentry.captureException(rpcErr, {
            tags: { scope: "paytr_reconciler.finalize", merchant_oid: intent.id },
          });
          summary.errors += 1;
          continue;
        }

        summary.recovered += 1;
        const recoveredOrderId =
          (finalizeResult as Array<{ order_id: string }> | null)?.[0]
            ?.order_id ?? null;
        console.log(
          `[paytr_reconciler] recovered: intent=${intent.id} → order=${recoveredOrderId}`
        );

        // Sefa 20 May v68 (P0 #3): Recover edilen sipariş için mail
        // gönder — callback ile aynı pattern. Müşteri tarayıcısı kapalıydı
        // veya webhook miss oldu, sipariş onay maili yok → şimdi gönder.
        if (recoveredOrderId) {
          void sendOrderConfirmation({
            userId: intent.user_id,
            orderId: recoveredOrderId,
          }).catch((err) =>
            console.error(
              "[paytr_reconciler] order_confirmation mail failed:",
              err
            )
          );
          void sendOrderProofRequired({
            userId: intent.user_id,
            orderId: recoveredOrderId,
          }).catch((err) =>
            console.error(
              "[paytr_reconciler] proof_required mail failed:",
              err
            )
          );
        }
      }
    } catch (err) {
      summary.errors += 1;
      Sentry.captureException(err, {
        tags: { scope: "paytr_reconciler", merchant_oid: intent.id },
      });
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
