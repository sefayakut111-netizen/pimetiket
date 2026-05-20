/**
 * /api/admin/product-cards (Sefa 21 May v68 Mig 074)
 *
 *   GET    — tüm kartları döner (aktif + pasif). Query: ?product_type=etiket|sticker
 *   PATCH  — body: { id, title_tr?, title_en?, desc_tr?, desc_en?, is_active? }
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin" && role !== "staff") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { admin };
}

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const url = new URL(req.url);
  const productType = url.searchParams.get("product_type");

  let query = guard.admin
    .from("product_cards")
    .select("*")
    .order("product_type", { ascending: true })
    .order("sort_order", { ascending: true });

  if (productType === "etiket" || productType === "sticker") {
    query = query.eq("product_type", productType);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ cards: data ?? [] });
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  let body: {
    id?: string;
    title_tr?: string;
    title_en?: string;
    desc_tr?: string;
    desc_en?: string;
    is_active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "id zorunlu" }, { status: 400 });
  }

  // Sadece izin verilen alanları kabul et
  const patch: Record<string, unknown> = {};
  if (typeof body.title_tr === "string") patch.title_tr = body.title_tr.trim();
  if (typeof body.title_en === "string") patch.title_en = body.title_en.trim();
  if (typeof body.desc_tr === "string") patch.desc_tr = body.desc_tr.trim();
  if (typeof body.desc_en === "string") patch.desc_en = body.desc_en.trim();
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "güncellenebilir alan yok" },
      { status: 400 }
    );
  }

  // Title/desc max length koruması (UI 200 char limit + DB sınırı yok ama
  // güvenli aralık)
  for (const k of ["title_tr", "title_en"] as const) {
    const v = patch[k];
    if (typeof v === "string" && v.length > 100) {
      return NextResponse.json(
        { error: `${k} 100 karakteri aşamaz` },
        { status: 400 }
      );
    }
  }
  for (const k of ["desc_tr", "desc_en"] as const) {
    const v = patch[k];
    if (typeof v === "string" && v.length > 200) {
      return NextResponse.json(
        { error: `${k} 200 karakteri aşamaz` },
        { status: 400 }
      );
    }
  }

  const { data, error } = await guard.admin
    .from("product_cards")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Customer sayfa cache invalidate
  revalidatePath("/etiket");
  revalidatePath("/sticker");

  return NextResponse.json({ ok: true, card: data });
}
