/**
 * GET /api/pim/memory — üye Pim hafızasını oku
 * PUT /api/pim/memory — üye Pim hafızasını upsert
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { clampMemoryPayload } from "@/lib/pim/memory-clamp";
import type { PimFact, PimMessage } from "@/lib/pim/memory";

export const runtime = "nodejs";

const PutBody = z.object({
  displayName: z.string().nullable().optional(),
  facts: z.array(z.custom<PimFact>()).optional(),
  history: z.array(z.custom<PimMessage>()).optional(),
  lastSummary: z.string().nullable().optional(),
});

function emptyPayload() {
  return {
    displayName: null as string | null,
    facts: [] as unknown[],
    history: [] as unknown[],
    lastSummary: null as string | null,
  };
}

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("pim_conversations")
    .select("display_name, facts, history, last_summary")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[pim/memory GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(emptyPayload());
  }

  const row = data as {
    display_name: string | null;
    facts: unknown;
    history: unknown;
    last_summary: string | null;
  };

  return NextResponse.json({
    displayName: row.display_name,
    facts: Array.isArray(row.facts) ? row.facts : [],
    history: Array.isArray(row.history) ? row.history : [],
    lastSummary: row.last_summary,
  });
}

export async function PUT(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit({
    key: `pim-mem:${user.id}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PutBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const clamped = clampMemoryPayload(parsed.data);

  const row = {
    user_id: user.id,
    display_name: clamped.displayName ?? null,
    facts: (clamped.facts ?? []) as unknown as import("@/lib/supabase/types").Json,
    history: (clamped.history ?? []) as unknown as import("@/lib/supabase/types").Json,
    last_summary: clamped.lastSummary ?? null,
  };

  const { data: existing, error: selectErr } = await supabase
    .from("pim_conversations")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selectErr) {
    console.error("[pim/memory PUT] select", selectErr);
    return NextResponse.json({ error: selectErr.message }, { status: 500 });
  }

  const { error } = existing
    ? await supabase.from("pim_conversations").update(row).eq("user_id", user.id)
    : await supabase.from("pim_conversations").insert(row);

  if (error) {
    console.error("[pim/memory PUT]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
