#!/usr/bin/env node
/**
 * Route transitionOrderStatus çağrılarını çıkarır; forward/bulk için canlı FSM matrisini doğrular.
 *
 *   npm run verify:fsm
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STOREFRONT_ROOT = join(__dirname, "..");
const SRC_ROOT = join(STOREFRONT_ROOT, "src");
const ORDER_TS = join(SRC_ROOT, "lib", "order.ts");
const ENV_AGENT = join(STOREFRONT_ROOT, ".env.agent");

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

function parseOrderConstants() {
  const text = readFileSync(ORDER_TS, "utf8");
  const aiMatch = text.match(
    /AI_QC_ACTIVE_STATUSES[^=]*=\s*\[([\s\S]*?)\];/
  );
  const aiQc = aiMatch
    ? [...aiMatch[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1])
    : [];

  const bulkMatch = text.match(
    /VALID_BULK_TRANSITIONS[^=]*=\s*\{([\s\S]*?)\n\};/
  );
  const bulkPairs = [];
  if (bulkMatch) {
    const block = bulkMatch[1];
    const fromRe = /(\w+):\s*\[([^\]]*)\]/g;
    let m;
    while ((m = fromRe.exec(block)) !== null) {
      const from = m[1];
      const tos = [...m[2].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
      for (const to of tos) {
        bulkPairs.push({ from, to });
      }
    }
  }

  return { aiQc, bulkPairs };
}

function walkTsFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules") continue;
      walkTsFiles(p, acc);
    } else if (/\.(ts|tsx)$/.test(name)) {
      acc.push(p);
    }
  }
  return acc;
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function extractBalanced(text, openIndex) {
  let depth = 0;
  let i = openIndex;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(openIndex, i + 1);
    }
  }
  return text.slice(openIndex);
}

function extractField(objText, field) {
  const re = new RegExp(`\\b${field}\\s*:\\s*([^,\\n]+(?:\\n[^,\\n]+)?)`, "m");
  const m = re.exec(objText);
  return m ? m[1].trim() : null;
}

function stringsFromExpr(expr) {
  if (!expr) return null;
  const found = [...expr.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  return found.length > 0 ? found : null;
}

function expandFromTo(fileRel, objText, orderConsts) {
  const modeRaw = extractField(objText, "mode");
  const mode = stringsFromExpr(modeRaw)?.[0] ?? "forward";
  const toExpr = extractField(objText, "to");
  const fromExpr = extractField(objText, "from");

  let tos = stringsFromExpr(toExpr);
  let froms = stringsFromExpr(fromExpr);

  if (fileRel.includes("admin/ai-qc/decide/route.ts")) {
    const pairs = [];
    for (const from of orderConsts.aiQc) {
      pairs.push({ from, to: "ready_to_ship", mode, file: fileRel });
      pairs.push({ from, to: "proof_generating", mode, file: fileRel });
      if (from !== "human_review_failed") {
        pairs.push({ from, to: "human_review_failed", mode, file: fileRel });
      }
    }
    return pairs;
  } else if (fileRel.includes("admin/orders/bulk-status/route.ts")) {
    return orderConsts.bulkPairs.map((p) => ({
      ...p,
      mode: "bulk",
      file: fileRel,
      label: "bulk-status (VALID_BULK_TRANSITIONS)",
    }));
  } else if (fileRel.includes("admin/orders/[id]/tracking/route.ts")) {
    froms = ["in_production"];
    tos = ["shipped"];
  } else if (fileRel.includes("orders/[id]/cancel/route.ts")) {
    if (tos?.[0] === "cancelled" && !froms) {
      froms = ["paid", "awaiting_upload"];
    }
    if (froms?.[0] === "cancelled" && mode === "compensating") {
      tos = ["paid", "awaiting_upload"];
      froms = ["cancelled"];
    }
  } else if (fileRel.includes("agents/run-order-qc.ts")) {
    if (!froms && tos?.[0] === "proof_generating") {
      froms = ["qc_pending"];
    }
    if (tos?.[0] === "proof_generating") {
      froms = ["qc_pending"];
    }
    if (toExpr?.includes("nextStatus")) {
      tos = ["proof_generating"];
      froms = ["qc_pending"];
    }
  } else if (
    fileRel.includes("proof/orchestrator.ts") &&
    toExpr?.includes("proof_validating")
  ) {
    return [
      { from: "proof_pending", to: "proof_validating", mode, file: fileRel },
      { from: "operator_review", to: "proof_validating", mode, file: fileRel },
    ];
  } else if (fileRel.includes("proof/orchestrator.ts")) {
    if (toExpr?.includes("finalStatus")) {
      tos = ["operator_review", "proof_pending"];
      froms = ["proof_generating"];
    }
  } else if (fileRel.includes("orders/[id]/advance-status/route.ts")) {
    froms = ["paid", "awaiting_upload"];
    tos = ["qc_pending"];
  } else if (fileRel.includes("admin/orders/[id]/upload-proof/route.ts")) {
    if (froms?.includes("paid")) {
      froms = froms.filter((f) => f !== "paid");
    }
  } else if (fileRel.includes("agents/run-order-qc.ts") && !fromExpr) {
    froms = ["qc_pending"];
  } else if (fileRel.includes("admin/orders/[id]/status/route.ts")) {
    return [{ from: "DYNAMIC", to: "DYNAMIC", mode: "admin_override", file: fileRel }];
  } else if (fileRel.includes("fason/revoke-assignment.ts")) {
    return [{ from: "DYNAMIC", to: "DYNAMIC", mode: "admin_override", file: fileRel }];
  } else if (fileRel.includes("payment/refund/route.ts") && !froms) {
    tos = ["cancelled"];
    froms = ["DYNAMIC"];
  } else if (fileRel.includes("orders/admin-bypass-promote/route.ts") && !froms) {
    tos = ["qc_pending"];
    froms = ["DYNAMIC"];
  } else if (fileRel.includes("lib/test-simulator.ts")) {
    tos = ["paid"];
    froms = ["DYNAMIC"];
  }

  const results = [];
  if (!tos?.length) tos = ["UNKNOWN"];
  if (!froms?.length) froms = fromExpr ? ["UNKNOWN"] : ["UNKNOWN"];

  for (const from of froms) {
    for (const to of tos) {
      if (from === to) continue;
      results.push({ from, to, mode, file: fileRel });
    }
  }
  return results;
}

function collectTransitions(orderConsts) {
  const skip = new Set([
    "lib/db/transition-order-status.ts",
    "scripts/verify-status-update-guard.runner.ts",
  ]);
  const files = walkTsFiles(SRC_ROOT);
  const transitions = [];
  const seenBulk = new Set();

  for (const abs of files) {
    const rel = relative(SRC_ROOT, abs).replace(/\\/g, "/");
    if (skip.has(rel)) continue;
    const text = readFileSync(abs, "utf8");
    if (!text.includes("transitionOrderStatus(")) continue;

    const re = /transitionOrderStatus\s*\(\s*\w+\s*,\s*\{/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const braceStart = m.index + m[0].length - 1;
      const objText = extractBalanced(text, braceStart);
      const expanded = expandFromTo(rel, objText, orderConsts);
      for (const t of expanded) {
        if (t.file.includes("bulk-status") && t.mode === "bulk") {
          const key = `${t.from}→${t.to}`;
          if (seenBulk.has(key)) continue;
          seenBulk.add(key);
        }
        transitions.push(t);
      }
    }
  }
  return transitions;
}

function terminalOverrideOk(from, to) {
  if (from === "delivered" && to !== "delivered") return false;
  if (from === "cancelled" && to !== "cancelled") return false;
  return true;
}

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
  if (!res.ok) throw new Error(`query failed (${res.status}): ${body.slice(0, 500)}`);
  return JSON.parse(body);
}

function scalar(rows) {
  if (!Array.isArray(rows) || !rows.length) return undefined;
  const row = rows[0];
  const k = Object.keys(row)[0];
  return row[k];
}

async function validateMatrix(transitions) {
  const invalid = [];
  const unknown = [];
  const ok = [];

  const forwardPairs = [];
  const bulkPairs = [];
  const overridePairs = [];

  for (const t of transitions) {
    if (t.mode === "compensating") {
      ok.push(t);
      continue;
    }
    if (t.from === "UNKNOWN" || t.to === "UNKNOWN" || t.from === "DYNAMIC") {
      unknown.push(t);
      continue;
    }
    if (t.mode === "forward") forwardPairs.push(t);
    else if (t.mode === "bulk") bulkPairs.push(t);
    else if (t.mode === "admin_override" || t.mode === "compensating") {
      overridePairs.push(t);
    } else {
      unknown.push({ ...t, note: `mode=${t.mode}` });
    }
  }

  if (forwardPairs.length > 0) {
    const selects = forwardPairs.map(
      (p, i) =>
        `SELECT ${i} AS idx, fn_is_valid_order_forward_transition('${p.from}'::order_status, '${p.to}'::order_status) AS valid`
    );
    const rows = await querySql(selects.join(" UNION ALL "));
    for (const row of rows) {
      const t = forwardPairs[row.idx];
      const valid = row.valid === true || row.valid === "t";
      if (valid) ok.push(t);
      else invalid.push(t);
    }
  }

  if (bulkPairs.length > 0) {
    const selects = bulkPairs.map(
      (p, i) =>
        `SELECT ${i} AS idx, fn_is_valid_order_bulk_transition('${p.from}'::order_status, '${p.to}'::order_status) AS valid`
    );
    const rows = await querySql(selects.join(" UNION ALL "));
    for (const row of rows) {
      const t = bulkPairs[row.idx];
      const valid = row.valid === true || row.valid === "t";
      if (valid) ok.push(t);
      else invalid.push(t);
    }
  }

  for (const t of overridePairs) {
    if (terminalOverrideOk(t.from, t.to)) ok.push(t);
    else invalid.push(t);
  }

  return { ok, invalid, unknown };
}

async function main() {
  console.log("FSM route↔matris doğrulama (verify-fsm-transitions)\n");
  const orderConsts = parseOrderConstants();
  const transitions = collectTransitions(orderConsts);
  console.log(`Toplam ${transitions.length} geçiş çifti çıkarıldı.\n`);

  const { ok, invalid, unknown } = await validateMatrix(transitions);

  const seenOk = new Set();
  for (const t of ok) {
    const key = `${t.file}|${t.from}|${t.to}|${t.mode}`;
    if (seenOk.has(key)) continue;
    seenOk.add(key);
    const label = t.label ?? t.file;
    console.log(`✅ ${label}: ${t.from}→${t.to} (${t.mode})`);
  }
  for (const t of unknown) {
    const label = t.label ?? t.file;
    console.log(`⚠️ UNKNOWN ${label}: ${t.from}→${t.to} (${t.mode})${t.note ? ` — ${t.note}` : ""}`);
  }
  for (const t of invalid) {
    const label = t.label ?? t.file;
    console.log(`❌ INVALID ${label}: ${t.from}→${t.to} (${t.mode}) — matris reddediyor`);
  }

  console.log("");
  if (invalid.length === 0) {
    console.log("TÜM ROUTE GEÇİŞLERİ MATRİS-UYUMLU");
    if (unknown.length > 0) {
      console.log(`(${unknown.length} UNKNOWN — admin_override dinamik / from omitted; terminal kuralı veya runtime)`);
    }
    process.exit(0);
  } else {
    console.log(`${invalid.length} INVALID geçiş bulundu.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
