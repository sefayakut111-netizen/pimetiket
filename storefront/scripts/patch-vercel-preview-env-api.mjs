#!/usr/bin/env node
/**
 * Vercel REST API ile Preview + Development scope ekler (CLI git_branch_required bypass).
 * Token: %APPDATA%/xdg.data/com.vercel.cli/auth.json (vercel login)
 */
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEAM_ID = "team_VQhNmVvSA3Ctvq3xPzW0McSM";
const PROJECT_ID = "prj_zCd2VsHutNhlIvT3E99fgoQ9Ov8q";

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    let val = t.slice(eq + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, eq)] = val;
  }
  return out;
}

function loadToken() {
  const paths = [
    resolve(homedir(), "AppData/Roaming/xdg.data/com.vercel.cli/auth.json"),
    resolve(homedir(), ".local/share/com.vercel.cli/auth.json"),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, "utf8")).token;
    }
  }
  throw new Error("Vercel auth.json bulunamadı — npx vercel login");
}

async function createEnv(token, { key, value, target, type }) {
  const url = `https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}&upsert=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key, value, target, type }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${key} @ ${target.join(",")}: ${res.status} ${text.slice(0, 200)}`);
  }
  return JSON.parse(text);
}

const env = parseEnvFile(readFileSync(resolve(root, ".env.local"), "utf8"));
const token = loadToken();

const previewVars = [
  { key: "GA4_PROPERTY_ID", type: "encrypted" },
  { key: "GA4_SA_CLIENT_EMAIL", type: "encrypted" },
  { key: "GA4_SA_PRIVATE_KEY", type: "sensitive" },
  { key: "GSC_SITE_URL", type: "encrypted" },
];

console.log("Vercel API — Preview scope (4 env)…");
for (const { key, type } of previewVars) {
  const value = env[key];
  if (!value) throw new Error(`${key} .env.local'da yok`);
  await createEnv(token, { key, value, target: ["preview"], type });
  console.log(`  ✓ ${key}`);
}

console.log("Vercel API — Development GA4_SA_PRIVATE_KEY…");
await createEnv(token, {
  key: "GA4_SA_PRIVATE_KEY",
  value: env.GA4_SA_PRIVATE_KEY,
  target: ["development"],
  type: "encrypted",
});
console.log("  ✓ GA4_SA_PRIVATE_KEY @ development");

console.log("\nDoğrula: npx vercel env ls");
