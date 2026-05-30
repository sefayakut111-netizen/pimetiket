/**
 * GET/POST /api/admin/customers/[id]/activity-log
 *
 * Operatör manuel müşteri iletişim kayıtları (customer_activity_log).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

const CHANNELS = ["phone", "whatsapp", "email", "note"] as const;

const CreateSchema = z.object({
  channel: z.enum(CHANNELS),
  summary: z.string().min(1).max(2000),
});

async function assertCustomerExists(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
) {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  return !!data;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("customers", "view");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: customerId } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("customer_activity_log")
    .select("id, customer_id, channel, summary, created_by, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activities: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("customers", "update");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: customerId } = await params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  if (!(await assertCustomerExists(admin, customerId))) {
    return NextResponse.json({ error: "customer_not_found" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("customer_activity_log")
    .insert({
      customer_id: customerId,
      channel: parsed.data.channel,
      summary: parsed.data.summary.trim(),
      created_by: auth.user.id,
    })
    .select("id, customer_id, channel, summary, created_by, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activity: data }, { status: 201 });
}
