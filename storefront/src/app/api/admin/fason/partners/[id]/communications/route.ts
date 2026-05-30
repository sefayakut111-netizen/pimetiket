/**
 * GET/POST/PATCH/DELETE /api/admin/fason/partners/[id]/communications
 *
 * partner_communications CRUD (admin fason iletisim gecmisi).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

const CHANNELS = ["whatsapp", "email", "phone", "other"] as const;

const CreateSchema = z.object({
  channel: z.enum(CHANNELS),
  summary: z.string().min(1).max(2000),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  channel: z.enum(CHANNELS).optional(),
  summary: z.string().min(1).max(2000).optional(),
});

const DeleteSchema = z.object({
  id: z.string().uuid(),
});

async function assertPartnerExists(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data } = await admin
    .from("fason_partners")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  return !!data;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("fason", "view");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  if (!(await assertPartnerExists(admin, id))) {
    return NextResponse.json({ error: "partner_not_found" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("partner_communications")
    .select("id, partner_id, channel, summary, created_by, created_at")
    .eq("partner_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ communications: data ?? [] });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("fason", "update");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
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
  if (!(await assertPartnerExists(admin, id))) {
    return NextResponse.json({ error: "partner_not_found" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("partner_communications")
    .insert({
      partner_id: id,
      channel: parsed.data.channel,
      summary: parsed.data.summary.trim(),
      created_by: auth.user.id,
    })
    .select("id, partner_id, channel, summary, created_by, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ communication: data }, { status: 201 });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("fason", "update");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const patch: { channel?: string; summary?: string } = {};
  if (parsed.data.channel) patch.channel = parsed.data.channel;
  if (parsed.data.summary) patch.summary = parsed.data.summary.trim();
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("partner_communications")
    .update(patch)
    .eq("id", parsed.data.id)
    .eq("partner_id", id)
    .select("id, partner_id, channel, summary, created_by, created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ communication: data });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("fason", "update");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = DeleteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error, count } = await admin
    .from("partner_communications")
    .delete({ count: "exact" })
    .eq("id", parsed.data.id)
    .eq("partner_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
