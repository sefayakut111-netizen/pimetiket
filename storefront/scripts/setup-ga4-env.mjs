#!/usr/bin/env node
/**
 * pim-etiket-*.json service account dosyasını okur,
 * .env.local'a GA4_SA_* ve GSC_* env'lerini yazar.
 * Sefa tek seferlik kurulum + key rotate sonrası tekrar koşturur.
 *
 * Kullanım:
 *   node scripts/setup-ga4-env.mjs "C:/Users/msı/Desktop/pim-etiket-a685faafd298.json"
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error("Kullanım: node scripts/setup-ga4-env.mjs <service-account.json>");
  process.exit(1);
}
const sa = JSON.parse(readFileSync(resolve(jsonPath), "utf8"));

const updates = {
  GA4_PROPERTY_ID: "537960859",
  GA4_SA_CLIENT_EMAIL: sa.client_email,
  // Private key newline'ları "\n" literal'i ile escape edilir — Vercel + dotenv pattern
  GA4_SA_PRIVATE_KEY: `"${sa.private_key.replace(/\n/g, "\\n")}"`,
  GSC_SITE_URL: "https://pimetiket.com/",
};

const envPath = resolve(".env.local");
let content = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

for (const [key, val] of Object.entries(updates)) {
  const line = `${key}=${val}`;
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    content += (content.endsWith("\n") ? "" : "\n") + line + "\n";
  }
}

writeFileSync(envPath, content);
console.log("✅ .env.local güncellendi:");
for (const k of Object.keys(updates)) console.log(`  ${k}`);
console.log("\n⚠️ JSON dosyasını commit'leme — .gitignore'a *-service-account*.json ekledim.");
