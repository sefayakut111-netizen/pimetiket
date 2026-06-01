#!/usr/bin/env node
/**
 * Admin Test demo siparişlerini prod'dan sil (Sefa onayı ile).
 * Kriter: address->>'name' = 'Admin Test'
 * Kullanım: node scripts/delete-admin-test-orders.mjs [--dry-run]
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_AGENT = join(__dirname, "..", ".env.agent");

function loadEnvAgent() {
  if (!existsSync(ENV_AGENT)) return;
  for (const rawLine of readFileSync(ENV_AGENT, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvAgent();

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF ?? "ucmpwxnoaqjpzhijnxtp";
const DRY_RUN = process.argv.includes("--dry-run");

async function q(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${body.slice(0, 800)}`);
  return body ? JSON.parse(body) : [];
}

const DEMO_WHERE = "address->>'name' = 'Admin Test'";

async function main() {
  if (!TOKEN && !DRY_RUN) {
    console.error("SUPABASE_ACCESS_TOKEN gerekli (.env.agent)");
    process.exit(1);
  }

  const targets = await q(
    `SELECT id, status, created_at FROM orders WHERE ${DEMO_WHERE} ORDER BY created_at`
  );
  console.log(`Hedef demo sipariş: ${targets.length}`);
  for (const row of targets) {
    console.log(`  - ${row.id} (${row.status})`);
  }

  if (targets.length === 0) {
    console.log("Silinecek sipariş yok.");
    return;
  }

  if (DRY_RUN) {
    console.log("[dry-run] Silme yapılmadı.");
    return;
  }

  const idList = targets.map((r) => `'${r.id.replace(/'/g, "''")}'`).join(", ");

  const steps = [
    ["payments", `DELETE FROM payments WHERE order_id IN (${idList})`],
    ["returns", `DELETE FROM returns WHERE order_id IN (${idList})`],
    [
      "proof_validations",
      `DELETE FROM proof_validations WHERE order_id IN (${idList})`,
    ],
    [
      "design_quality_checks",
      `DELETE FROM design_quality_checks WHERE order_id IN (${idList})`,
    ],
    [
      "support_tickets",
      `DELETE FROM support_tickets WHERE order_id IN (${idList})`,
    ],
    ["coupon_uses", `DELETE FROM coupon_uses WHERE order_id IN (${idList})`],
    [
      "fason_order_assignments",
      `DELETE FROM fason_order_assignments WHERE order_id IN (${idList})`,
    ],
    [
      "fason_file_transfers",
      `DELETE FROM fason_file_transfers WHERE order_id IN (${idList})`,
    ],
    [
      "payment_intents",
      `UPDATE payment_intents SET order_id = NULL WHERE order_id IN (${idList})`,
    ],
    ["order_items", `DELETE FROM order_items WHERE order_id IN (${idList})`],
    ["order_events", `DELETE FROM order_events WHERE order_id IN (${idList})`],
    ["orders", `DELETE FROM orders WHERE id IN (${idList})`],
  ];

  for (const [label, sql] of steps) {
    try {
      await q(sql);
      console.log(`OK ${label}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("does not exist") ||
        msg.includes("relation") ||
        msg.includes("42P01")
      ) {
        console.log(`SKIP ${label} (tablo yok)`);
      } else {
        throw err;
      }
    }
  }

  const remaining = await q(
    `SELECT COUNT(*)::int AS cnt FROM orders WHERE ${DEMO_WHERE}`
  );
  console.log(`Kalan Admin Test sipariş: ${remaining[0]?.cnt ?? "?"}`);

  const simUsers = await q(
    `SELECT id, email FROM auth.users WHERE email LIKE 'simulator-%@pimetiket.test'`
  );
  console.log(`Simülatör kullanıcı: ${simUsers.length}`);
  for (const u of simUsers) {
    const delRes = await fetch(
      `https://api.supabase.com/v1/projects/${REF}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `DELETE FROM auth.users WHERE id = '${u.id}'`,
        }),
      }
    );
    if (!delRes.ok) {
      const body = await delRes.text();
      console.warn(`Sim user silinemedi ${u.email}: ${body.slice(0, 200)}`);
    } else {
      console.log(`OK sim user silindi: ${u.email}`);
    }
  }

  const totalOrders = await q(`SELECT COUNT(*)::int AS cnt FROM orders`);
  console.log(`Toplam kalan sipariş: ${totalOrders[0]?.cnt ?? "?"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
