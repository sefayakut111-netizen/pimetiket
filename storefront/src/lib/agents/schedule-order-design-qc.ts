/**
 * PayTR callback / upload-complete sonrası QC — Vercel-safe arka plan.
 *
 * setTimeout serverless'ta yanıt sonrası çalışmaz; Next.js `after()` ile
 * "OK" döndükten sonra lambda süresi uzatılır.
 */

import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runOrderDesignQC } from "./run-order-qc";

export function scheduleOrderDesignQC(
  admin: SupabaseClient,
  orderId: string
): void {
  after(async () => {
    try {
      await runOrderDesignQC(admin, orderId);
    } catch (err) {
      console.error("[schedule-order-design-qc] failed:", orderId, err);
    }
  });
}
