#!/usr/bin/env node
/**
 * Manifest-tabanlı mekanik diff/migration doğrulama (LLM'siz).
 *
 * Kullanım:
 *   node --env-file=.env.agent scripts/verify-cursor-diff.mjs scripts/verify-manifests/<task>.json
 *   npm run verify:cursor-diff -- scripts/verify-manifests/<task>.json
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STOREFRONT_ROOT = join(__dirname, "..");
const GIT_ROOT = join(STOREFRONT_ROOT, "..");
const ENV_AGENT = join(STOREFRONT_ROOT, ".env.agent");

function loadEnvAgent() {
  if (!process.env.SUPABASE_ACCESS_TOKEN && existsSync(ENV_AGENT)) {
    for (const rawLine of readFileSync(ENV_AGENT, "utf8").split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnvAgent();

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error(
    "Manifest gerekli: node scripts/verify-cursor-diff.mjs scripts/verify-manifests/<task>.json"
  );
  process.exit(1);
}

const manifestAbs = manifestPath.startsWith("/") || /^[A-Za-z]:/.test(manifestPath)
  ? manifestPath
  : join(STOREFRONT_ROOT, manifestPath);

if (!existsSync(manifestAbs)) {
  console.error(`Manifest bulunamadı: ${manifestAbs}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestAbs, "utf8"));
const results = [];

function pushResult(label, ok, detail = "") {
  results.push({ label, ok, detail });
  const suffix = ok ? "" : ` — ${detail}`;
  console.log(`${ok ? "✅" : "🔴"} ${label}${suffix}`);
}

function resolveFilePath(file) {
  if (file.startsWith("storefront/")) {
    return join(GIT_ROOT, file);
  }
  return join(STOREFRONT_ROOT, file);
}

function runGitFileList(args) {
  const r = spawnSync("git", args, {
    cwd: GIT_ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    return { ok: false, error: (r.stderr || r.stdout || "git failed").trim() };
  }
  const files = (r.stdout || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return { ok: true, files };
}

function getChangedFiles(commit) {
  if (commit && String(commit).trim()) {
    return runGitFileList([
      "show",
      "--name-only",
      "--pretty=format:",
      String(commit).trim(),
    ]);
  }
  return runGitFileList(["diff", "--name-only", "HEAD~1", "HEAD"]);
}

function findRegexMatch(text, pattern) {
  const re = new RegExp(pattern, "m");
  const match = re.exec(text);
  if (!match) return null;
  const before = text.slice(0, match.index);
  const line = before.split("\n").length;
  return { line, match: match[0] };
}

function looseEqual(a, b) {
  if (a === b) return true;
  if (a == b) return true;
  return String(a) === String(b);
}

function getScalar(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  const row = rows[0];
  if (!row || typeof row !== "object") return undefined;
  const keys = Object.keys(row);
  if (keys.length === 0) return undefined;
  return row[keys[0]];
}

function isReadOnlySql(sql) {
  const stripped = sql
    .replace(/^\s*(--[^\n]*\n)*/g, "")
    .trim()
    .toLowerCase();
  return stripped.startsWith("select");
}

async function querySql(projectRef, sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error("SUPABASE_ACCESS_TOKEN missing");
  }
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`query failed (${res.status}): ${body.slice(0, 400)}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`invalid JSON response: ${body.slice(0, 200)}`);
  }
}

function evaluateExpect(rows, expect) {
  const serialized = JSON.stringify(rows);
  if (expect.includes !== undefined) {
    return serialized.includes(String(expect.includes));
  }
  if (expect.notIncludes !== undefined) {
    return !serialized.includes(String(expect.notIncludes));
  }
  if (expect.rowCount !== undefined) {
    return Array.isArray(rows) && rows.length === expect.rowCount;
  }
  if (expect.scalar !== undefined) {
    return looseEqual(getScalar(rows), expect.scalar);
  }
  return false;
}

async function main() {
  // --- 1) Build ---
  if (manifest.build === true) {
    const r = spawnSync(
      "npx",
      ["tsc", "--noEmit", "-p", "tsconfig.json"],
      { cwd: STOREFRONT_ROOT, encoding: "utf8", shell: true }
    );
    const ok = r.status === 0;
    const detail = ok
      ? ""
      : ((r.stderr || r.stdout || "").trim().slice(0, 500));
    pushResult("build (tsc --noEmit)", ok, detail);
  }

  // --- 2) Changed files (denyInChanged) ---
  const denyPatterns = manifest.denyInChanged ?? [];
  let changedFiles = [];
  let gitListOk = true;
  if (denyPatterns.length > 0) {
    const listed = getChangedFiles(manifest.commit);
    if (!listed.ok) {
      gitListOk = false;
      pushResult("changed files (git)", false, listed.error ?? "git failed");
    } else {
      changedFiles = listed.files.filter((f) => existsSync(join(GIT_ROOT, f)));
    }
  }

  // --- 3) denyInChanged ---
  for (const pattern of denyPatterns) {
    const label = `denyInChanged: ${pattern}`;
    if (!gitListOk) {
      pushResult(label, false, "git dosya listesi alınamadı");
      continue;
    }
    let hit = null;
    let hitFile = null;
    for (const rel of changedFiles) {
      const abs = join(GIT_ROOT, rel);
      try {
        const text = readFileSync(abs, "utf8");
        const m = findRegexMatch(text, pattern);
        if (m) {
          hit = m;
          hitFile = rel;
          break;
        }
      } catch {
        /* skip unreadable */
      }
    }
    if (hit) {
      pushResult(
        label,
        false,
        `${hitFile}:${hit.line} → ${hit.match.slice(0, 80)}`
      );
    } else {
      pushResult(label, true);
    }
  }

  // --- 4) requireInFile ---
  const requireRules = manifest.requireInFile ?? [];
  for (const rule of requireRules) {
    if (!rule?.file || !rule?.pattern) continue;
    const label = `requireInFile: ${rule.file}`;
    const abs = resolveFilePath(rule.file);
    if (!existsSync(abs)) {
      pushResult(label, false, "dosya yok");
      continue;
    }
    const text = readFileSync(abs, "utf8");
    const m = findRegexMatch(text, rule.pattern);
    if (m) {
      pushResult(label, true);
    } else {
      pushResult(label, false, `pattern eşleşmedi: ${rule.pattern}`);
    }
  }

  // --- 5) dbChecks ---
  const dbChecks = manifest.dbChecks ?? [];
  const projectRef =
    manifest.projectRef ??
    process.env.SUPABASE_PROJECT_REF ??
    "ucmpwxnoaqjpzhijnxtp";

  if (dbChecks.length > 0) {
    if (!process.env.SUPABASE_ACCESS_TOKEN) {
      console.warn(
        "⚠️  SUPABASE_ACCESS_TOKEN yok — dbChecks atlandı (build/grep devam etti)"
      );
    } else {
      for (const check of dbChecks) {
        const label = check.label ?? "dbCheck";
        if (!check.sql || !check.expect) {
          pushResult(label, false, "sql veya expect eksik");
          continue;
        }
        if (!isReadOnlySql(check.sql)) {
          pushResult(label, false, "yalnız SELECT izinli");
          continue;
        }
        try {
          const rows = await querySql(projectRef, check.sql);
          const ok = evaluateExpect(rows, check.expect);
          pushResult(
            label,
            ok,
            ok
              ? ""
              : `beklenen ${JSON.stringify(check.expect)}, aldı ${JSON.stringify(rows).slice(0, 200)}`
          );
        } catch (err) {
          pushResult(
            label,
            false,
            err instanceof Error ? err.message : String(err)
          );
        }
      }
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(
    `\n${failed === 0 ? "✅ TÜMÜ GEÇTİ" : `🔴 ${failed} KONTROL DÜŞTÜ`} (${results.length} kontrol)`
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
