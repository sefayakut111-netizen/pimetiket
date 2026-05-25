/**
 * GET /api/admin/activity-feed?hours=24&limit=15
 * Son order_events + yeni kayıtlar — dashboard timeline.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await assertPermission("orders", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const hours = Math.min(72, Math.max(1, Number(url.searchParams.get("hours") ?? 24)));
  const limit = Math.min(30, Math.max(1, Number(url.searchParams.get("limit") ?? 15)));

  const admin = createAdminClient();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data: events, error } = await admin
    .from("order_events")
    .select(
      `
      event_type,
      summary,
      created_at,
      order_id,
      profiles:actor_id ( display_name )
    `
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[activity-feed]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const feed = (events ?? []).map((e) => {
    const profile = e.profiles as { display_name?: string | null } | null;
    return {
      type: e.event_type as string,
      summary: e.summary as string,
      createdAt: e.created_at as string,
      orderId: e.order_id as string,
      actorName: profile?.display_name ?? null,
    };
  });

  const { data: newProfiles } = await admin
    .from("profiles")
    .select("display_name, created_at")
    .eq("role", "customer")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);

  for (const p of newProfiles ?? []) {
    feed.push({
      type: "user_registered",
      summary: `Yeni müşteri: ${p.display_name ?? "—"}`,
      createdAt: p.created_at as string,
      orderId: "",
      actorName: p.display_name as string | null,
    });
  }

  feed.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json({
    ok: true,
    events: feed.slice(0, limit),
  });
}
