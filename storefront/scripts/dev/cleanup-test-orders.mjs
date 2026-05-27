#!/usr/bin/env node
/**
 * Production test siparis temizligi.
 *
 * Varsayilan: yalnizca listele (silmez).
 * Silmek icin: node scripts/dev/cleanup-test-orders.mjs --confirm
 *
 * Guvenli silme (ADIM 4): id = 00000001 veya PE-2026-TEST*
 * Ek kapsam: --include-address-test → adres adi "Admin Test" / "Test Musteri"
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
for (const f of [".env.local", ".env.agent", ".env"]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const includeAddressTest = args.includes("--include-address-test");

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SAFE_ID_PATTERN = /^(00000001|PE-2026-TEST)/;
const ADDRESS_TEST_NAMES = ["admin test", "test musteri", "test müşteri"];

function isAddressTestOrder(order) {
  const name = (order.address?.name ?? "").toLowerCase();
  return ADDRESS_TEST_NAMES.some((n) => name.includes(n));
}

function classifyOrder(order) {
  if (SAFE_ID_PATTERN.test(order.id)) return "id_pattern";
  if (includeAddressTest && isAddressTestOrder(order)) return "address_name";
  return null;
}

async function fetchCandidateOrders() {
  const { data: byId, error: idErr } = await supabase
    .from("orders")
    .select("id, status, user_id, created_at, total, address")
    .or("id.eq.00000001,id.like.PE-2026-TEST%");

  if (idErr) throw idErr;

  let addressOrders = [];
  if (includeAddressTest) {
    const { data: all, error: allErr } = await supabase
      .from("orders")
      .select("id, status, user_id, created_at, total, address");
    if (allErr) throw allErr;
    addressOrders = (all ?? []).filter(isAddressTestOrder);
  }

  const merged = new Map();
  for (const o of [...(byId ?? []), ...addressOrders]) {
    const reason = classifyOrder(o);
    if (reason) merged.set(o.id, { ...o, matchReason: reason });
  }
  return [...merged.values()].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
}

async function countRelated(orderId) {
  const { data: items } = await supabase
    .from("order_items")
    .select("id")
    .eq("order_id", orderId);
  const itemIds = (items ?? []).map((i) => i.id);

  const counts = { items: itemIds.length, designs: 0, events: 0, cutlines: 0 };
  const { count: designs } = await supabase
    .from("design_files")
    .select("*", { count: "exact", head: true })
    .eq("order_id", orderId);
  counts.designs = designs ?? 0;

  const { count: events } = await supabase
    .from("order_events")
    .select("*", { count: "exact", head: true })
    .eq("order_id", orderId);
  counts.events = events ?? 0;

  if (itemIds.length > 0) {
    const { count: cutlines } = await supabase
      .from("cutline_designs")
      .select("*", { count: "exact", head: true })
      .in("order_item_id", itemIds);
    counts.cutlines = cutlines ?? 0;
  }
  return counts;
}

async function deleteOrder(orderId) {
  const { data: items } = await supabase
    .from("order_items")
    .select("id")
    .eq("order_id", orderId);
  const itemIds = (items ?? []).map((i) => i.id);

  if (itemIds.length > 0) {
    await supabase.from("cutline_designs").delete().in("order_item_id", itemIds);
  }

  await supabase.from("proof_validations").delete().eq("order_id", orderId);
  await supabase.from("design_quality_checks").delete().eq("order_id", orderId);
  await supabase.from("returns").delete().eq("order_id", orderId);
  await supabase.from("payments").delete().eq("order_id", orderId);
  await supabase.from("order_items").delete().eq("order_id", orderId);
  await supabase.from("design_files").delete().eq("order_id", orderId);
  await supabase.from("order_events").delete().eq("order_id", orderId);
  await supabase.from("order_assignments").delete().eq("order_id", orderId);
  await supabase.from("shipments").delete().eq("order_id", orderId);

  const { error } = await supabase.from("orders").delete().eq("id", orderId);
  if (error) throw new Error(`${orderId}: ${error.message}`);
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.");
    process.exit(1);
  }

  const orders = await fetchCandidateOrders();
  console.log(`\nBulunan test siparisi: ${orders.length}`);
  if (includeAddressTest) {
    console.log("(Kapsam: id_pattern + adres adi Admin Test / Test Musteri)\n");
  } else {
    console.log("(Kapsam: yalnizca 00000001 ve PE-2026-TEST*)\n");
  }

  if (orders.length === 0) {
    console.log("Temizlenecek siparis yok.");
    return;
  }

  for (const o of orders) {
    const rel = await countRelated(o.id);
    const addr = o.address?.name ?? "—";
    console.log(
      `  ${o.id} | ${o.status} | ${o.total} TL | ${addr} | eslesme: ${o.matchReason} | items:${rel.items} designs:${rel.designs} events:${rel.events}`
    );
  }

  if (!confirm) {
    console.log("\nSilme yapilmadi. Onay icin: --confirm ekle");
    if (!includeAddressTest) {
      console.log(
        "Admin Test adresli 12 haneli siparisler icin: --include-address-test --confirm"
      );
    }
    return;
  }

  console.log("\nSiliniyor...");
  for (const o of orders) {
    await deleteOrder(o.id);
    console.log(`SILINDI: ${o.id}`);
  }
  console.log(`\nToplam ${orders.length} test siparisi silindi.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
