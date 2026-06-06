import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { scheduleSupportClassify } from "@/lib/support/schedule-classify";

export const runtime = "nodejs";

type SupportInsert = Database["public"]["Tables"]["support_tickets"]["Insert"];

const VALID_CATEGORIES = [
  "genel",
  "siparis",
  "tasarim",
  "kargo",
  "iade",
  "teknik",
  "fiyat",
] as const;

const VALID_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export async function GET(req: Request) {
  const auth = await assertPermission("help_requests", "view");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "open";

  const admin = createAdminClient();
  let query = admin
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status === "open") {
    query = query.in("status", ["open", "in_progress", "waiting_customer"]);
  } else if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const tickets = data ?? [];
  const userIds = [
    ...new Set(tickets.map((t) => t.user_id).filter(Boolean)),
  ] as string[];

  const emailByUser = new Map<string, string>();
  for (const uid of userIds) {
    try {
      const { data: u } = await admin.auth.admin.getUserById(uid);
      if (u?.user?.email) emailByUser.set(uid, u.user.email);
    } catch {
      /* skip */
    }
  }

  const items = tickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    message: t.message,
    category: t.category,
    priority: t.priority ?? "normal",
    status: t.status,
    orderId: t.order_id,
    customerName: t.guest_name ?? null,
    customerEmail: t.user_id
      ? emailByUser.get(t.user_id) ?? null
      : t.guest_email,
    adminResponse: t.admin_response,
    adminRespondedAt: t.admin_responded_at,
    aiCategorySuggestion: t.ai_category_suggestion,
    aiPrioritySuggestion: t.ai_priority_suggestion,
    aiDraftResponse: t.ai_draft_response,
    aiClassifiedAt: t.ai_classified_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));

  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const auth = await assertPermission("help_requests", "create");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: {
    subject?: string;
    message?: string;
    category?: string;
    order_id?: string;
    user_id?: string;
    guest_email?: string;
    guest_name?: string;
    priority?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const rawSubject = body.subject?.trim();
  const message = body.message?.trim();
  if (!rawSubject || !message) {
    return NextResponse.json(
      { ok: false, error: "Konu ve mesaj zorunlu" },
      { status: 400 }
    );
  }

  const priority = VALID_PRIORITIES.includes(
    body.priority as (typeof VALID_PRIORITIES)[number]
  )
    ? body.priority!
    : "normal";
  const subject = rawSubject;

  const category = VALID_CATEGORIES.includes(
    body.category as (typeof VALID_CATEGORIES)[number]
  )
    ? body.category!
    : "genel";

  const admin = createAdminClient();
  const row: SupportInsert = body.user_id
    ? {
        user_id: body.user_id,
        subject,
        message,
        category,
        priority,
        order_id: body.order_id?.trim() || null,
        status: "open",
      }
    : {
        guest_email: body.guest_email?.trim().toLowerCase() || null,
        guest_name: body.guest_name?.trim() || null,
        subject,
        message,
        category,
        priority,
        order_id: body.order_id?.trim() || null,
        status: "open",
      };

  if (!body.user_id && !row.guest_email) {
    return NextResponse.json(
      { ok: false, error: "Müşteri veya e-posta zorunlu" },
      { status: 400 }
    );
  }

  const { data, error } = await admin
    .from("support_tickets")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("[admin/support] create:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  scheduleSupportClassify(data.id);

  return NextResponse.json({ ok: true, id: data.id });
}
