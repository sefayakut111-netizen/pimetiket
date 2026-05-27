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

const oid = process.argv[2];
const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: items } = await admin.from("order_items").select("meta").eq("order_id", oid);
const meta = items?.[0]?.meta ?? {};
const ids = [
  meta.designTempId,
  ...(meta.additionalDesigns ?? []).map((d) => d.tempId),
].filter(Boolean);

for (const id of ids) {
  const path = `${oid}/${id}.png`;
  const { data, error } = await admin.storage.from("designs").download(path);
  console.log(path, error ? error.message : "OK " + (await data.arrayBuffer()).byteLength);
}
