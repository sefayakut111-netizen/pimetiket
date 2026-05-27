#!/usr/bin/env node
/** Trigger cutline via production/cron API */
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

const orderIds = process.argv.slice(2);
const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET missing");
  process.exit(1);
}

for (const orderId of orderIds) {
  console.log("[cutline-api] triggering for", orderId);
  const res = await fetch(`${base}/api/agents/cutline-generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ orderId }),
  });
  const text = await res.text();
  console.log("[cutline-api]", res.status, text.slice(0, 500));
}
