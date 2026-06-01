/**
 * POST /api/pim/memory/migrate — ilk login'de anonim localStorage → sunucu (bir kez)
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { clampMemoryPayload } from "@/lib/pim/memory-clamp";
import type { PimFact, PimMessage } from "@/lib/pim/memory";

export const runtime = "nodejs";

const Body = z.object({
  displayName: z.string().nullable().optional(),
  facts: z.array(z.custom<PimFact>()).optional(),
  history: z.array(z.custom<PimMessage>()).optional(),
});

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("pim_conversations")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr) {
    console.error("[pim/memory/migrate] fetch", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ ok: true, migrated: false });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const clamped = clampMemoryPayload(parsed.data);

  const { error: insertErr } = await supabase.from("pim_conversations").insert({
    user_id: user.id,
    display_name: clamped.displayName ?? null,
    facts: (clamped.facts ?? []) as unknown as import("@/lib/supabase/types").Json,
    history: (clamped.history ?? []) as unknown as import("@/lib/supabase/types").Json,
    last_summary: null,
  });

  if (insertErr) {
    console.error("[pim/memory/migrate] insert", insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, migrated: true });
}
