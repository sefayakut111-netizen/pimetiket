#!/usr/bin/env node
/** GA4_SA_PRIVATE_KEY — stdin ile (-----BEGIN flag çakışmasını önler) */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const content = readFileSync(resolve(root, ".env.local"), "utf8");
const line = content.split(/\r?\n/).find((l) => l.startsWith("GA4_SA_PRIVATE_KEY="));
if (!line) {
  console.error("GA4_SA_PRIVATE_KEY yok");
  process.exit(1);
}
let val = line.slice("GA4_SA_PRIVATE_KEY=".length);
if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);

function addArgs(scope) {
  const base = ["vercel@latest", "env", "add", "GA4_SA_PRIVATE_KEY"];
  if (scope === "preview") {
    return [...base, "preview", "main", "--yes", "--sensitive"];
  }
  return [...base, scope, "--yes", "--sensitive"];
}

for (const scope of ["preview", "development"]) {
  if (scope === "preview") {
    // production zaten eklendi
  }
  console.log(`→ GA4_SA_PRIVATE_KEY @ ${scope} (stdin)`);
  const r = spawnSync("npx", addArgs(scope), {
    cwd: root,
    input: val,
    encoding: "utf8",
    shell: true,
  });
  const out = (r.stdout || "") + (r.stderr || "");
  if (r.status !== 0) {
    if (/already exists/i.test(out)) {
      const forceArgs = addArgs(scope).concat(["--force"]);
      const r2 = spawnSync("npx", forceArgs, {
        cwd: root,
        input: val,
        encoding: "utf8",
        shell: true,
      });
      if (r2.status !== 0) {
        console.error(r2.stderr || r2.stdout);
        process.exit(1);
      }
      console.log("  (güncellendi --force)");
    } else {
      console.error(out);
      process.exit(1);
    }
  } else {
    console.log("  OK");
  }
}
