/**
 * POST /api/partner/settings/verify-email
 * Body: { code: string } — pending e-posta değişikliğini doğrular.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePartnerContext } from "@/lib/supabase/partner-auth";
import { confirmPartnerEmailVerification } from "@/lib/fason/partner-email-verify";

export const runtime = "nodejs";

const BodySchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  const ctx = await resolvePartnerContext();
  if (!ctx) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (ctx.isPreview || ctx.isGenericPreview) {
    return NextResponse.json({ error: "preview_readonly" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const admin = createAdminClient();
  const partnerId = ctx.partnerId!;

  const { data: contactRow } = await admin
    .from("partner_contacts")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  let contactId = (contactRow as { id: string } | null)?.id;
  if (!contactId) {
    const { data: ownerRow } = await admin
      .from("partner_contacts")
      .select("id")
      .eq("partner_id", partnerId)
      .eq("role", "owner")
      .maybeSingle();
    contactId = (ownerRow as { id: string } | null)?.id;
  }
  if (!contactId) {
    return NextResponse.json({ error: "contact_not_found" }, { status: 404 });
  }

  const result = await confirmPartnerEmailVerification(
    admin,
    contactId,
    parsed.data.code
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({ ok: true, email: result.email });
}
