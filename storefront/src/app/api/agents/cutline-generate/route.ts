import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runOrderCutlineGeneration } from "@/lib/agents/run-order-cutline";
import { assertCronAuth } from "@/lib/cron-auth";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const guard = assertCronAuth(req);
  if (guard) return guard;

  let body: { orderId?: string };
  try {
    body = (await req.json()) as { orderId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const result = await runOrderCutlineGeneration(admin, body.orderId);

  return NextResponse.json({
    ok: true,
    generated: result.generated,
    failed: result.failed,
  });
}
