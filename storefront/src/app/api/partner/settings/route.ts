/**
 * GET / PATCH — partner ayarları (profil + bildirim tercihleri)
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePartnerContext } from "@/lib/supabase/partner-auth";
import type { Database } from "@/lib/supabase/types";
import { z } from "zod";

export const runtime = "nodejs";

const CAP_LABEL: Record<string, string> = {
  sticker: "Sticker",
  roll_label: "Rulo Etiket",
  sheet_label: "Tabaka Etiket",
  paper: "Kağıt",
  transparent: "Şeffaf",
  metallic: "Metalize",
  holographic: "Holografik",
};

const PatchSchema = z.object({
  contact: z
    .object({
      name: z.string().min(2).max(100).optional(),
      phone: z.string().min(10).max(20).optional(),
      email: z.string().email().optional(),
    })
    .optional(),
  notifications: z
    .object({
      emailOnAssign: z.boolean().optional(),
      smsOnUrgent: z.boolean().optional(),
    })
    .optional(),
});

function phoneFromE164(e164: string): string {
  let d = e164.replace(/\D/g, "");
  if (d.startsWith("90") && d.length >= 12) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  return d.length === 10 ? `+90${d}` : raw;
}

export async function GET() {
  const ctx = await resolvePartnerContext();
  if (!ctx) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (ctx.isGenericPreview) {
    return NextResponse.json({
      preview: true,
      company: { name: "Önizleme Partneri" },
      contact: { name: "—", email: "—", phone: "" },
      capabilities: { productTypes: [], materials: [] },
      notifications: { emailOnAssign: true, smsOnUrgent: false },
    });
  }

  const admin = createAdminClient();
  const partnerId = ctx.partnerId!;

  const { data: partnerRow } = await admin
    .from("fason_partners")
    .select(
      "name, tax_number, tax_office, address_line, city, town, notify_email_on_assign, notify_sms_on_urgent"
    )
    .eq("id", partnerId)
    .maybeSingle();

  type PartnerRow = {
    name: string;
    tax_number: string | null;
    tax_office: string | null;
    address_line: string | null;
    city: string | null;
    town: string | null;
    notify_email_on_assign?: boolean | null;
    notify_sms_on_urgent?: boolean | null;
  };
  const partner = partnerRow as PartnerRow | null;
  if (!partner) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: contactRow } = await admin
    .from("partner_contacts")
    .select("id, name, email, phone_e164, role")
    .eq("partner_id", partnerId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  type ContactRow = {
    id: string;
    name: string;
    email: string;
    phone_e164: string;
    role: string;
  };
  let contact = contactRow as ContactRow | null;
  if (!contact) {
    const { data: ownerRow } = await admin
      .from("partner_contacts")
      .select("id, name, email, phone_e164, role")
      .eq("partner_id", partnerId)
      .eq("role", "owner")
      .maybeSingle();
    contact = ownerRow as ContactRow | null;
  }

  const { data: caps } = await admin
    .from("partner_capabilities")
    .select("capability_type, capability_value")
    .eq("partner_id", partnerId);

  const productTypes: string[] = [];
  const materials: string[] = [];
  for (const c of (caps ?? []) as Array<{
    capability_type: string;
    capability_value: string;
  }>) {
    if (c.capability_type === "product_type") {
      productTypes.push(CAP_LABEL[c.capability_value] ?? c.capability_value);
    } else if (c.capability_type === "material") {
      materials.push(CAP_LABEL[c.capability_value] ?? c.capability_value);
    }
  }

  return NextResponse.json({
    company: {
      name: partner.name,
      taxNumber: partner.tax_number,
      taxOffice: partner.tax_office,
      addressLine: partner.address_line,
      city: partner.city,
      town: partner.town,
    },
    contact: contact
      ? {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: phoneFromE164(contact.phone_e164),
        }
      : null,
    capabilities: { productTypes, materials },
    notifications: {
      emailOnAssign: partner.notify_email_on_assign !== false,
      smsOnUrgent: partner.notify_sms_on_urgent === true,
    },
  });
}

export async function PATCH(req: Request) {
  const ctx = await resolvePartnerContext();
  if (!ctx) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (ctx.isGenericPreview) {
    return NextResponse.json(
      { error: "preview_readonly" },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  const body = parsed.data;
  const admin = createAdminClient();
  const partnerId = ctx.partnerId!;

  if (body.notifications) {
    const patch: Database["public"]["Tables"]["fason_partners"]["Update"] = {};
    if (body.notifications.emailOnAssign !== undefined) {
      patch.notify_email_on_assign = body.notifications.emailOnAssign;
    }
    if (body.notifications.smsOnUrgent !== undefined) {
      patch.notify_sms_on_urgent = body.notifications.smsOnUrgent;
    }
    if (Object.keys(patch).length > 0) {
      await admin.from("fason_partners").update(patch).eq("id", partnerId);
    }
  }

  if (body.contact) {
    const { data: contactRow } = await admin
      .from("partner_contacts")
      .select("id")
      .eq("partner_id", partnerId)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    const contactId = (contactRow as { id: string } | null)?.id;
    if (contactId) {
      const upd: Database["public"]["Tables"]["partner_contacts"]["Update"] = {};
      if (body.contact.name) upd.name = body.contact.name.trim();
      if (body.contact.email) upd.email = body.contact.email.trim().toLowerCase();
      if (body.contact.phone) upd.phone_e164 = normalizePhone(body.contact.phone);
      if (Object.keys(upd).length > 0) {
        await admin.from("partner_contacts").update(upd).eq("id", contactId);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
