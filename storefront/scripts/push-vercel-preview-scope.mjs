#!/usr/bin/env node
/**
 * Preview + Development scope tamamlama (GA4/GSC).
 * Yöntem sırası: stdin preview → empty-branch workaround → preview main → --git-branch=main
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

function run(args, input) {
  const r = spawnSync("npx", ["vercel@latest", ...args], {
    cwd: root,
    input,
    encoding: "utf8",
    shell: true,
  });
  return {
    ok: r.status === 0,
    out: ((r.stdout || "") + (r.stderr || "")).trim(),
  };
}

function addPreview(key, val, sensitive) {
  const sens = sensitive ? ["--sensitive"] : [];
  const attempts = [
    { label: "stdin preview --yes", args: ["env", "add", key, "preview", "--yes", ...sens] },
    {
      label: 'stdin preview --yes "" (all branches)',
      args: ["env", "add", key, "preview", "--yes", "--non-interactive", "", ...sens],
    },
    {
      label: "stdin preview main (positional branch)",
      args: ["env", "add", key, "preview", "main", "--yes", ...sens],
    },
    {
      label: "--git-branch=main --value",
      args: ["env", "add", key, "preview", "--git-branch=main", "--yes", "--value", val, ...sens],
      useValue: true,
    },
  ];

  for (const a of attempts) {
    console.log(`  try: ${a.label}`);
    let r = run(a.args, a.useValue ? undefined : val);
    if (!r.ok && /already exists/i.test(r.out)) {
      r = run([...a.args, "--force"], a.useValue ? undefined : val);
    }
    if (r.ok) {
      console.log(`  ✓ ${key} @ preview (${a.label})`);
      return a.label;
    }
    if (!/git_branch_required|branch_not_found|invalid_arguments/i.test(r.out)) {
      console.log(`  ✗ ${r.out.slice(0, 200)}`);
    }
  }
  return null;
}

function addDevelopmentPrivateKey(val) {
  const attempts = [
    { label: "stdin development --yes --sensitive", args: ["env", "add", "GA4_SA_PRIVATE_KEY", "development", "--yes", "--sensitive"] },
    {
      label: "stdin development --no-sensitive",
      args: ["env", "add", "GA4_SA_PRIVATE_KEY", "development", "--yes", "--no-sensitive"],
    },
  ];
  for (const a of attempts) {
    console.log(`→ GA4_SA_PRIVATE_KEY @ development — ${a.label}`);
    let r = run(a.args, a.useValue ? undefined : val);
    if (!r.ok && /already exists/i.test(r.out)) {
      r = run([...a.args, "--force"], a.useValue ? undefined : val);
    }
    if (r.ok) {
      console.log("  ✓ development OK");
      return a.label;
    }
    console.log(`  ✗ ${r.out.slice(0, 200)}`);
  }
  return null;
}

if (!existsSync(resolve(root, ".env.local"))) {
  console.error("❌ .env.local yok");
  process.exit(1);
}

const env = parseEnvFile(readFileSync(resolve(root, ".env.local"), "utf8"));
const previewKeys = [
  ["GA4_PROPERTY_ID", false],
  ["GA4_SA_CLIENT_EMAIL", false],
  ["GA4_SA_PRIVATE_KEY", true],
  ["GSC_SITE_URL", false],
];

const results = { preview: {}, development: null };

for (const [key, sensitive] of previewKeys) {
  const val = env[key]?.trim();
  if (!val) {
    console.error(`❌ .env.local: ${key} eksik`);
    process.exit(1);
  }
  console.log(`\n→ ${key} @ preview`);
  results.preview[key] = addPreview(key, val, sensitive);
}

results.development = addDevelopmentPrivateKey(env.GA4_SA_PRIVATE_KEY);

console.log("\n--- özet ---");
for (const [k, m] of Object.entries(results.preview)) {
  console.log(`  ${k} preview: ${m ?? "BAŞARISIZ → dashboard (YÖNTEM 2)"}`);
}
console.log(
  `  GA4_SA_PRIVATE_KEY development: ${results.development ?? "BAŞARISIZ → dashboard"}`
);

const failed = Object.values(results.preview).some((v) => !v) || !results.development;
process.exit(failed ? 1 : 0);
