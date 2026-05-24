#!/usr/bin/env node
/**
 * Akıllı Bağlam (Smart Context) — domain filtreleme CLI
 *
 * Kullanım:
 *   node scripts/smart-context.mjs --path src/app/odeme/page.tsx
 *   node scripts/smart-context.mjs --files "src/lib/pim/**,src/app/api/pim/**"
 *   node scripts/smart-context.mjs --git-diff
 *   node scripts/smart-context.mjs --query "sipariş ödeme akışı"
 *   node scripts/smart-context.mjs --json --path src/app/etiket/yapilandir/page.tsx
 */

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MANIFEST_PATH = join(ROOT, "smart-context", "manifest.json");

function loadManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

/** Basit glob → regex (**, *, ?) */
function globToRegex(pattern) {
  const normalized = pattern.replace(/\\/g, "/");
  const regex = normalized
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, ".")
    .replace(/<<<GLOBSTAR>>>/g, ".*");
  return new RegExp(`^${regex}$`);
}

function matchGlob(pattern, filepath) {
  const norm = filepath.replace(/\\/g, "/").replace(/^\.?\//, "");
  return globToRegex(pattern).test(norm);
}

function matchDomain(domain, filepath) {
  return domain.globs.some((g) => matchGlob(g, filepath));
}

function matchKeywords(domain, query) {
  if (!query) return false;
  const q = query.toLowerCase();
  return domain.keywords.some((kw) => q.includes(kw.toLowerCase()));
}

function normalizePath(input) {
  let p = input.replace(/\\/g, "/").trim();
  if (p.startsWith("pim-etiket/core/storefront/")) {
    p = p.slice("pim-etiket/core/storefront/".length);
  }
  if (p.startsWith("./")) p = p.slice(2);
  return p;
}

function gitChangedFiles() {
  try {
    const out = execSync("git diff --name-only HEAD", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (out) return out.split("\n").map(normalizePath).filter(Boolean);

    const staged = execSync("git diff --cached --name-only", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (staged) return staged.split("\n").map(normalizePath).filter(Boolean);

    const untracked = execSync("git ls-files --others --exclude-standard", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return untracked.split("\n").map(normalizePath).filter(Boolean);
  } catch {
    return [];
  }
}

function parseArgs(argv) {
  const opts = { files: [], paths: [], query: null, gitDiff: false, json: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--git-diff") opts.gitDiff = true;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--query" && argv[i + 1]) opts.query = argv[++i];
    else if (arg === "--path" && argv[i + 1]) opts.paths.push(normalizePath(argv[++i]));
    else if (arg === "--files" && argv[i + 1]) {
      opts.files.push(...argv[++i].split(",").map((f) => normalizePath(f.trim())));
    } else if (!arg.startsWith("-")) {
      opts.paths.push(normalizePath(arg));
    }
  }
  return opts;
}

function resolveDomains(manifest, filepaths, query) {
  const matched = new Map();

  for (const fp of filepaths) {
    for (const domain of manifest.domains) {
      if (matchDomain(domain, fp)) {
        matched.set(domain.id, domain);
      }
    }
  }

  if (query) {
    for (const domain of manifest.domains) {
      if (matchKeywords(domain, query)) {
        matched.set(domain.id, domain);
      }
    }
  }

  return [...matched.values()];
}

function dedupe(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function buildResult(manifest, domains, filepaths) {
  const docs = dedupe(domains.flatMap((d) => d.docs));
  const hubs = dedupe([
    ...manifest.core.hubs,
    ...domains.flatMap((d) => d.hubs),
  ]);
  const claudeAgents = dedupe(domains.flatMap((d) => d.claudeAgents));
  const cursorRules = dedupe(domains.map((d) => d.cursorRule));
  const schemaMigrations = dedupe(domains.flatMap((d) => d.schemaMigrations ?? []));
  const schemaTables = dedupe(domains.flatMap((d) => d.schemaTables ?? []));
  const typeRefs = dedupe(domains.flatMap((d) => d.typeRefs ?? []));

  return {
    version: manifest.version,
    input: { files: filepaths, domainCount: domains.length },
    domains: domains.map((d) => ({
      id: d.id,
      label: d.label,
      schemaMigrations: d.schemaMigrations,
      schemaTables: d.schemaTables,
      typeRefs: d.typeRefs,
    })),
    alwaysRead: manifest.core.alwaysRead,
    sefaRules: manifest.core.sefaRules,
    docs,
    hubs,
    schemaMigrations,
    schemaTables,
    typeRefs,
    claudeAgents,
    cursorRules,
    manifestPath: relative(process.cwd(), MANIFEST_PATH).replace(/\\/g, "/"),
    schemaDoc: "docs/DOMAIN-SCHEMA-REFERENCE.md",
  };
}

function formatMarkdown(result) {
  const lines = [
    "# 🧠 Akıllı Bağlam Raporu",
    "",
    `**Eşleşen domain:** ${result.domains.length ? result.domains.map((d) => d.label).join(", ") : "genel (core only)"}`,
    "",
  ];

  if (result.domains.length) {
    lines.push("## Domain'ler", "");
    for (const d of result.domains) {
      lines.push(`- **${d.label}** (\`${d.id}\`)`);
    }
    lines.push("");
  }

  lines.push("## 📖 Okunacak dokümanlar", "");
  if (result.docs.length) {
    for (const doc of result.docs) lines.push(`- \`${doc}\``);
  } else {
    lines.push("- _(domain'e özel doküman yok — core yeterli)_");
  }
  lines.push("");

  lines.push("## 🔗 Kritik hub dosyalar", "");
  for (const hub of result.hubs.slice(0, 12)) lines.push(`- \`${hub}\``);
  if (result.hubs.length > 12) {
    lines.push(`- _… ve ${result.hubs.length - 12} hub daha_`);
  }
  lines.push("");

  if (result.schemaMigrations?.length || result.schemaTables?.length) {
    lines.push("## 🗄️ Domain şema referansı (modüler)", "");
    lines.push(`Detay: \`${result.schemaDoc}\``, "");
    if (result.schemaTables.length) {
      lines.push("**Tablolar:** " + result.schemaTables.map((t) => `\`${t}\``).join(", "));
      lines.push("");
    }
    if (result.typeRefs.length) {
      lines.push("**TypeScript:** " + result.typeRefs.map((t) => `\`${t}\``).join(", "));
      lines.push("");
    }
    if (result.schemaMigrations.length) {
      lines.push("**Migration SQL (öncelikli okuma):**", "");
      for (const mig of result.schemaMigrations.slice(0, 14)) {
        const path =
          mig.startsWith("supabase/") ? mig : `supabase/migrations/${mig}`;
        lines.push(`- \`${path}\``);
      }
      if (result.schemaMigrations.length > 14) {
        lines.push(`- _… ve ${result.schemaMigrations.length - 14} migration daha_`);
      }
      lines.push("");
    }
  }

  if (result.claudeAgents.length) {
    lines.push("## 🤖 Claude agent'ları", "");
    for (const agent of result.claudeAgents) {
      lines.push(`- \`.claude/agents/${agent}.md\``);
    }
    lines.push("");
  }

  if (result.cursorRules.length) {
    lines.push("## ⚡ Cursor kuralları (otomatik glob)", "");
    for (const rule of result.cursorRules) {
      lines.push(`- \`.cursor/rules/${rule}\``);
    }
    lines.push("");
  }

  lines.push("## 📌 Sefa kuralları (her zaman)", "");
  for (const rule of result.sefaRules) lines.push(`- ${rule}`);
  lines.push("");

  lines.push(
    "---",
    `_Manifest: \`${result.manifestPath}\` · Tekrar üret: \`npm run context -- --path <dosya>\`_`
  );

  return lines.join("\n");
}

function main() {
  const manifest = loadManifest();
  const opts = parseArgs(process.argv);

  let filepaths = [...opts.paths, ...opts.files];

  if (opts.gitDiff) {
    filepaths = dedupe([...filepaths, ...gitChangedFiles()]);
  }

  if (!filepaths.length && !opts.query) {
    console.error(`Kullanım:
  npm run context -- --path src/app/odeme/page.tsx
  npm run context -- --files "src/lib/pim/**"
  npm run context -- --git-diff
  npm run context -- --query "fiyat motoru"
  npm run context -- --json --path src/app/etiket/yapilandir/page.tsx`);
    process.exit(1);
  }

  const domains = resolveDomains(manifest, filepaths, opts.query);
  const result = buildResult(manifest, domains, filepaths);

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatMarkdown(result));
  }
}

main();
