/**
 * POST   /api/admin/customers/[id]/tags  — Tag ekle
 * DELETE /api/admin/customers/[id]/tags?tag=...  — Tag sil
 *
 * Body POST: { tag: string }
 *
 * Tag format: 2-40 karakter, lowercase, alphanumeric + dash/underscore.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/supabase/assert-admin";

function normalizeTag(input: string): string | null {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (cleaned.length < 2 || cleaned.length > 40) return null;
  return cleaned;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { tag?: string };
  const tag = normalizeTag(body.tag ?? "");
  if (!tag) {
    return NextResponse.json(
      { error: "invalid_tag", hint: "2-40 karakter, sade etiket" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("customer_tags")
    .upsert(
      [
        {
          user_id: id,
          tag,
          created_by: auth.user.id,
        },
      ] as never,
      { onConflict: "user_id,tag" }
    );

  if (error) {
    return NextResponse.json(
      { error: "upsert_failed", detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, tag });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const tag = url.searchParams.get("tag");
  if (!tag) {
    return NextResponse.json({ error: "tag required" }, { status: 400 });
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
  return NextResponse.json({ ok: true });
}
