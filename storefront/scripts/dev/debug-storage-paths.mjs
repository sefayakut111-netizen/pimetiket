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

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const paths = [
  "temp/73c4bcab-5d2e-413d-87f0-5a1b1098aedd/d6a64232-7eed-4e9d-949b-47a7b84b72de.png",
  "270520268437/d6a64232-7eed-4e9d-949b-47a7b84b72de.png",
  "design-previews/73c4bcab-5d2e-413d-87f0-5a1b1098aedd/d6a64232-7eed-4e9d-949b-47a7b84b72de.png",
];

for (const bucket of ["designs", "design-previews"]) {
  for (const p of paths.filter((x) => !x.startsWith("design-previews"))) {
    const { data, error } = await admin.storage.from(bucket).download(p);
    console.log(
      bucket + "/" + p,
      error ? error.message : "OK " + (await data.arrayBuffer()).byteLength + "b"
    );
  }
}
