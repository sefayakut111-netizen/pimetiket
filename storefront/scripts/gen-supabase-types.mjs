#!/usr/bin/env node
/**
 * Regenerate types.ts with SUPABASE_ACCESS_TOKEN from .env.agent
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_AGENT = join(__dirname, "..", ".env.agent");
const OUT = join(__dirname, "..", "src", "lib", "supabase", "types.ts");
const PROJECT_ID = "ucmpwxnoaqjpzhijnxtp";

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

if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN missing (.env.agent)");
  process.exit(1);
}

const result = spawnSync(
  "npx",
  [
    "supabase",
    "gen",
    "types",
    "typescript",
    "--project-id",
    PROJECT_ID,
  ],
  {
    encoding: "utf8",
    env: process.env,
    shell: true,
    maxBuffer: 50 * 1024 * 1024,
  }
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

writeFileSync(OUT, result.stdout, "utf8");
console.log(`Wrote ${OUT} (${result.stdout.length} chars)`);
