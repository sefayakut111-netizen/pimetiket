/**
 * /api/admin/customers/[id]/tags
 *
 * Müşteri Shopify-style tag ekle / sil. Sefa 23 May v68
 * (P0 #4 — Grup D). Bu dosya daha önce CSV export handler'ının
 * kopyasıydı; UI "tag ekle / vip toggle" butonu CSV indiriyordu.
 *
 * UI sözleşmesi (src/app/admin/musteriler/[id]/page.tsx):
 *   POST   { tag: string }          → { ok, tag, error? }
 *   DELETE ?tag=<text>              → { ok }
 *
 * Tag normalize: trim + lowercase. Boş → 400. Max 50 karakter.
 * UNIQUE (user_id, tag) → upsert ile idempotent insert.
 *
 * Şema referansı: Mig 046 customer_tags.
 */

import { NextResponse, type NextRequest } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";

export const runtime = "nodejs";

const PostBodySchema = z.object({
  tag: z.string().min(1).max(50),
});

function normalizeTag(input: string): string {
  return input.trim().toLowerCase();
}

function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
function userAgent(req: Request): string | null {
  return req.headers.get("user-agent") ?? null;
}

// ---------------------------------------------------------------------
// POST — tag ekle
// ---------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("customers", "update");
  if (!auth) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const raw = await req.json().catch(() => ({}));
  const parsed = PostBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", detail: parsed.error.message },
      { status: 400 }
    );
  }

  const tag = normalizeTag(parsed.data.tag);
  if (!tag) {
    return NextResponse.json({ error: "empty_tag" }, { status: 400 });
  }
  if (tag.length > 50) {
    return NextResponse.json({ error: "tag_too_long" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotent — UNIQUE (user_id, tag) constraint var
  const { error } = await admin.from("customer_tags").upsert(
    [
      {
        user_id: id,
        tag,
        created_by: auth.user.id,
      },
    ],
    { onConflict: "user_id,tag", ignoreDuplicates: true }
  );

  if (error) {
    return NextResponse.json(
      { error: "insert_failed", detail: error.message },
      { status: 500 }
    );
  }

  try {
    await admin.from("audit_log").insert([
      {
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        actor_role: "admin",
        action: "customer.tag_add" as Enums<"audit_action">,
        target_type: "user",
        target_id: id,
        summary: `Müşteriye tag eklendi: ${tag}`,
        detail: { tag },
        ip_address: clientIp(req),
        user_agent: userAgent(req),
      },
    ]);
  } catch {
    /* audit log error silent */
  }

  return NextResponse.json({ ok: true, tag });
}

// ---------------------------------------------------------------------
// DELETE — tag kaldır (?tag=<text>)
// ---------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("customers", "update");
  if (!auth) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const rawTag = url.searchParams.get("tag") ?? "";
  const tag = normalizeTag(rawTag);
  if (!tag) {
    return NextResponse.json({ error: "tag_required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("customer_tags")
    .delete()
    .eq("user_id", id)
    .eq("tag", tag);

  if (error) {
    return NextResponse.json(
      { error: "delete_failed", detail: error.message },
      { status: 500 }
    );
  }

  try {
    await admin.from("audit_log").insert([
      {
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        actor_role: "admin",
        action: "customer.tag_remove" as Enums<"audit_action">,
        target_type: "user",
        target_id: id,
        summary: `Müşteriden tag kaldırıldı: ${tag}`,
        detail: { tag },
        ip_address: clientIp(req),
        user_agent: userAgent(req),
      },
    ]);
  } catch {
    /* audit log error silent */
  }

  return NextResponse.json({ ok: true });
}
