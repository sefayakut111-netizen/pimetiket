import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

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

export async function POST(req: Request) {
  let body: {
    subject?: string;
    message?: string;
    category?: string;
    order_id?: string;
    guest_email?: string;
    guest_name?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const subject = body.subject?.trim();
  const message = body.message?.trim();
  if (!subject || !message) {
    return NextResponse.json(
      { ok: false, error: "Konu ve mesaj zorunlu" },
      { status: 400 }
    );
  }

  const category = VALID_CATEGORIES.includes(
    body.category as (typeof VALID_CATEGORIES)[number]
  )
    ? body.category!
    : "genel";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const orderId = body.order_id?.trim() || null;
  if (orderId) {
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Siparişe bağlı destek için giriş gerekli" },
        { status: 401 }
      );
    }
    const { data: orderRow } = await admin
      .from("orders")
      .select("user_id")
      .eq("id", orderId)
      .maybeSingle();
    const orderOwner = (orderRow as { user_id?: string } | null)?.user_id;
    if (!orderOwner || orderOwner !== user.id) {
      return NextResponse.json(
        { ok: false, error: "Bu sipariş size ait değil" },
        { status: 403 }
      );
    }
  }
  const row: SupportInsert = user
    ? {
        user_id: user.id,
        subject,
        message,
        category,
        order_id: orderId,
        status: "open",
      }
    : {
        guest_email: body.guest_email?.trim().toLowerCase() || null,
        guest_name: body.guest_name?.trim() || null,
        subject,
        message,
        category,
        order_id: orderId,
        status: "open",
      };

  if (!user && !row.guest_email) {
    return NextResponse.json(
      { ok: false, error: "E-posta adresi zorunlu" },
      { status: 400 }
    );
  }

  const { data, error } = await admin
    .from("support_tickets")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("[support/create]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
