#!/usr/bin/env node
/**
 * FAZ 1.3 — orders.status doğrudan update grep guard.
 * transition-order-status modülü dışında yasak.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

const ALLOW_PATH_PARTS = [
  "lib/db/transition-order-status.ts",
  "lib/supabase/types.ts",
];

/** Yalnız orders tablosuna zincirlenmiş .update({ status ... }) */
const FORBIDDEN =
  /\.from\s*\(\s*["']orders["']\s*\)\s*\.update\s*\(\s*\{[^}]*\bstatus\b/;

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, files);
    } else if (/\.(ts|tsx)$/.test(name)) {
      files.push(p);
    }
  }
  return files;
}

function isAllowed(rel: string): boolean {
  const norm = rel.replace(/\\/g, "/");
  return ALLOW_PATH_PARTS.some((part) => norm.endsWith(part));
}

const violations: string[] = [];

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  if (isAllowed(rel)) continue;
  const content = readFileSync(file, "utf8");
  if (FORBIDDEN.test(content)) {
    violations.push(rel);
  }
}

if (violations.length > 0) {
  console.error("[verify:status-update-guard] orders.status bypass bulundu:");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  console.error(
    "Kullan: transitionOrderStatus() — src/lib/db/transition-order-status.ts"
  );
  process.exit(1);
}

console.log("[verify:status-update-guard] OK — doğrudan orders.status update yok");
