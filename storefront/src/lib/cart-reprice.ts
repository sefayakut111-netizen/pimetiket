/**
 * Sepet fiyat tazeleme — fiyat sürümü (live_updated_at) bazlı.
 * Checkout recalc motorunu reuse eder; sepet görünümü içindir.
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  quoteCartItemPrice,
  type CartItemForValidation,
} from "@/lib/payment-validation";
import type { CustomerCartItem, CustomerProduct } from "@/lib/customer-cart";

export type PricingScope =
  | "sticker"
  | "etiket_rulo"
  | "etiket_tabaka"
  | "global";

export interface RepriceChangedItem {
  id: string;
  oldTotal: number;
  newTotal: number;
}

export interface RepriceRemovedItem {
  id: string;
  title: string;
}

export interface RepriceResult {
  items: CustomerCartItem[];
  changed: RepriceChangedItem[];
  removed: RepriceRemovedItem[];
  /** Bayat olup yeniden fiyatlanan (fiyat aynı olsa da pricedAt güncellendi) */
  refreshedIds: string[];
}

const PRICE_EPS = 0.01;
const UNIT_EPS = 0.0001;

export async function fetchPricingScopeTimestamps(): Promise<
  Map<PricingScope, number>
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pricing_config")
    .select("scope, live_updated_at")
    .in("scope", ["sticker", "etiket_rulo", "etiket_tabaka", "global"]);

  if (error) {
    console.error("[cart-reprice] scope timestamps error:", error);
    return new Map();
  }

  const map = new Map<PricingScope, number>();
  for (const row of data ?? []) {
    const scope = row.scope as PricingScope;
    if (row.live_updated_at) {
      map.set(scope, new Date(row.live_updated_at).getTime());
    }
  }
  return map;
}

function resolveItemScope(item: CustomerCartItem): PricingScope | null {
  if (item.product === "sticker") return "sticker";

  const metaFF = item.meta?.formFactor;
  if (metaFF === "rulo") return "etiket_rulo";
  if (metaFF === "tabaka") return "etiket_tabaka";

  const cfg = (item.config || "").toLowerCase();
  if (cfg.includes("tabaka") || cfg.includes("sheet")) return "etiket_tabaka";
  if (cfg.includes("rulo") || cfg.includes("roll")) return "etiket_rulo";

  const scope = item.meta?.scope;
  if (scope === "etiket_rulo") return "etiket_rulo";
  if (scope === "etiket_tabaka") return "etiket_tabaka";

  return null;
}

function isItemStale(
  item: CustomerCartItem,
  timestamps: Map<PricingScope, number>
): boolean {
  const pricedAt = item.pricedAt ?? item.addedAt;
  const globalTs = timestamps.get("global") ?? 0;
  const scope = resolveItemScope(item);

  if (!scope) {
    return pricedAt < globalTs;
  }

  const scopeTs = timestamps.get(scope) ?? 0;
  return pricedAt < Math.max(scopeTs, globalTs);
}

function toValidationItem(item: CustomerCartItem): CartItemForValidation {
  return {
    id: item.id,
    product: item.product as CustomerProduct,
    title: item.title,
    config: item.config,
    width: item.width,
    height: item.height,
    qty: item.qty,
    unit: item.unit,
    total: item.total,
    meta: item.meta ?? null,
    shape: item.shape ?? null,
    cut: item.cut ?? null,
    material: item.material ?? null,
    finish: item.finish ?? null,
    coatingId: item.coatingId ?? null,
    customizationId: item.customizationId ?? null,
    materialId: item.materialId ?? null,
    designCount: item.designCount ?? null,
  };
}

export async function repriceCartItems(
  items: CustomerCartItem[]
): Promise<RepriceResult> {
  const timestamps = await fetchPricingScopeTimestamps();
  const now = Date.now();
  const result: CustomerCartItem[] = [];
  const changed: RepriceChangedItem[] = [];
  const removed: RepriceRemovedItem[] = [];
  const refreshedIds: string[] = [];

  for (const item of items) {
    if (!isItemStale(item, timestamps)) {
      result.push(item);
      continue;
    }

    const quote = await quoteCartItemPrice(toValidationItem(item));
    if (!quote) {
      removed.push({ id: item.id, title: item.title });
      continue;
    }

    const updated: CustomerCartItem = {
      ...item,
      unit: quote.unit,
      total: quote.total,
      pricedAt: now,
    };

    const priceChanged =
      Math.abs(item.total - quote.total) > PRICE_EPS ||
      Math.abs(item.unit - quote.unit) > UNIT_EPS;

    if (priceChanged) {
      changed.push({
        id: item.id,
        oldTotal: item.total,
        newTotal: quote.total,
      });
    }

    result.push(updated);
    refreshedIds.push(item.id);
  }

  return { items: result, changed, removed, refreshedIds };
}
