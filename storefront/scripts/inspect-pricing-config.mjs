#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(ROOT, ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    })
);

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await sb
  .from("pricing_config")
  .select("scope, draft_config, live_config");

if (error) {
  console.error(error);
  process.exit(1);
}

function summarize(label, cfg) {
  console.log(`  [${label}] materials:`, cfg.materials?.map((m) => m.id).join(", "));
  for (const [k, g] of Object.entries(cfg.options || {})) {
    console.log(`  [${label}] options.${k}:`, g.items?.map((i) => i.id).join(", "));
  }
  if (cfg.cut_multipliers) {
    console.log(`  [${label}] cut_multipliers:`, JSON.stringify(cfg.cut_multipliers));
  }
}

for (const row of data) {
  if (row.scope === "global") continue;
  console.log("===", row.scope, "===");
  summarize("live", row.live_config);
  summarize("draft", row.draft_config);
  console.log("");
}
