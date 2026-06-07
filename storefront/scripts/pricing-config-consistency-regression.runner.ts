/**
 * P0 fiyat tutarlılığı — konfigüratör / server / checkout aynı config kaynağı.
 *
 * CI (env yok): FALLBACK + quote motoru sapma testi.
 * Opsiyonel (SUPABASE_SERVICE_ROLE_KEY): v_pricing_live ≡ pricing_config + holo 70×70×25.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { quoteStickerFromConfig } from "../src/lib/customer-pricing-from-config";
import { FALLBACK_STICKER_CONFIG, type ProfileConfig } from "../src/lib/pricing-config-types";
import { expectedCartLineFromPerDesignQuote } from "../src/lib/design-count-pricing";

const HOLO_CASE = {
  width: 70,
  height: 70,
  qty: 25,
  material: "holo" as const,
  finish: "parlak" as const,
  cut: "diecut" as const,
};

/** Eski FALLBACK holo m²=1800 ile üretilen yanlış sepet fiyatı (regresyon guard). */
const LEGACY_WRONG_TOTAL = 1250;
/** Canlı tarife holo m²=1000 — beklenen ~720 bandı (±%3). */
const LIVE_EXPECTED_TOTAL = 722;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function quoteTotal(cfg: ProfileConfig) {
  const q = quoteStickerFromConfig(cfg, HOLO_CASE);
  assert(q?.ok === true, "quote failed");
  if (!q || !q.ok) return 0;
  return expectedCartLineFromPerDesignQuote(q.unitPrice, HOLO_CASE.qty, 1).total;
}

function assertFallbackNotLegacyWrongPrice() {
  const total = quoteTotal(FALLBACK_STICKER_CONFIG);
  assert(
    Math.abs(total - LEGACY_WRONG_TOTAL) > 100,
    `FALLBACK hâlâ eski yanlış fiyata (~${LEGACY_WRONG_TOTAL}): ${total}`
  );
  assert(
    Math.abs(total - LIVE_EXPECTED_TOTAL) <= LIVE_EXPECTED_TOTAL * 0.05,
    `FALLBACK holo 70×70×25 beklenen ~${LIVE_EXPECTED_TOTAL}, alınan ${total}`
  );
  console.log(`  ✓ FALLBACK holo quote total=${total} (≠ ${LEGACY_WRONG_TOTAL})`);
}

function materialSellMap(cfg: { materials?: { id: string; m2_sell_try?: number }[] }) {
  const map = new Map<string, number>();
  for (const m of cfg.materials ?? []) {
    if (m.m2_sell_try != null) map.set(m.id, m.m2_sell_try);
  }
  return map;
}

async function assertLiveDbSourcesMatch() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    console.log("  ⊘ DB parity skip (env eksik)");
    return;
  }

  const admin = createClient(url, serviceKey);
  const anon = createClient(url, anonKey);

  const [{ data: tableRow, error: tableErr }, { data: viewRow, error: viewErr }] =
    await Promise.all([
      admin
        .from("pricing_config")
        .select("live_config")
        .eq("scope", "sticker")
        .maybeSingle(),
      anon
        .from("v_pricing_live")
        .select("live_config")
        .eq("scope", "sticker")
        .maybeSingle(),
    ]);

  assert(!tableErr && tableRow?.live_config, `pricing_config read: ${tableErr?.message}`);
  assert(!viewErr && viewRow?.live_config, `v_pricing_live read: ${viewErr?.message}`);

  const tableCfg = tableRow!.live_config as ProfileConfig;
  const viewCfg = viewRow!.live_config as ProfileConfig;

  const tableMap = materialSellMap(tableCfg);
  const viewMap = materialSellMap(viewCfg);

  for (const [id, sell] of tableMap) {
    assert(viewMap.get(id) === sell, `material ${id}: table=${sell} view=${viewMap.get(id)}`);
  }

  const tableTotal = quoteTotal(tableCfg);
  const viewTotal = quoteTotal(viewCfg);

  assert(
    Math.abs(tableTotal - viewTotal) < 0.02,
    `pricing_config quote (${tableTotal}) ≠ v_pricing_live quote (${viewTotal})`
  );

  console.log(
    `  ✓ DB parity: holo m²=${tableMap.get("holo")}, quote total=${tableTotal}`
  );
}

async function main() {
  console.log("pricing-config-consistency regression");
  assertFallbackNotLegacyWrongPrice();
  await assertLiveDbSourcesMatch();
  console.log("OK");
}

main().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
