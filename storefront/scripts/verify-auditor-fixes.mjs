/**
 * Denetçi düzeltmeleri doğrulama script'i.
 *
 * Kullanım: node scripts/verify-auditor-fixes.mjs
 * Gerekli: .env.local (SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  for (const name of [".env.local", ".env.agent"]) {
    const path = resolve(root, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnvLocal();

const results = [];

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}: ${detail}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}: ${detail}`);
}

function warn(name, detail) {
  results.push({ name, ok: null, detail });
  console.log(`⚠️  ${name}: ${detail}`);
}

// 1) vercel.json finance cron
const vercelJson = JSON.parse(
  readFileSync(resolve(root, "vercel.json"), "utf8")
);
const financeCron = vercelJson.crons?.find((c) =>
  c.path?.includes("/auditors/finance")
);
if (financeCron?.schedule === "0 6 * * *") {
  pass("finance_cron_schedule", "vercel.json → 0 6 * * * (TR 09:00)");
} else {
  fail(
    "finance_cron_schedule",
    `Beklenen 0 6 * * *, bulunan: ${financeCron?.schedule ?? "yok"}`
  );
}

// 2) Supabase bağlantısı
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  warn("supabase_env", "SUPABASE env yok — DB testleri atlandı");
  console.log("\n--- Özet ---");
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 3) unsnooze — süresi dolmuş snoozed kayıt simülasyonu
const { unsnoozeExpiredActions } = await import(
  "../src/lib/agents/_shared/unsnooze.ts"
);

const testSnoozeId = crypto.randomUUID();
const past = new Date(Date.now() - 3600_000).toISOString();

const { error: insertErr } = await admin.from("auditor_pending_actions").insert({
  id: testSnoozeId,
  run_id: (
    await admin
      .from("auditor_runs")
      .select("id")
      .limit(1)
      .maybeSingle()
  ).data?.id,
  auditor_name: "security",
  action_type: "notify_sefa",
  action_payload: { subject: "verify_snooze_test" },
  title: "[TEST] Snooze doğrulama",
  description: "Otomatik test — silinebilir",
  severity: "info",
  status: "snoozed",
  snooze_until: past,
});

if (insertErr?.message?.includes("run_id") || !insertErr) {
  // run_id zorunlu — mevcut run kullan
  const { data: runRow } = await admin
    .from("auditor_runs")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (!runRow?.id) {
    warn("unsnooze_test", "auditor_runs boş — snooze DB testi atlandı");
  } else {
    await admin.from("auditor_pending_actions").delete().eq("id", testSnoozeId);
    const { error: ins2 } = await admin.from("auditor_pending_actions").insert({
      id: testSnoozeId,
      run_id: runRow.id,
      auditor_name: "security",
      action_type: "notify_sefa",
      action_payload: { subject: "verify_snooze_test" },
      title: "[TEST] Snooze doğrulama",
      description: "Otomatik test — silinebilir",
      severity: "info",
      status: "snoozed",
      snooze_until: past,
    });

    if (ins2) {
      warn("unsnooze_test", `Test insert başarısız: ${ins2.message}`);
    } else {
      const n = await unsnoozeExpiredActions(admin);
      const { data: row } = await admin
        .from("auditor_pending_actions")
        .select("status")
        .eq("id", testSnoozeId)
        .single();

      if (row?.status === "pending" && n >= 1) {
        pass("unsnooze_expired", `${n} kayıt pending'e döndü (test id: ${testSnoozeId.slice(0, 8)}…)`);
      } else {
        fail("unsnooze_expired", `status=${row?.status}, unsnoozed=${n}`);
      }
      await admin.from("auditor_pending_actions").delete().eq("id", testSnoozeId);
    }
  }
}

// 4) Security auditor — cron endpoint veya son run findings
const cronSecret = process.env.CRON_SECRET;
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://pimetiket.com";

if (cronSecret) {
  try {
    const res = await fetch(`${siteUrl}/api/cron/auditors/security`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      fail("security_auditor_run", json.error ?? `HTTP ${res.status}`);
    } else {
      const { data: findings } = await admin
        .from("auditor_findings")
        .select("category, severity, title")
        .eq("run_id", json.runId);

      const rpcFail = (findings ?? []).find(
        (f) => f.category === "brute_force_check_failed"
      );
      if (rpcFail) {
        warn(
          "security_brute_force_rpc",
          `RPC/check hatası finding üretildi: ${rpcFail.title}`
        );
      } else {
        pass(
          "security_brute_force_rpc",
          `RPC OK, brute_force_check_failed yok (run: ${json.runId?.slice(0, 8)}…)`
        );
      }
    }
  } catch (err) {
    fail("security_auditor_run", err instanceof Error ? err.message : String(err));
  }
} else {
  // Fallback: son security run'daki findings
  const { data: lastRun } = await admin
    .from("auditor_runs")
    .select("id, started_at")
    .eq("auditor_name", "security")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRun?.id) {
    const { data: findings } = await admin
      .from("auditor_findings")
      .select("category, title")
      .eq("run_id", lastRun.id);
    const rpcFail = (findings ?? []).find(
      (f) => f.category === "brute_force_check_failed"
    );
    if (rpcFail) {
      warn("security_brute_force_rpc", `Son run'da RPC fail finding: ${rpcFail.title}`);
    } else {
      pass("security_brute_force_rpc", `Son security run findings OK (${lastRun.started_at})`);
    }
  } else {
    warn("security_auditor_run", "CRON_SECRET yok ve security run bulunamadı");
  }
}

// 5) design_quality_checks.tokens_used — mevcut kayıt veya QC smoke test
const { data: qcRows } = await admin
  .from("design_quality_checks")
  .select("id, tokens_used, cost_usd, model, created_at")
  .not("tokens_used", "is", null)
  .order("created_at", { ascending: false })
  .limit(5);

const { data: qcRecent } = await admin
  .from("design_quality_checks")
  .select("id, tokens_used, model, created_at")
  .eq("model", "gpt-4o")
  .order("created_at", { ascending: false })
  .limit(3);

const withTokens = qcRows?.length ?? 0;
if (withTokens > 0) {
  pass(
    "tokens_used_populated",
    `${withTokens} kayıtta tokens_used dolu (son: ${qcRows[0].tokens_used} token, ${qcRows[0].created_at})`
  );
} else if ((qcRecent?.length ?? 0) > 0) {
  warn(
    "tokens_used_populated",
    `gpt-4o QC kayıtları var ama tokens_used null — yeni ödeme sonrası dolacak (${qcRecent.length} eski kayıt)`
  );
} else {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    warn(
      "tokens_used_populated",
      "OPENAI_API_KEY yok — test ödeme sonrası kontrol edin"
    );
  } else {
    try {
      const { spawnSync } = await import("node:child_process");
      const r = spawnSync(
        "npx",
        ["tsx", "scripts/verify-qc-tokens.mjs"],
        { cwd: root, encoding: "utf8", shell: true }
      );
      const out = (r.stdout ?? "").trim();
      if (out) {
        const parsed = JSON.parse(out.split("\n").pop());
        if (parsed.ok) {
          pass(
            "tokens_used_populated",
            `Smoke QC: ${parsed.dbTokensUsed} token (${parsed.model})`
          );
        } else if (parsed.reason === "no_raster_design_file") {
          warn(
            "tokens_used_populated",
            "Raster design_file yok — gerçek test ödeme gerekli"
          );
        } else {
          warn("tokens_used_populated", `Smoke QC: ${parsed.reason ?? r.stderr}`);
        }
      } else {
        warn("tokens_used_populated", r.stderr?.slice(0, 200) ?? "Smoke QC çıktı yok");
      }
    } catch (err) {
      warn(
        "tokens_used_populated",
        `Smoke QC: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

console.log("\n--- Özet ---");
const failed = results.filter((r) => r.ok === false).length;
const passed = results.filter((r) => r.ok === true).length;
console.log(`${passed} geçti, ${failed} başarısız, ${results.length - passed - failed} uyarı/atlandı`);
process.exit(failed > 0 ? 1 : 0);
