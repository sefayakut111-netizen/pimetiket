/**
 * /api/admin/fason/partners
 *
 * GET — Fason listesi (admin için)
 * POST — Yeni fason ekle
 *
 * Sefa'nın gerçek fason ortakları bu endpoint üzerinden yönetilir.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

async function assertAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin" && role !== "staff") return null;
  return { userId: user.id, role };
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  const ok = await assertAdmin();
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await admin()
    .from("fason_partners")
    .select(
      "id, name, contact_email, contact_whatsapp, contact_person, specialties, default_lead_days, cached_score, score_updated_at, active, contract_signed_at, notes, created_at"
    )
    .order("active", { ascending: false })
    .order("cached_score", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ partners: data ?? [] });
}

interface PartnerBody {
  name?: unknown;
  contact_email?: unknown;
  contact_whatsapp?: unknown;
  contact_person?: unknown;
  specialties?: unknown;
  default_lead_days?: unknown;
  contract_signed_at?: unknown;
  notes?: unknown;
}

export async function POST(req: Request) {
  const ok = await assertAdmin();
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: PartnerBody;
  try {
    body = (await req.json()) as PartnerBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.contact_email === "string" ? body.contact_email.trim().toLowerCase() : "";
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
  };

  const { data, error } = await admin()
    .from("fason_partners")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("[fason/partners POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ partner: data });
}
