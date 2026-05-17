/**
 * POST   /api/admin/customers/[id]/notes  — Yeni not ekle
 * DELETE /api/admin/customers/[id]/notes?noteId=...  — Notu sil
 *
 * Body POST: { body: string, pinned?: boolean }
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    body?: string;
    pinned?: boolean;
  };
  const text = (body.body ?? "").trim();
  if (text.length < 2 || text.length > 4000) {
    return NextResponse.json(
      { error: "invalid_body", hint: "2-4000 karakter" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("customer_notes")
    .insert([
      {
        user_id: id,
        author_id: auth.user.id,
        author_name: auth.user.email ?? "admin",
        body: text,
        pinned: !!body.pinned,
      },
    ] as never)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "insert_failed", detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, note: data });
}

export async function DELETE(
  req: Request,
  _ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const noteId = url.searchParams.get("noteId");
  if (!noteId) {
    return NextResponse.json({ error: "noteId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("customer_notes")
    .delete()
    .eq("id", noteId);

  if (error) {
    return NextResponse.json(
      { error: "delete_failed", detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
