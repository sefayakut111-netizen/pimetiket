/**
 * PayTR Durum Sorgu gecikmesi: ödeme tamamlandıktan hemen sonra "waiting"
 * dönebilir. Browser dönüşü ve /api/payment/status polling'de kısa retry.
 */

import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import {
  recoverPendingPaymentIntent,
  type RecoverPendingResult,
} from "./recover-pending-intent";

type AdminClient = ReturnType<typeof createAdminClient>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function recoverPendingPaymentIntentWithRetries(
  admin: AdminClient,
  merchantOid: string,
  opts?: {
    userId?: string;
    maxAttempts?: number;
    delayMs?: number;
  }
): Promise<RecoverPendingResult> {
  const maxAttempts = opts?.maxAttempts ?? 5;
  const delayMs = opts?.delayMs ?? 1500;

  let last: RecoverPendingResult = { status: "pending" };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    last = await recoverPendingPaymentIntent(admin, merchantOid, {
      userId: opts?.userId,
    });

    if (last.status === "consumed" || last.status === "failed") {
      return last;
    }
    if (last.status === "not_found") {
      return last;
    }

    if (attempt < maxAttempts - 1) {
      await sleep(delayMs);
    }
  }

  return last;
}
