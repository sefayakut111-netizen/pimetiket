#!/usr/bin/env node
/**
 * Admin negatif analiz — statik tarama yardımcısı.
 * Çalıştır: node scripts/admin-negative-audit.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const ADMIN_PAGES = join(ROOT, "src/app/admin");
const ADMIN_API = join(ROOT, "src/app/api/admin");

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name === "page.tsx") acc.push(p);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

function read(p) {
  return readFileSync(p, "utf8");
}

const pageFiles = walk(ADMIN_PAGES);
const apiFiles = walk(ADMIN_API);

const silentPatterns = [
  { id: "empty-catch", re: /catch\s*\(\s*\)\s*=>\s*\{\s*\}/ },
  { id: "silent-comment", re: /\/\*\s*silent\s*\*\//i },
  { id: "catch-empty-log-only", re: /catch\s*\([^)]*\)\s*\{\s*console\.(error|warn)/ },
  { id: "catch-set-empty", re: /catch[\s\S]{0,120}setItems\(\[\]\)/ },
];

const pagesSilent = [];
for (const f of pageFiles) {
  const src = read(f);
  const rel = relative(ROOT, f);
  const hits = silentPatterns.filter((p) => p.re.test(src)).map((p) => p.id);
  const hasErrorState =
    /setError|setListError|setFetchError|fetchError|error\s*&&|SetupCard/.test(
      src
    );
  if (hits.length && !hasErrorState) {
    pagesSilent.push({ file: rel, patterns: hits });
  }
}

const apiNoGuard = [];
for (const f of apiFiles) {
  const src = read(f);
  const rel = relative(ROOT, f);
  if (!/assertAdmin|assertPermission/.test(src)) {
    apiNoGuard.push(rel);
  }
}

const vercel = JSON.parse(read(join(ROOT, "vercel.json")));
const cronCount = vercel.crons?.length ?? 0;

const registrySrc = read(join(ROOT, "src/lib/cron-registry.ts"));
const registryCount = (registrySrc.match(/\{\s*name:/g) ?? []).length;

const rbacSrc = read(join(ROOT, "src/lib/admin-rbac.ts"));
const pathPrefixes = [
  ...rbacSrc.matchAll(/prefix:\s*"([^"]+)"/g),
].map((m) => m[1]);

const shellSrc = read(join(ROOT, "src/components/layout/AdminShell.tsx"));
const navHrefs = [
  ...shellSrc.matchAll(/href:\s*"(\/admin[^"]*)"/g),
].map((m) => m[1]);

const rbacGaps = navHrefs.filter((href) => {
  if (href === "/admin" || href.startsWith("/admin/profil")) return false;
  return !pathPrefixes.some(
    (p) => href === p || href.startsWith(p + "/")
  );
});

const e2eSrc = read(join(ROOT, "tests/e2e/admin-journey.spec.ts"));
const e2ePaths = [...e2eSrc.matchAll(/path:\s*"(\/admin[^"]*)"/g)].map(
  (m) => m[1]
);
const e2eMissing = navHrefs.filter((h) => !e2ePaths.includes(h));

console.log(JSON.stringify({
  summary: {
    adminPages: pageFiles.length,
    adminApiRoutes: apiFiles.length,
    apiWithoutGuard: apiNoGuard.length,
    vercelCrons: cronCount,
    cronRegistry: registryCount,
    cronSync: cronCount === registryCount,
    rbacNavGaps: rbacGaps.length,
    e2eCovered: e2ePaths.length,
    e2eMissingFromNav: e2eMissing.length,
    silentFetchRiskPages: pagesSilent.length,
  },
  apiWithoutGuard: apiNoGuard,
  rbacNavGaps: rbacGaps,
  e2eMissingFromNav: e2eMissing,
  silentFetchRiskPages: pagesSilent,
}, null, 2));
