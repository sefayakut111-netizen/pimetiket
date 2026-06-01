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
const id = "7da5703d-3995-43f8-ba62-5cc6147183a0";

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
  return JSON.parse(await res.text());
}

const partner = await q(
  `SELECT id, name, city, town, contact_email, contact_person, contact_whatsapp, status FROM fason_partners WHERE id = '${id}'`
);
const contacts = await q(
  `SELECT role, name, email, phone_e164 FROM partner_contacts WHERE partner_id = '${id}'`
);
const caps = await q(
  `SELECT capability_type, capability_value, approval_status FROM partner_capabilities WHERE partner_id = '${id}'`
);

console.log(JSON.stringify({ partner, contacts, caps }, null, 2));
