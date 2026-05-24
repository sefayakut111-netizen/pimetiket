/**
 * /api/admin/customers/[id]/notes
 *
 * Müşteri kartına operatör internal note ekle / sil. Sefa 23 May v68
 * (P0 #4 — Grup D). Bu dosya daha önce CSV export handler'ının
 * kopyasıydı; UI "not ekle" butonu CSV indiriyordu.
 *
 * UI sözleşmesi (src/app/admin/musteriler/[id]/page.tsx):
 *   POST   { body: string, pinned: boolean }       → { ok, error? }
 *   DELETE ?noteId=<uuid>                          → { ok }
 *
 * Şema: Mig 046 customer_notes (user_id, author_id, author_name,
 *       body, pinned, created_at, updated_at). RLS: admin/staff full
 *       access. Service-role client zaten RLS bypass — audit Postgres
 *       tarafında değil, app tarafında atılıyor.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const PostBodySchema = z.object({
  body: z.string().trim().min(1, "Not boş olamaz").max(4000),
  pinned: z.boolean().default(false),
});

function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
function userAgent(req: Request): string | null {
  return req.headers.get("user-agent") ?? null;
}

// ---------------------------------------------------------------------
// POST — yeni not ekle
// ---------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdmin();
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
  const { body, pinned } = parsed.data;

  const admin = createAdminClient();

  const { error } = await admin.from("customer_notes").insert([
    {
      user_id: id,
      author_id: auth.user.id,
      author_name: auth.user.email ?? null,
      body,
      pinned,
    },
  ] as never);

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
        action: "customer.note_add",
        target_type: "user",
        target_id: id,
        summary: `Müşteriye not eklendi (${pinned ? "pinned" : "normal"})`,
        detail: { body_preview: body.slice(0, 100), pinned },
        ip_address: clientIp(req),
        user_agent: userAgent(req),
      },
    ] as never);
  } catch {
    /* audit log error silent */
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------
// DELETE — not sil (?noteId=<uuid>)
// ---------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const noteId = url.searchParams.get("noteId")?.trim();
  if (!noteId) {
    return NextResponse.json(
      { error: "noteId_required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("customer_notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", id);

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
        action: "customer.note_delete",
        target_type: "user",
        target_id: id,
        summary: `Müşteri notu silindi: ${noteId}`,
        detail: { note_id: noteId },
        ip_address: clientIp(req),
        user_agent: userAgent(req),
      },
    ] as never);
  } catch {
    /* audit log error silent */
  }

  return NextResponse.json({ ok: true });
}
