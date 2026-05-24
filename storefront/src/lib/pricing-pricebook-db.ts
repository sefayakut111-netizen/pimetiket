/**
 * Partner Price Book — DB fetch + cache (server-only).
 */

import { createClient } from "@/lib/supabase/client";
import {
  FALLBACK_PRICEBOOK_SNAPSHOT,
  type PricebookSnapshot,
  pricebookCellKey,
} from "./pricing-pricebook-types";

interface CacheEntry {
  snapshot: PricebookSnapshot;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: CacheEntry | null = null;

export function invalidatePricebookCache(): void {
  cache = null;
}

export async function fetchPricebookSnapshot(): Promise<PricebookSnapshot> {
  if (cache && Date.now() < cache.expiresAt) {
    return cache.snapshot;
  }

  try {
    const supabase = createClient();

    const [axesRes, matricesRes, settingsRes] = await Promise.all([
      supabase
        .from("partner_pricebook_axes")
        .select("axis, value_mm, display_order")
        .eq("product_type", "etiket_rulo")
        .order("display_order"),
      supabase
        .from("partner_pricebook_matrices")
        .select("id, material_key, display_name, active, version")
        .eq("product_type", "etiket_rulo")
        .eq("active", true),
      supabase
        .from("site_settings")
        .select("pricing_markup_pct")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    if (axesRes.error || matricesRes.error) {
      console.warn("[pricebook] DB read failed, fallback");
      return FALLBACK_PRICEBOOK_SNAPSHOT;
    }

    const axesRows = axesRes.data ?? [];
    const matrices = matricesRes.data ?? [];

    if (axesRows.length === 0 || matrices.length === 0) {
      return FALLBACK_PRICEBOOK_SNAPSHOT;
    }

    const axes = {
      width: axesRows
        .filter((r) => r.axis === "width")
        .map((r) => r.value_mm)
        .sort((a, b) => a - b),
      height: axesRows
        .filter((r) => r.axis === "height")
        .map((r) => r.value_mm)
        .sort((a, b) => a - b),
      qty: axesRows
        .filter((r) => r.axis === "qty")
        .map((r) => r.value_mm)
        .sort((a, b) => a - b),
    };

    const matrixIds = matrices.map((m) => m.id);
    const { data: cells, error: cellsErr } = await supabase
      .from("partner_pricebook_cells")
      .select("matrix_id, width_mm, height_mm, qty, price_per_unit")
      .in("matrix_id", matrixIds);

    if (cellsErr) {
      console.warn("[pricebook] cells read failed, fallback");
      return FALLBACK_PRICEBOOK_SNAPSHOT;
    }

    const snapshot: PricebookSnapshot = {
      markup_pct:
        Number(settingsRes.data?.pricing_markup_pct) ||
        FALLBACK_PRICEBOOK_SNAPSHOT.markup_pct,
      axes,
      matrices: {},
    };

    for (const m of matrices) {
      const cellMap: Record<string, number> = {};
      for (const c of cells ?? []) {
        if (c.matrix_id !== m.id) continue;
        cellMap[pricebookCellKey(c.width_mm, c.height_mm, c.qty)] = Number(
          c.price_per_unit
        );
      }
      snapshot.matrices[m.material_key] = {
        meta: {
          id: m.id,
          material_key: m.material_key,
          display_name: m.display_name,
          active: m.active,
          version: m.version,
        },
        cells: cellMap,
      };
    }

    cache = { snapshot, expiresAt: Date.now() + CACHE_TTL_MS };
    return snapshot;
  } catch (err) {
    console.error("[pricebook] unexpected error:", err);
    return FALLBACK_PRICEBOOK_SNAPSHOT;
  }
}
