#!/usr/bin/env node
/**
 * proof_generating takılı siparişler için cutline + proof pipeline çalıştır.
 * npx tsx scripts/run-cutline-repair.ts [orderId]
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

async function main() {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
  for (const f of [".env.local", ".env.agent"]) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]])
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }

  const orderIdArg = process.argv[2];

  const { createAdminClient } = await import("../../src/lib/supabase/admin");
  const { runOrderCutlineGeneration } = await import(
    "../../src/lib/agents/run-order-cutline"
  );

  const admin = createAdminClient();

  let orders: { id: string; status: string }[] = [];
  if (orderIdArg) {
    const { data } = await admin
      .from("orders")
      .select("id, status")
      .eq("id", orderIdArg)
      .single();
    if (data) orders = [data as { id: string; status: string }];
  } else {
    const { data } = await admin
      .from("orders")
      .select("id, status")
      .eq("status", "proof_generating");
    orders = (data ?? []) as { id: string; status: string }[];
  }

  for (const o of orders) {
    const { count } = await admin
      .from("cutline_designs")
      .select("id", { count: "exact", head: true })
      .eq("order_id", o.id);
    console.log(
      `[cutline-repair] ${o.id} status=${o.status} existing_cutlines=${count ?? 0}`
    );
    const result = await runOrderCutlineGeneration(admin, o.id);
    console.log("[cutline-repair] result:", result);
    const { data: after } = await admin
      .from("orders")
      .select("status")
      .eq("id", o.id)
      .single();
    console.log("[cutline-repair] status after:", after?.status);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
