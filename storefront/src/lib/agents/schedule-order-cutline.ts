/**
 * QC sonrası server-side cutline — Vercel-safe arka plan.
 */

import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { runOrderCutlineGeneration } from "./run-order-cutline";

function runCutlineBackground(
  admin: SupabaseClient<Database>,
  orderId: string
): void {
  void runOrderCutlineGeneration(admin, orderId).catch((err) => {
    console.error("[schedule-order-cutline] failed:", orderId, err);
  });
}

export function scheduleOrderCutlineGeneration(
  admin: SupabaseClient<Database>,
  orderId: string
): void {
  try {
    after(async () => {
      await runOrderCutlineGeneration(admin, orderId);
    });
  } catch (err) {
    console.warn(
      "[schedule-order-cutline] after() unavailable, inline fallback:",
      err
    );
    runCutlineBackground(admin, orderId);
  }
}
