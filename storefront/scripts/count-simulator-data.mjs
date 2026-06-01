#!/usr/bin/env node
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
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvAgent();

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF ?? "ucmpwxnoaqjpzhijnxtp";

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
  if (!res.ok) throw new Error(`${res.status} ${body}`);
  return JSON.parse(body);
}

const queries = [
  [
    "cleanup pattern PE-%-SIM%",
    "SELECT COUNT(*)::int AS cnt FROM orders WHERE id LIKE 'PE-%-SIM%'",
  ],
  [
    "payment is_simulator_test",
    "SELECT COUNT(*)::int AS cnt FROM orders WHERE (payment->>'is_simulator_test')::boolean IS TRUE",
  ],
  [
    "id DDMMYYYY99XX pattern",
    "SELECT COUNT(*)::int AS cnt FROM orders WHERE id ~ '^[0-9]{8}99[0-9]{2}$'",
  ],
  [
    "sample simulator orders",
    "SELECT id, status, created_at FROM orders WHERE (payment->>'is_simulator_test')::boolean IS TRUE ORDER BY created_at DESC LIMIT 10",
  ],
  [
    "simulator auth users",
    "SELECT COUNT(*)::int AS cnt FROM auth.users WHERE email LIKE 'simulator-%@pimetiket.test'",
  ],
  [
    "total orders",
    "SELECT COUNT(*)::int AS cnt FROM orders",
  ],
  [
    "heuristic test orders (admin filter)",
    "SELECT id, status, address->>'name' AS customer_name, created_at FROM orders WHERE LOWER(COALESCE(address->>'name','')) LIKE '%test%' OR LOWER(id) LIKE '%test%' OR id = '00000001' ORDER BY created_at DESC",
  ],
  [
    "simulator auth user emails",
    "SELECT email, created_at FROM auth.users WHERE email LIKE 'simulator-%@pimetiket.test'",
  ],
];

for (const [label, sql] of queries) {
  console.log(`--- ${label}`);
  console.log(JSON.stringify(await q(sql), null, 2));
}
