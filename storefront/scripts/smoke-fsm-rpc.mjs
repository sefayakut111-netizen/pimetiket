#!/usr/bin/env node
/**
 * Canlı RPC smoke — eskiden kırık FSM geçişleri (sadece adminTestOrder siparişi).
 *
 *   node --env-file=.env.agent scripts/smoke-fsm-rpc.mjs
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

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ?? "ucmpwxnoaqjpzhijnxtp";

const SMOKE_TESTS = [
  { from: "qc_pending", to: "ready_to_ship", mode: "forward", label: "AI-QC approve" },
  { from: "qc_pending", to: "human_review_failed", mode: "forward", label: "AI-QC reject" },
  { from: "qc_flagged", to: "proof_generating", mode: "forward", label: "AI-QC fix_and_proof" },
  { from: "operator_review", to: "proof_pending", mode: "forward", label: "operatör reupload" },
  { from: "operator_review", to: "proof_validating", mode: "forward", label: "after-edit" },
  { from: "proof_generating", to: "operator_review", mode: "forward", label: "AI fail" },
  { from: "awaiting_upload", to: "proof_pending", mode: "forward", label: "resume cutline" },
];

async function querySql(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN missing (.env.agent)");
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`query failed (${res.status}): ${body.slice(0, 600)}`);
  return JSON.parse(body);
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

async function main() {
  console.log("FSM RPC smoke (adminTestOrder only)\n");

  const orders = await querySql(
    `SELECT id, status FROM orders
     WHERE payment->>'adminTestOrder' = 'true'
     ORDER BY created_at DESC
     LIMIT 1`
  );
  if (!orders?.length) {
    console.error("adminTestOrder:true sipariş bulunamadı");
    process.exit(1);
  }

  const orderId = orders[0].id;
  const originalStatus = orders[0].status;
  console.log(`Test sipariş: ${orderId} (orijinal status: ${originalStatus})\n`);

  let failed = 0;

  for (const test of SMOKE_TESTS) {
    const tag = `${test.from}→${test.to}`;
    try {
      await querySql(
        `UPDATE orders SET status = '${esc(test.from)}'::order_status, updated_at = now() WHERE id = '${esc(orderId)}'`
      );

      const rpcRows = await querySql(
        `SELECT fn_transition_order_status(
          '${esc(orderId)}',
          '${esc(test.to)}'::order_status,
          ARRAY['${esc(test.from)}']::order_status[],
          '${esc(test.mode)}',
          NULL,
          'system',
          'status_changed',
          'fsm-smoke: ${esc(test.label)}',
          '{"smoke":true}'::jsonb
        ) AS result`
      );
      const result = rpcRows[0]?.result;
      const parsed =
        typeof result === "string" ? JSON.parse(result) : result ?? {};

      const statusRows = await querySql(
        `SELECT status FROM orders WHERE id = '${esc(orderId)}'`
      );
      const currentStatus = statusRows[0]?.status;

      const eventRows = await querySql(
        `SELECT id FROM order_events
         WHERE order_id = '${esc(orderId)}'
           AND summary LIKE 'fsm-smoke:%'
           AND created_at > now() - interval '2 minutes'
         LIMIT 1`
      );

      const pass =
        parsed.ok === true &&
        currentStatus === test.to &&
        eventRows?.length > 0;

      if (pass) {
        console.log(`✅ PASS ${tag} (${test.label})`);
      } else {
        failed++;
        console.log(
          `❌ FAIL ${tag} (${test.label}) — ok=${parsed.ok} status=${currentStatus} event=${eventRows?.length ?? 0}`
        );
      }
    } catch (err) {
      failed++;
      console.log(`❌ FAIL ${tag} — ${err instanceof Error ? err.message : err}`);
    }
  }

  await querySql(
    `UPDATE orders SET status = '${esc(originalStatus)}'::order_status, updated_at = now() WHERE id = '${esc(orderId)}'`
  );
  console.log(`\nOrijinal status geri alındı: ${originalStatus}`);

  if (failed > 0) {
    console.log(`\n${failed} smoke test FAILED`);
    process.exit(1);
  }
  console.log("\nTüm smoke testler PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
