/**
 * Compare-and-swap update helper — TOCTOU koruması.
 * Desen: admin/ai-qc/decide route (.eq status + select single).
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export type CasUpdateResult<T> =
  | { ok: true; row: T }
  | { ok: false; reason: "stale" | "error"; error?: PostgrestError };

type CasExpect = string | readonly string[] | null | undefined;

function normalizeExpect(expect: CasExpect): string[] | null {
  if (expect === null || expect === undefined) return null;
  if (typeof expect === "string") return [expect];
  return [...expect];
}

export async function casUpdate<T extends Record<string, unknown>>(
  admin: SupabaseClient,
  table: string,
  id: string,
  patch: Record<string, unknown>,
  opts: {
    expectFrom: CasExpect;
    col?: string;
    idCol?: string;
    select?: string;
  }
): Promise<CasUpdateResult<T>> {
  const col = opts.col ?? "status";
  const idCol = opts.idCol ?? "id";
  const expected = normalizeExpect(opts.expectFrom);

  let q = admin.from(table).update(patch).eq(idCol, id);
  if (expected?.length === 1) {
    q = q.eq(col, expected[0]!);
  } else if (expected && expected.length > 1) {
    q = q.in(col, [...expected]);
  }

  const { data, error } = await q.select(opts.select ?? "*").single();
  if (error || !data) {
    if (error?.code === "PGRST116") {
      return { ok: false, reason: "stale" };
    }
    return { ok: false, reason: "error", error: error ?? undefined };
  }
  return { ok: true, row: data as unknown as T };
}
