#!/usr/bin/env node
/**
 * Pim Etiket — Health check
 *
 * Kullanım:  npm run check
 *
 * Şunu kontrol eder:
 *   - .env.local var mı, gerekli değişkenler dolu mu
 *   - Supabase URL ping atılabiliyor mu
 *   - Supabase auth API ulaşılabilir mi
 *   - Migration tabloları DB'de var mı (15 tablo bekleniyor)
 *   - iyzico endpoint reachable mi
 *   - Resend API reachable mi
 *
 * Env gizli değer içerir, sadece "set/not set" gösterir, asla print etmez.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
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

const SYMBOLS = {
  ok: `${COLORS.green}✓${COLORS.reset}`,
  warn: `${COLORS.yellow}○${COLORS.reset}`,
  fail: `${COLORS.red}✗${COLORS.reset}`,
};

// ============================================================
// Load .env.local manually (Node.js 20+ has --env-file but we
// want broader compat)
// ============================================================

function loadEnvFile() {
  if (!existsSync(ENV_FILE)) return {};
  const content = readFileSync(ENV_FILE, "utf-8");
  const env = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip surrounding quotes
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

const env = { ...process.env, ...loadEnvFile() };

const checks = [];
const results = { ok: 0, warn: 0, fail: 0 };

function add(label, status, detail) {
  checks.push({ label, status, detail });
  results[status]++;
}

function row(label, status, detail) {
  const sym = SYMBOLS[status];
  const labelPad = label.padEnd(36);
  const detailColor =
    status === "ok"
      ? COLORS.gray
      : status === "warn"
      ? COLORS.yellow
      : COLORS.red;
  console.log(`${sym} ${labelPad}${detailColor}${detail ?? ""}${COLORS.reset}`);
}

// ============================================================
// Env presence checks
// ============================================================

function checkEnvVar(name, required = true) {
  const value = env[name];
  if (!value) {
    if (required) {
      add(name, "fail", "MISSING");
      return null;
    }
    add(name, "warn", "not set (optional)");
    return null;
  }
  // Sadece set/not set göster — değeri ASLA yazma
  // Sadece SITE_URL public değeri için ufak istisna
  if (name === "NEXT_PUBLIC_SITE_URL") {
    add(name, "ok", value);
  } else if (name === "IYZICO_BASE_URL") {
    add(name, "ok", value);
  } else if (name === "RESEND_FROM_EMAIL") {
    // Bilgilendirme amaçlı domain göster
    add(name, "ok", value.replace(/<.*>/, "<...>"));
  } else if (name === "NETGSM_HEADER") {
    add(name, "ok", value);
  } else {
    add(name, "ok", "set");
  }
  return value;
}

// ============================================================
// Network checks
// ============================================================

async function ping(url, label, timeout = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: ctrl.signal,
      // Bazı endpoint HEAD reddediyor → GET fallback yapılabilir
    });
    clearTimeout(timer);
    if (res.status >= 200 && res.status < 500) {
      add(label, "ok", `${res.status} ${res.statusText || ""}`.trim());
      return true;
    }
    add(label, "fail", `${res.status} ${res.statusText}`);
    return false;
  } catch (err) {
    clearTimeout(timer);
    add(label, "fail", err.message ?? "unreachable");
    return false;
  }
}

async function pingSupabaseAuth(url, anonKey) {
  if (!url || !anonKey) {
    add("Supabase auth API", "fail", "URL/key eksik");
    return false;
  }
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
    });
    if (res.ok) {
      add("Supabase auth API", "ok", "reachable");
      return true;
    }
    add("Supabase auth API", "fail", `HTTP ${res.status}`);
    return false;
  } catch (err) {
    add("Supabase auth API", "fail", err.message);
    return false;
  }
}

async function checkMigrationTables(url, serviceKey) {
  if (!url || !serviceKey) {
    add("Migration tables", "warn", "service_role yok, atlandı");
    return;
  }
  const expected = [
    "profiles",
    "addresses",
    "cart_items",
    "orders",
    "order_items",
    "wallet_transactions",
    "order_events",
    "payments",
    "returns",
    "design_files",
    "notification_prefs",
    "audit_log",
    "coupons",
    "coupon_uses",
    "reviews",
    "payment_intents",
  ];

  let found = 0;
  for (const table of expected) {
    try {
      // PostgREST: HEAD `?select=*&limit=0` ile var mı kontrolü
      const res = await fetch(
        `${url}/rest/v1/${table}?select=*&limit=0`,
        {
          method: "HEAD",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        }
      );
      if (res.status === 200 || res.status === 206) found++;
    } catch {
      // network hatası — skip
    }
  }

  if (found === expected.length) {
    add("Migration tables", "ok", `${found}/${expected.length} tablo bulundu`);
  } else if (found === 0) {
    add(
      "Migration tables",
      "fail",
      `0/${expected.length} — migration'lar çalıştırılmamış`
    );
  } else {
    add(
      "Migration tables",
      "warn",
      `${found}/${expected.length} — bazı migration eksik`
    );
  }
}

// ============================================================
// Run
// ============================================================

console.log();
console.log(
  `${COLORS.bold}${COLORS.cyan}🔍  Pim Etiket — Health check${COLORS.reset}`
);
console.log();

// .env.local dosyası
if (!existsSync(ENV_FILE)) {
  console.log(
    `${SYMBOLS.fail} ${".env.local".padEnd(36)}${COLORS.red}bulunamadı (kopyala: cp .env.example .env.local)${COLORS.reset}`
  );
  process.exit(1);
}

console.log(`${COLORS.gray}── Environment ──${COLORS.reset}`);

// Public site URL
checkEnvVar("NEXT_PUBLIC_SITE_URL");

// Supabase
const supaUrl = checkEnvVar("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = checkEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = checkEnvVar("SUPABASE_SERVICE_ROLE_KEY");

// iyzico
checkEnvVar("IYZICO_API_KEY", false);
checkEnvVar("IYZICO_SECRET_KEY", false);
checkEnvVar("IYZICO_BASE_URL", false);

// Resend
checkEnvVar("RESEND_API_KEY", false);
checkEnvVar("RESEND_FROM_EMAIL", false);

// Netgsm (opsiyonel)
checkEnvVar("NETGSM_USERCODE", false);
checkEnvVar("NETGSM_HEADER", false);

// OpenAI (opsiyonel)
checkEnvVar("OPENAI_API_KEY", false);

// Print env results
for (const c of checks) row(c.label, c.status, c.detail);
checks.length = 0;

// ============================================================
// Production sanity checks
// ============================================================

const isProdSiteUrl =
  env.NEXT_PUBLIC_SITE_URL?.startsWith("https://") &&
  !env.NEXT_PUBLIC_SITE_URL.includes("localhost") &&
  !env.NEXT_PUBLIC_SITE_URL.includes("127.0.0.1");

if (isProdSiteUrl) {
  console.log();
  console.log(`${COLORS.gray}── Production sanity ──${COLORS.reset}`);

  // iyzico: prod URL'de prod key olmalı
  if (env.IYZICO_BASE_URL?.includes("sandbox")) {
    add(
      "iyzico URL/key match",
      "fail",
      "PROD site + SANDBOX iyzico — yanlış"
    );
  } else if (
    env.IYZICO_API_KEY?.startsWith("sandbox-") &&
    !env.IYZICO_BASE_URL?.includes("sandbox")
  ) {
    add(
      "iyzico URL/key match",
      "fail",
      "PROD URL ama SANDBOX key (sandbox- prefix)"
    );
  } else if (env.IYZICO_BASE_URL && env.IYZICO_API_KEY) {
    add("iyzico URL/key match", "ok", "production tutarlı");
  }

  // Resend FROM domain prod URL ile uyuşuyor mu?
  if (env.RESEND_FROM_EMAIL && env.NEXT_PUBLIC_SITE_URL) {
    try {
      const siteHost = new URL(env.NEXT_PUBLIC_SITE_URL).hostname.replace(
        /^www\./,
        ""
      );
      const fromMatch = env.RESEND_FROM_EMAIL.match(/<([^>]+)>/);
      const fromAddr = fromMatch ? fromMatch[1] : env.RESEND_FROM_EMAIL;
      const fromDomain = fromAddr.split("@")[1]?.replace(/^www\./, "");
      if (fromDomain === siteHost) {
        add("Resend FROM domain", "ok", `${fromDomain} = ${siteHost}`);
      } else {
        add(
          "Resend FROM domain",
          "warn",
          `${fromDomain} ≠ ${siteHost} (DKIM çalışmaz)`
        );
      }
    } catch {
      // ignore parse hatası
    }
  }

  // Supabase URL gerçek prod proje mi
  if (env.NEXT_PUBLIC_SUPABASE_URL?.includes(".supabase.co")) {
    add("Supabase prod URL", "ok", "supabase.co host");
  }

  for (const c of checks) row(c.label, c.status, c.detail);
  checks.length = 0;
} else if (env.NEXT_PUBLIC_SITE_URL) {
  console.log();
  console.log(
    `${COLORS.gray}── Dev mode — production sanity atlandı ──${COLORS.reset}`
  );
  console.log(
    `${COLORS.gray}   Production'a deploy etmeden önce NEXT_PUBLIC_SITE_URL'i https:// yap${COLORS.reset}`
  );
}

// ============================================================
// Network checks
// ============================================================

console.log();
console.log(`${COLORS.gray}── Bağlantı ──${COLORS.reset}`);

if (supaUrl) {
  await ping(supaUrl, "Supabase ping");
  await pingSupabaseAuth(supaUrl, anonKey);
  await checkMigrationTables(supaUrl, serviceKey);
}

if (env.IYZICO_BASE_URL) {
  // iyzico /payment/iyzipos endpoint HEAD reddedebilir, ama TCP ping yeterli
  await ping(env.IYZICO_BASE_URL, "iyzico ping");
}

if (env.RESEND_API_KEY) {
  // Resend API root ping
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
    });
    if (res.status === 200) {
      add("Resend API", "ok", "reachable + auth ok");
    } else if (res.status === 401) {
      add("Resend API", "fail", "401 — API key geçersiz");
    } else {
      add("Resend API", "warn", `${res.status}`);
    }
  } catch (err) {
    add("Resend API", "fail", err.message);
  }
}

for (const c of checks) row(c.label, c.status, c.detail);

// ============================================================
// Summary
// ============================================================

console.log();
const total = results.ok + results.warn + results.fail;
let banner;
if (results.fail === 0 && results.ok > 0) {
  banner = `${COLORS.green}${COLORS.bold}✓ ${results.ok}/${total} ok${COLORS.reset} — kullanıma hazır.`;
} else if (results.fail === 0) {
  banner = `${COLORS.yellow}⚠ ${results.warn} eksik (opsiyonel)${COLORS.reset} — sistem çalışır.`;
} else {
  banner = `${COLORS.red}${COLORS.bold}✗ ${results.fail} hata${COLORS.reset} — SETUP.md'ye bak.`;
}
console.log(banner);
console.log();

process.exit(results.fail > 0 ? 1 : 0);
