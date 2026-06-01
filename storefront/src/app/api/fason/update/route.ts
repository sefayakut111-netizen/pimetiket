/**
 * POST /api/fason/update
 *
 * Fason web form'undan durum güncellemesi.
 *
 * Body: {
 *   token: string,
 *   action: 'acknowledge' | 'in_production' | 'ready' | 'shipped' | 'issue',
 *   issue?: { category, description, photoStoragePath? },
 *   tracking?: { company, number, url? }
 * }
 *
 * Public endpoint (auth: token).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  applyAssignmentAction,
  VALID_FASON_ACTIONS,
  type FasonAction,
} from "@/lib/fason/apply-assignment-action";

export const dynamic = "force-dynamic";

interface BodyShape {
  token?: unknown;
  action?: unknown;
  issue?: {
    category?: unknown;
    description?: unknown;
    photoStoragePath?: unknown;
  };
  tracking?: {
    company?: unknown;
    number?: unknown;
    url?: unknown;
  };
}

export async function POST(req: Request) {
  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const actionStr = typeof body.action === "string" ? body.action : "";

  if (!token || !VALID_FASON_ACTIONS.includes(actionStr as FasonAction)) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const action = actionStr as FasonAction;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Sunucu yapılandırması" }, { status: 500 });
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: validateData } = await admin.rpc(
    "fn_validate_fason_token",
    { p_token: token }
  );
  const validation = (validateData as Array<{
    assignment_id: string;
    fason_partner_id: string;
    order_id: string;
    is_valid: boolean;
    reason: string;
  }>)?.[0];

  if (!validation?.is_valid) {
    const status =
      validation?.reason === "token_limit_exceeded" ? 403 : 401;
    return NextResponse.json(
      { error: "Token geçersiz", reason: validation?.reason ?? "unknown" },
      { status }
    );
  }

  const result = await applyAssignmentAction(admin, {
    assignmentId: validation.assignment_id,
    orderId: validation.order_id,
    action,
    body: { issue: body.issue, tracking: body.tracking },
    actorRole: "fason",
    via: "fason_form",
    accessLog: {
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent"),
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, newStatus: result.newStatus });
}
