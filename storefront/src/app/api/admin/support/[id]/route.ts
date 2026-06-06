import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueMail } from "@/lib/mail/enqueue";
import type { Database } from "@/lib/supabase/types";

export const runtime = "nodejs";

type SupportUpdate = Database["public"]["Tables"]["support_tickets"]["Update"];

const VALID_STATUS = [
  "open",
  "in_progress",
  "waiting_customer",
  "resolved",
  "closed",
] as const;

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("help_requests", "update");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json()) as {
    admin_response?: string;
    status?: string;
    accept_ai_suggestions?: boolean;
    category?: string;
    priority?: string;
  };

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!ticket) {
    return NextResponse.json({ ok: false, error: "Bulunamadı" }, { status: 404 });
  }

  const patch: SupportUpdate = {};

  if (body.accept_ai_suggestions) {
    const aiCat = ticket.ai_category_suggestion as string | null;
    const aiPri = ticket.ai_priority_suggestion as string | null;
    if (
      aiCat &&
      VALID_CATEGORIES.includes(aiCat as (typeof VALID_CATEGORIES)[number])
    ) {
      patch.category = aiCat;
    }
    if (
      aiPri &&
      VALID_PRIORITIES.includes(aiPri as (typeof VALID_PRIORITIES)[number])
    ) {
      patch.priority = aiPri;
    }
  }

  if (
    body.category &&
    VALID_CATEGORIES.includes(body.category as (typeof VALID_CATEGORIES)[number])
  ) {
    patch.category = body.category;
  }
  if (
    body.priority &&
    VALID_PRIORITIES.includes(body.priority as (typeof VALID_PRIORITIES)[number])
  ) {
    patch.priority = body.priority;
  }

  if (body.admin_response?.trim()) {
    patch.admin_response = body.admin_response.trim();
    patch.admin_responded_by = auth.user.id;
    patch.admin_responded_at = new Date().toISOString();
  }
  if (body.status && VALID_STATUS.includes(body.status as (typeof VALID_STATUS)[number])) {
    patch.status = body.status;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "Güncellenecek alan yok" }, {
      status: 400,
    });
  }

  const { data, error } = await admin
    .from("support_tickets")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (patch.admin_response && data) {
    let recipient = data.guest_email as string | null;
    if (!recipient && data.user_id) {
      try {
        const { data: u } = await admin.auth.admin.getUserById(data.user_id);
        recipient = u?.user?.email ?? null;
      } catch {
        /* skip */
      }
    }
    if (recipient) {
      const responseText = String(patch.admin_response);
      await enqueueMail({
        templateKey: "_prerendered",
        to: recipient,
        category: "customer",
        targetType: "user",
        targetId: data.user_id ?? undefined,
        subject: `Destek talebiniz yanıtlandı — ${data.subject}`,
        payload: {
          subject: `Destek talebiniz yanıtlandı — ${data.subject}`,
          html: `<p>Merhaba,</p><p>Destek talebinize yanıt:</p><blockquote>${responseText.replace(/\n/g, "<br>")}</blockquote><p>Pim Etiket</p>`,
          text: `Destek yanıtı:\n\n${responseText}`,
        },
        idempotencyKey: `support_response:${id}:${data.admin_responded_at}`,
      });
    }
  }

  return NextResponse.json({ ok: true, ticket: data });
}
