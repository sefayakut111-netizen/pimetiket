/**
 * POST/DELETE /api/admin/mail-suppressions
 *
 * Sefa 21 May v68 — Admin manuel suppression yönetimi.
 *
 * POST body: { email, type?, blockedCategories?, reason? }
 *   - email zorunlu
 *   - type default "manual_admin"
 *   - blockedCategories yoksa tüm kategoriler bloklanır
 *
 * DELETE body: { id } | { email, type }
 *   - Suppression kaydını siler (kullanıcı tekrar mail almaya başlar)
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  recordSuppression,
  type SuppressionType,
  type MailCategory,
} from "@/lib/mail/suppression";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AddBody {
  email?: string;
  type?: SuppressionType;
  blockedCategories?: MailCategory[];
  reason?: string;
}

export async function POST(req: Request) {
  const auth = await assertPermission("mail_health", "create");
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 }
    );
  }

  let body: AddBody;
  try {
    body = (await req.json()) as AddBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 }
    );
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400 }
    );
  }

  const result = await recordSuppression({
    email,
    type: body.type ?? "manual_admin",
    reason: body.reason ?? `admin:${auth.user.id}`,
    blockedCategories: body.blockedCategories,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: result.id });
}

interface DeleteBody {
  id?: string;
  email?: string;
  type?: SuppressionType;
}

export async function DELETE(req: Request) {
  const auth = await assertPermission("mail_health", "delete");
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 }
    );
  }

  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  let query = admin.from("mail_suppressions").delete();

  if (body.id) {
    query = query.eq("id", body.id);
  } else if (body.email && body.type) {
    query = query
      .eq("email", body.email.toLowerCase().trim())
      .eq("suppression_type", body.type);
  } else {
    return NextResponse.json(
      { ok: false, error: "missing_id_or_email_type" },
      { status: 400 }
    );
  }

  const { error } = await query;
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
