/**
 * /api/admin/fason/partners
 *
 * Sefa 20 May v68 — Üretim Partneri form revize (Mig 067):
 *   GET  — Partner listesi (capabilities + contacts dahil)
 *   POST — Yeni partner ekle (nested owner/operator/accounting + capabilities)
 *
 * Mevcut Mig 018 fason_partners tablosu ALTER edildi + 2 yeni tablo
 * (partner_contacts, partner_capabilities). fn_create_partner_with_contacts
 * RPC atomic insert sağlar.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// Zod schemas
// ============================================================

const phoneRegex = /^(\+90)?5\d{9}$/;

/** Telefonu E.164'e normalize: 5XXXXXXXXX → +905XXXXXXXXX */
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

const CreatePartnerSchema = z.object({
  name: z.string().min(2).max(150),
  shortName: z.string().max(40).optional(),
  taxNumber: z.string().regex(/^\d{10,11}$/).optional(),
  taxOffice: z.string().max(80).optional(),
  addressLine: z.string().max(200).optional(),
  city: z.string().min(2).max(50),
  town: z.string().min(2).max(50),
  status: z.enum(["active", "paused"]).default("active"),

  productTypes: z
    .array(z.enum(["roll_label", "sheet_label", "sticker"]))
    .min(1, "En az 1 ürün grubu seçilmeli"),
  materials: z
    .array(z.enum(["paper", "transparent", "metallic", "holographic"]))
    .optional(),
  defaultLeadTimeDays: z.number().int().min(1).max(30),
  expressLeadTimeDays: z.number().int().min(1).max(7).optional(),
  minOrderAmountTry: z.number().min(0).optional(),

  paymentTerm: z.enum(["cash", "net_15", "net_30", "net_60"]).optional(),
  iban: z.string().regex(/^TR\d{24}$/, "TR + 24 hane IBAN bekleniyor").optional(),
  contractPdfUrl: z.string().url().optional(),

  owner: ContactSchema,
  operator: ContactSchema.extend({
    autoNotify: z.boolean().default(true),
  }),
  accounting: ContactSchema.partial().optional(),

  notes: z.string().max(1000).optional(),
});

type CreatePartnerInput = z.infer<typeof CreatePartnerSchema>;

// ============================================================
// GET — Liste (contacts + capabilities ile birlikte)
// ============================================================
export async function GET() {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  const { data: partners, error: pErr } = await admin
    .from("fason_partners")
    .select(
      "id, name, short_name, tax_number, city, town, status, status_reason, " +
        "default_lead_days, express_lead_time_days, min_order_amount_try, " +
        "payment_term, iban, contract_pdf_url, contract_uploaded_at, " +
        "contact_email, contact_whatsapp, contact_person, " +
        "specialties, cached_score, score_updated_at, notes, created_at"
    )
    .neq("status", "terminated")
    .order("status", { ascending: true })
    .order("cached_score", { ascending: false, nullsFirst: false });
  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const partnerRows =
    ((partners ?? []) as unknown as Array<{ id: string }>);
  const partnerIds = partnerRows.map((p) => p.id);

  // Contacts + capabilities batch fetch
  const { data: contacts } = partnerIds.length
    ? await admin
        .from("partner_contacts")
        .select(
          "partner_id, role, name, title, email, phone_e164, auto_notification"
        )
        .in("partner_id", partnerIds)
    : { data: [] };
  const { data: caps } = partnerIds.length
    ? await admin
        .from("partner_capabilities")
        .select("partner_id, capability_type, capability_value")
        .in("partner_id", partnerIds)
    : { data: [] };

  type CT = {
    partner_id: string;
    role: string;
    name: string;
    title: string | null;
    email: string;
    phone_e164: string;
    auto_notification: boolean;
  };
  type CP = {
    partner_id: string;
    capability_type: string;
    capability_value: string;
  };

  const contactsByPartner = new Map<string, CT[]>();
  for (const c of (contacts ?? []) as CT[]) {
    if (!contactsByPartner.has(c.partner_id))
      contactsByPartner.set(c.partner_id, []);
    contactsByPartner.get(c.partner_id)!.push(c);
  }
  const capsByPartner = new Map<string, CP[]>();
  for (const c of (caps ?? []) as CP[]) {
    if (!capsByPartner.has(c.partner_id))
      capsByPartner.set(c.partner_id, []);
    capsByPartner.get(c.partner_id)!.push(c);
  }

  const enriched = partnerRows.map((p) => ({
    ...p,
    contacts: contactsByPartner.get(p.id) ?? [],
    capabilities: capsByPartner.get(p.id) ?? [],
  }));

  return NextResponse.json({ partners: enriched });
}

// ============================================================
// POST — Yeni partner (nested body)
// ============================================================
export async function POST(req: Request) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Backwards compat: eski flat body (sadece name + contact_email) hâlâ kabul edilsin
  if (
    typeof raw === "object" &&
    raw !== null &&
    "contact_email" in raw &&
    !("owner" in raw)
  ) {
    return handleLegacyFlatBody(raw as Record<string, unknown>);
  }

  const parsed = CreatePartnerSchema.safeParse(raw);
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

  // Contacts array (sadece dolu olanlar)
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
      email: body.owner.email,
      phone_e164: normalizePhoneE164(body.owner.phone),
      auto_notification: false,
    },
    {
      role: "operator",
      name: body.operator.name,
      title: body.operator.title,
      email: body.operator.email,
      phone_e164: normalizePhoneE164(body.operator.phone),
      auto_notification: body.operator.autoNotify ?? true,
    },
  ];
  if (body.accounting && body.accounting.name && body.accounting.email && body.accounting.phone) {
    contacts.push({
      role: "accounting",
      name: body.accounting.name,
      title: body.accounting.title,
      email: body.accounting.email,
      phone_e164: normalizePhoneE164(body.accounting.phone),
      auto_notification: false,
    });
  }

  // Capabilities array
  const capabilities = [
    ...body.productTypes.map((v) => ({ type: "product_type", value: v })),
    ...(body.materials ?? []).map((v) => ({ type: "material", value: v })),
  ];

  // Partner JSON (RPC input)
  const partnerJson: Record<string, unknown> = {
    name: body.name,
    short_name: body.shortName,
    tax_number: body.taxNumber,
    tax_office: body.taxOffice,
    address_line: body.addressLine,
    city: body.city,
    town: body.town,
    status: body.status,
    default_lead_time_days: body.defaultLeadTimeDays,
    express_lead_time_days: body.expressLeadTimeDays,
    min_order_amount_try: body.minOrderAmountTry,
    payment_term: body.paymentTerm,
    iban: body.iban,
    contract_pdf_url: body.contractPdfUrl,
    notes: body.notes,
  };

  try {
    const { data: partnerId, error: rpcErr } = await admin.rpc(
      "fn_create_partner_with_contacts" as never,
      {
        p_partner: partnerJson,
        p_contacts: contacts,
        p_capabilities: capabilities,
        p_admin_id: auth.user.id,
      } as never
    );
    if (rpcErr) {
      return NextResponse.json(
        { error: "create_failed", detail: rpcErr.message },
        { status: 500 }
      );
    }
    return NextResponse.json({
      id: partnerId,
      name: body.name,
      status: body.status,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "unexpected",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

// ============================================================
// Legacy flat body (eski admin/fason "Yeni partner" modal'ı)
// ============================================================
async function handleLegacyFlatBody(body: Record<string, unknown>) {
  const admin = createAdminClient();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.contact_email === "string"
      ? body.contact_email.trim().toLowerCase()
      : "";
  if (!name || !email.includes("@")) {
    return NextResponse.json(
      { error: "name + contact_email zorunlu" },
      { status: 400 }
    );
  }
  const specialties = Array.isArray(body.specialties)
    ? body.specialties.filter((s): s is string => typeof s === "string")
    : [];
  const insertPayload = {
    name,
    contact_email: email,
    contact_whatsapp:
      typeof body.contact_whatsapp === "string"
        ? body.contact_whatsapp.trim()
        : null,
    contact_person:
      typeof body.contact_person === "string"
        ? body.contact_person.trim()
        : null,
    specialties,
    default_lead_days:
      typeof body.default_lead_days === "number"
        ? Math.max(1, Math.min(60, body.default_lead_days))
        : 7,
    contract_signed_at:
      typeof body.contract_signed_at === "string"
        ? body.contract_signed_at
        : null,
    notes: typeof body.notes === "string" ? body.notes.slice(0, 1000) : null,
    active: true,
    status: "active",
  };
  const { data, error } = await admin
    .from("fason_partners")
    .insert(insertPayload as never)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ partner: data });
}

// Avoid unused export warning
void CreatePartnerSchema;
export type { CreatePartnerInput };
