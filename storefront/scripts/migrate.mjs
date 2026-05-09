#!/usr/bin/env node
/**
 * Pim Etiket — Migration runner
 *
 * Kullanım:  npm run migrate
 *
 * supabase/migrations/*.sql dosyalarını sırayla Supabase REST API
 * üzerinden çalıştırır. Supabase CLI kurmaya gerek yok.
 *
 * NOT: Resmi yöntem `supabase db push` (CLI). Bu script sadece kolaylık
 * için — alıştığında CLI'ye geçmeni öneririm (migration history tracking
 * + rollback için).
 *
 * Mekanizma:
 *   - SUPABASE_SERVICE_ROLE_KEY ile Supabase REST RPC çağrısı yapılır
 *   - PostgreSQL'in `query` fonksiyonu yok; bunun yerine her dosya
 *     tek satıra düşürüp `pg_stat_statements` benzeri bir hack
 *     gerektirir. AMA: Supabase Dashboard SQL Editor zaten en stabil
 *     yöntem — manuel kullanımı şiddetle öneririm.
 *
 * Bu script şu an SADECE migrations'u listeler ve manuel çalıştırma
 * için kopyala-yapıştır kolaylığı sağlar. Otomatik push için
 * `supabase` CLI:
 *
 *   npm install -g supabase
 *   supabase login
 *   supabase link --project-ref <project-ref>
 *   supabase db push
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const MIG_DIR = resolve(ROOT, "supabase", "migrations");
const ENV_FILE = resolve(ROOT, ".env.local");

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
};

// .env.local'dan project ref çıkar
function loadEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const env = {};
  for (const rawLine of readFileSync(ENV_FILE, "utf-8").split("\n")) {
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
    env[key] = value;
  }
  return env;
}

const env = { ...process.env, ...loadEnv() };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const projectRef = url
  ? new URL(url).hostname.split(".")[0]
  : "<your-project-ref>";

console.log();
console.log(
  `${COLORS.bold}${COLORS.cyan}🗄️  Pim Etiket — Migration runner${COLORS.reset}`
);
console.log();

if (!existsSync(MIG_DIR)) {
  console.error(`${COLORS.red}✗ ${MIG_DIR} bulunamadı${COLORS.reset}`);
  process.exit(1);
}

const files = readdirSync(MIG_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.log(`${COLORS.yellow}Hiç migration dosyası yok.${COLORS.reset}`);
  process.exit(0);
}

console.log(
  `${COLORS.gray}${files.length} migration dosyası bulundu:${COLORS.reset}`
);
console.log();
for (const f of files) {
  const stat = readFileSync(resolve(MIG_DIR, f), "utf-8");
  const lines = stat.split("\n").length;
  console.log(
    `  ${COLORS.cyan}${f}${COLORS.reset} ${COLORS.gray}(${lines} satır)${COLORS.reset}`
  );
}

console.log();
console.log(`${COLORS.bold}İki yöntem:${COLORS.reset}`);
console.log();
console.log(`${COLORS.green}━━━ Yöntem A: Supabase Dashboard ━━━${COLORS.reset}`);
console.log(
  `1. https://supabase.com/dashboard/project/${projectRef}/sql/new`
);
console.log(
  `2. Yukarıdaki dosyaları sırayla aç, içeriği SQL Editor'e yapıştır`
);
console.log(`3. Run (Ctrl+Enter)`);
console.log();
console.log(`${COLORS.green}━━━ Yöntem B: Supabase CLI ━━━${COLORS.reset}`);
console.log(`${COLORS.gray}Otomatik push, migration history, rollback:${COLORS.reset}`);
console.log();
console.log(`  npm install -g supabase`);
console.log(`  supabase login`);
console.log(`  supabase link --project-ref ${projectRef}`);
console.log(`  supabase db push`);
console.log();

// Eğer Supabase CLI mevcutsa otomatik push öner
import { execSync } from "node:child_process";
let cliFound = false;
try {
  execSync("supabase --version", { stdio: "ignore" });
  cliFound = true;
} catch {
  // CLI kurulu değil
}

if (cliFound) {
  console.log(
    `${COLORS.cyan}Supabase CLI tespit edildi.${COLORS.reset}`
  );
  console.log(`Otomatik push için: ${COLORS.bold}supabase db push${COLORS.reset}`);
  console.log();
}
