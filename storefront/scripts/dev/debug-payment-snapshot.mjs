#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env.agent"]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const oid = process.argv[2] || "260520262357";
const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: pay } = await admin
  .from("payments")
  .select("merchant_oid")
  .eq("order_id", oid)
  .maybeSingle();
console.log("payment:", pay);

if (pay?.merchant_oid) {
  const { data: intent } = await admin
    .from("payment_intents")
    .select("snapshot")
    .eq("id", pay.merchant_oid)
    .maybeSingle();
  const items = intent?.snapshot?.items ?? [];
  console.log("snapshot items meta:", JSON.stringify(items.map((i) => i.meta ?? i), null, 2));
}

const { data: order } = await admin.from("orders").select("status, sla_proof_deadline").eq("id", oid).single();
console.log("order status:", order);
