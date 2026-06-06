/**
 * POST /api/admin/test/simulate-checkout — sipariş akışını tamamen simüle et
 * POST /api/admin/test/simulate-checkout?cleanup=1 — test verilerini sil
 *
 * Sadece admin. Çıktı: { ok, steps[], total_duration_ms }
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import {
  runCheckoutSimulation,
  cleanupSimulatorData,
} from "@/lib/test-simulator";

function simulateCheckoutBlocked(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.VERCEL_ENV === "production") return true;
  return false;
}

export async function POST(req: Request) {
  if (simulateCheckoutBlocked()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await assertPermission("manual_order", "create");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const isCleanup = url.searchParams.get("cleanup") === "1";

  if (isCleanup) {
    try {
      const result = await cleanupSimulatorData();
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      return NextResponse.json(
        {
          error: "cleanup_failed",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }
  }

  try {
    const result = await runCheckoutSimulation(auth.user.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "simulation_crashed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
