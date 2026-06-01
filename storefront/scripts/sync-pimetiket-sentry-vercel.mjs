#!/usr/bin/env node
/**
 * Pim Etiket Sentry → Vercel env sync
 *
 * Usage:
 *   SENTRY_AUTH_TOKEN=sntrys_... node scripts/sync-pimetiket-sentry-vercel.mjs
 *
 * Fetches DSN from pimetiket / javascript-nextjs (EU), updates Vercel env, triggers redeploy.
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(join(dirname(fileURLToPath(import.meta.url)), ".."));

const ORG = "pimetiket";
const PROJECT = "javascript-nextjs";
const REGION = "https://de.sentry.io";
const token = process.env.SENTRY_AUTH_TOKEN?.trim();

if (!token) {
  console.error("SENTRY_AUTH_TOKEN gerekli (pimetiket@gmail.com → User Settings → Auth Tokens)");
  process.exit(1);
}

async function sentryFetch(path) {
  const res = await fetch(`${REGION}/api/0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sentry API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

function vercelEnvUpdate(name, value, environments = ["production", "preview"]) {
  for (const env of environments) {
    try {
      execSync(`npx vercel env rm ${name} ${env} --yes`, { stdio: "pipe" });
    } catch {
      /* may not exist */
    }
    execSync(`echo ${JSON.stringify(value)} | npx vercel env add ${name} ${env} --yes`, {
      stdio: "inherit",
      shell: true,
    });
  }
}

console.log("Sentry org doğrulanıyor…");
const orgs = await sentryFetch("/organizations/");
const org = orgs.find((o) => o.slug === ORG);
if (!org) {
  console.error(`Org "${ORG}" bulunamadı. Erişilebilir: ${orgs.map((o) => o.slug).join(", ")}`);
  process.exit(1);
}

console.log("Proje DSN alınıyor…");
const keys = await sentryFetch(`/projects/${ORG}/${PROJECT}/keys/`);
const dsn = keys[0]?.dsn?.public;
if (!dsn || !dsn.includes("ingest.de.sentry.io")) {
  console.error("DSN alınamadı veya EU region değil:", dsn);
  process.exit(1);
}

console.log("Vercel env güncelleniyor…");
vercelEnvUpdate("NEXT_PUBLIC_SENTRY_DSN", dsn);
vercelEnvUpdate("SENTRY_AUTH_TOKEN", token);
vercelEnvUpdate("SENTRY_ORG", ORG);
vercelEnvUpdate("SENTRY_PROJECT", PROJECT);

console.log("\nTamam.");
console.log(`  ORG:     ${ORG}`);
console.log(`  PROJECT: ${PROJECT}`);
console.log(`  DSN:     ${dsn.slice(0, 40)}…`);
console.log("\nProduction redeploy: npx vercel --prod");
