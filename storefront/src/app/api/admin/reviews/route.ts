/**
 * /api/admin/reviews — Admin yorum listesi.
 *
 * Tüm reviews'ı service role ile çeker (RLS bypass).
 * Admin/staff role gereken auth kontrolü session'dan.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient } from "@supabase/supabase-js";

interface ReviewRow {
  id: string;
  user_id: string | null;
  order_id: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  show_on_homepage: boolean | null;
  featured: boolean | null;
  display_name: string | null;
  photos: unknown;
  product_type: string | null;
  helpful_count: number | null;
  created_at: string;
  moderation_note: string | null;
}

export async function GET() {
  // Sefa 21 May v68: inline auth → assertAdmin helper (tutarlılık)
  const auth = await assertPermission("reviews", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Service role ile çek (RLS bypass)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik" },
      { status: 500 }
    );
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[admin/reviews] error:", error);
    return NextResponse.json({ reviews: [] });
  }

  return NextResponse.json({ reviews: (data ?? []) as ReviewRow[] });
}
