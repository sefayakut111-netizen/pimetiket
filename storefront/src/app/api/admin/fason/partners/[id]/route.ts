/**
 * GET / PATCH — tek üretim partneri (düzenleme formu)
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const phoneRegex = /^(\+90)?5\d{9}$/;

function normalizePhoneE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+9${digits}`;
  if (digits.length === 10) return `+90${digits}`;
  return raw;
}

const ContactSchema = z.object({
  name: z.string().min(3).max(100),
  title: z.string().max(80).optional(),
  email: z.string().email(),
  phone: z.string().regex(phoneRegex, "Telefon +90 dahil veya 10 rakam"),
  autoNotify: z.boolean().optional(),
});

const UpdatePartnerSchema = z.object({
  name: z.string().min(2).max(150),
  shortName: z.string().max(40).optional(),
  taxNumber: z
    .string()
    .regex(/^\d{10,11}$/)
    .optional()
    .or(z.literal("")),
  taxOffice: z.string().max(80).optional(),
  addressLine: z.string().max(200).optional(),
  city: z.string().min(2).max(50),
  town: z.string().min(2).max(50),
  status: z.enum(["active", "paused"]),

  productTypes: z
    .array(z.enum(["roll_label", "sheet_label", "sticker"]))
    .min(1),
  materials: z
    .array(z.enum(["paper", "transparent", "metallic", "holographic"]))
    .optional(),
  defaultLeadTimeDays: z.number().int().min(1).max(30),
  expressLeadTimeDays: z.number().int().min(1).max(7).optional().nullable(),
  minOrderAmountTry: z.number().min(0).optional().nullable(),

  paymentTerm: z.enum(["cash", "net_15", "net_30", "net_60"]).optional(),
  iban: z
    .string()
    .regex(/^TR\d{24}$/, "TR + 24 hane IBAN bekleniyor")
    .optional()
    .or(z.literal("")),

  owner: ContactSchema,
  operator: ContactSchema.extend({
    autoNotify: z.boolean().default(true),
  }),
  accounting: ContactSchema.partial().optional(),

  notes: z.string().max(1000).optional(),
});

type PartnerDetailRow = {
  id: string;
  name: string;
  short_name: string | null;
  tax_number: string | null;
  tax_office: string | null;
  address_line: string | null;
  city: string | null;
  town: string | null;
  status: string;
  status_reason: string | null;
  default_lead_days: number;
  express_lead_time_days: number | null;
  min_order_amount_try: number | null;
  payment_term: string | null;
  iban: string | null;
  contract_pdf_url: string | null;
  contract_uploaded_at: string | null;
  notes: string | null;
  contact_email: string | null;
  created_at: string;
};

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await assertPermission("fason", "view");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();

  const { data: partner, error: pErr } = await admin
    .from("fason_partners")
    .select(
      "id, name, short_name, tax_number, tax_office, address_line, city, town, " +
        "status, status_reason, default_lead_days, express_lead_time_days, " +
        "min_order_amount_try, payment_term, iban, contract_pdf_url, " +
        "contract_uploaded_at, notes, contact_email, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  if (!partner) {
    return NextResponse.json({ error: "Partner bulunamadı" }, { status: 404 });
  }

  const row = partner as unknown as PartnerDetailRow;

  const { data: contacts } = await admin
    .from("partner_contacts")
    .select("role, name, title, email, phone_e164, auto_notification")
    .eq("partner_id", id);

  const { data: capabilities } = await admin
    .from("partner_capabilities")
    .select("id, capability_type, capability_value, is_verified")
    .eq("partner_id", id);

  return NextResponse.json({
    partner: {
      id: row.id,
      name: row.name,
      short_name: row.short_name,
      tax_number: row.tax_number,
      tax_office: row.tax_office,
      address_line: row.address_line,
      city: row.city,
      town: row.town,
      status: row.status,
      status_reason: row.status_reason,
      default_lead_days: row.default_lead_days,
      express_lead_time_days: row.express_lead_time_days,
      min_order_amount_try: row.min_order_amount_try,
      payment_term: row.payment_term,
      iban: row.iban,
      contract_pdf_url: row.contract_pdf_url,
      contract_uploaded_at: row.contract_uploaded_at,
      notes: row.notes,
      contact_email: row.contact_email,
      created_at: row.created_at,
      contacts: contacts ?? [],
      capabilities: capabilities ?? [],
    },
  });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await assertPermission("fason", "update");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdatePartnerSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "validation_failed",
        details: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }
  const body = parsed.data;
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("fason_partners")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Partner bulunamadı" }, { status: 404 });
  }

  const { error: upErr } = await admin
    .from("fason_partners")
    .update({
      name: body.name,
      short_name: body.shortName || null,
      tax_number: body.taxNumber || null,
      tax_office: body.taxOffice || null,
      address_line: body.addressLine || null,
      city: body.city,
      town: body.town,
      status: body.status,
      active: body.status === "active",
      default_lead_days: body.defaultLeadTimeDays,
      express_lead_time_days: body.expressLeadTimeDays ?? null,
      min_order_amount_try: body.minOrderAmountTry ?? null,
      payment_term: body.paymentTerm || null,
      iban: body.iban || null,
      notes: body.notes || null,
      contact_email: body.owner.email.toLowerCase(),
      contact_person: body.owner.name,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const contacts: Array<{
    role: "owner" | "operator" | "accounting";
    name: string;
    title?: string;
    email: string;
    phone_e164: string;
    auto_notification: boolean;
  }> = [
    {
      role: "owner",
      name: body.owner.name,
      title: body.owner.title,
      email: body.owner.email.toLowerCase(),
      phone_e164: normalizePhoneE164(body.owner.phone),
      auto_notification: false,
    },
    {
      role: "operator",
      name: body.operator.name,
      title: body.operator.title,
      email: body.operator.email.toLowerCase(),
      phone_e164: normalizePhoneE164(body.operator.phone),
      auto_notification: body.operator.autoNotify ?? true,
    },
  ];
  if (
    body.accounting?.name &&
    body.accounting.email &&
    body.accounting.phone
  ) {
    contacts.push({
      role: "accounting",
      name: body.accounting.name,
      title: body.accounting.title,
      email: body.accounting.email.toLowerCase(),
      phone_e164: normalizePhoneE164(body.accounting.phone),
      auto_notification: false,
    });
  }

  await admin.from("partner_contacts").delete().eq("partner_id", id);
  if (contacts.length > 0) {
    const { error: cErr } = await admin.from("partner_contacts").insert(
      contacts.map((c) => ({
        partner_id: id,
        role: c.role,
        name: c.name,
        title: c.title ?? null,
        email: c.email,
        phone_e164: c.phone_e164,
        auto_notification: c.auto_notification,
      }))
    );
    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }
  }

  const { data: oldCaps } = await admin
    .from("partner_capabilities")
    .select("id, capability_type, capability_value, is_verified")
    .eq("partner_id", id);

  const verifiedMap = new Map<string, boolean>();
  for (const c of oldCaps ?? []) {
    verifiedMap.set(
      `${c.capability_type}:${c.capability_value}`,
      c.is_verified !== false
    );
  }

  const desired = [
    ...body.productTypes.map((v) => ({
      capability_type: "product_type" as const,
      capability_value: v,
    })),
    ...(body.materials ?? []).map((v) => ({
      capability_type: "material" as const,
      capability_value: v,
    })),
  ];
  const desiredKeys = new Set(
    desired.map((d) => `${d.capability_type}:${d.capability_value}`)
  );

  for (const old of oldCaps ?? []) {
    const key = `${old.capability_type}:${old.capability_value}`;
    if (!desiredKeys.has(key)) {
      await admin.from("partner_capabilities").delete().eq("id", old.id);
    }
  }

  for (const d of desired) {
    const key = `${d.capability_type}:${d.capability_value}`;
    const exists = (oldCaps ?? []).some(
      (o) =>
        o.capability_type === d.capability_type &&
        o.capability_value === d.capability_value
    );
    if (exists) continue;
    await admin.from("partner_capabilities").insert({
      partner_id: id,
      capability_type: d.capability_type,
      capability_value: d.capability_value,
      is_verified: verifiedMap.get(key) ?? false,
    });
  }

  return NextResponse.json({ ok: true, id });
}
