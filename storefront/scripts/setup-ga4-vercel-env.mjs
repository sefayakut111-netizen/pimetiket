#!/usr/bin/env node
/**
 * GA4 Data API → Vercel Production env kurulumu
 *
 * Plan: GA4 Vercel Production Env Kurulumu
 *
 * Usage:
 *   node scripts/setup-ga4-vercel-env.mjs --sa-json ./ga4-reader-key.json
 *   node scripts/setup-ga4-vercel-env.mjs --sa-json ./key.json --property-id 512345678
 *   node scripts/setup-ga4-vercel-env.mjs --check-only
 *
 * Ön koşul (Google Cloud — bir kez):
 *   1. Analytics Data API etkin
 *   2. Service account JSON key indirildi
 *   3. GA4 → Mülk erişim yönetimi → SA e-postası → Görüntüleyen
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() || "G-ZCN6RVXCEF";
const ADMIN_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    checkOnly: false,
    dryRun: false,
    redeploy: true,
    saJson: process.env.GA4_SA_JSON_PATH?.trim() || null,
    propertyId: process.env.GA4_PROPERTY_ID?.trim() || null,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--check-only") out.checkOnly = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--no-redeploy") out.redeploy = false;
    else if (a === "--sa-json") out.saJson = args[++i];
    else if (a === "--property-id") out.propertyId = args[++i];
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/setup-ga4-vercel-env.mjs [options]

Options:
  --sa-json <path>       Google service account JSON key dosyası
  --property-id <id>     Sayısal GA4 mülk kimliği (opsiyonel; SA ile otomatik bulunur)
  --check-only           Sadece Vercel env durumunu kontrol et
  --dry-run              Vercel'e yazma, yalnızca doğrulama
  --no-redeploy          Env sonrası production redeploy atlama
`);
      process.exit(0);
    }
  }
  return out;
}

function loadSaCredentials(jsonPath) {
  const raw = readFileSync(jsonPath, "utf8");
  const json = JSON.parse(raw);
  const email = json.client_email?.trim();
  const privateKey = json.private_key?.trim();
  if (!email || !privateKey) {
    throw new Error("JSON dosyasında client_email veya private_key yok");
  }
  return { email, privateKey, projectId: json.project_id?.trim() || null };
}

async function getAccessToken(credentials) {
  const auth = new GoogleAuth({
    credentials: {
      client_email: credentials.email,
      private_key: credentials.privateKey,
    },
    scopes: [ADMIN_SCOPE],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("Service account access token alınamadı");
  return token.token;
}

async function discoverPropertyId(credentials, measurementId) {
  console.log(`Mülk kimliği aranıyor (measurement: ${measurementId})…`);
  const token = await getAccessToken(credentials);

  const accountsRes = await fetch(
    "https://analyticsadmin.googleapis.com/v1beta/accounts",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!accountsRes.ok) {
    const body = await accountsRes.text();
    throw new Error(
      `Analytics Admin API accounts.list ${accountsRes.status}: ${body.slice(0, 300)}`
    );
  }
  const accounts = (await accountsRes.json()).accounts ?? [];

  for (const account of accounts) {
    const accountName = account.name;
    let pageToken;
    do {
      const url = new URL("https://analyticsadmin.googleapis.com/v1beta/properties");
      url.searchParams.set("filter", `parent:${accountName}`);
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const propsRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!propsRes.ok) {
        const body = await propsRes.text();
        throw new Error(
          `properties.list ${propsRes.status}: ${body.slice(0, 300)}`
        );
      }
      const propsBody = await propsRes.json();
      for (const property of propsBody.properties ?? []) {
        const propertyName = property.name;
        let streamToken;
        do {
          const streamsUrl = new URL(
            `https://analyticsadmin.googleapis.com/v1beta/${propertyName}/dataStreams`
          );
          if (streamToken) streamsUrl.searchParams.set("pageToken", streamToken);
          const streamsRes = await fetch(streamsUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!streamsRes.ok) continue;
          const streamsBody = await streamsRes.json();
          for (const stream of streamsBody.dataStreams ?? []) {
            const mid = stream.webStreamData?.measurementId;
            if (mid === measurementId) {
              const id = propertyName.replace(/^properties\//, "");
              console.log(
                `  Bulundu: property ${id} (${property.displayName ?? "—"})`
              );
              return id;
            }
          }
          streamToken = streamsBody.nextPageToken;
        } while (streamToken);
      }
      pageToken = propsBody.nextPageToken;
    } while (pageToken);
  }

  throw new Error(
    `Measurement ID ${measurementId} için mülk bulunamadı. GA4 Admin API erişimi veya --property-id ile manuel girin.`
  );
}

async function testDataApi(credentials, propertyId) {
  const client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: credentials.email,
      private_key: credentials.privateKey,
    },
  });
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
    metrics: [{ name: "activeUsers" }],
  });
  const value = response.rows?.[0]?.metricValues?.[0]?.value ?? "0";
  console.log(`Data API test OK — son 7 gün activeUsers: ${value}`);
}

function vercelEnvSet(name, value, environment = "production") {
  try {
    execSync(`npx vercel env rm ${name} ${environment} --yes`, {
      stdio: "pipe",
    });
  } catch {
    /* may not exist */
  }
  execSync(
    `echo ${JSON.stringify(value)} | npx vercel env add ${name} ${environment} --yes`,
    { stdio: "inherit", shell: true }
  );
}

function formatPrivateKeyForVercel(pem) {
  return pem.replace(/\r?\n/g, "\\n");
}

async function main() {
  const opts = parseArgs();

  if (opts.checkOnly) {
    execSync("node scripts/check-ga4-vercel-env.mjs", { stdio: "inherit" });
    return;
  }

  if (!opts.saJson) {
    console.error(`Service account JSON gerekli.

Google Cloud (bir kez):
  1. console.cloud.google.com → APIs → Google Analytics Data API etkinleştir
  2. IAM → Service Accounts → Create → JSON key indir
  3. analytics.google.com → Yönetici → Mülk erişim yönetimi → SA e-postası → Görüntüleyen

Sonra:
  node scripts/setup-ga4-vercel-env.mjs --sa-json ./path/to/key.json
`);
    process.exit(1);
  }

  const credentials = loadSaCredentials(opts.saJson);
  let propertyId = opts.propertyId;
  if (propertyId && !/^\d+$/.test(propertyId)) {
    throw new Error(
      "GA4_PROPERTY_ID sayısal olmalı (G-XXXX measurement ID değil)"
    );
  }
  if (!propertyId) {
    propertyId = await discoverPropertyId(credentials, MEASUREMENT_ID);
  }

  console.log("\nData API bağlantısı test ediliyor…");
  await testDataApi(credentials, propertyId);

  const vercelVars = {
    GA4_PROPERTY_ID: propertyId,
    GA4_SA_CLIENT_EMAIL: credentials.email,
    GA4_SA_PRIVATE_KEY: formatPrivateKeyForVercel(credentials.privateKey),
  };

  console.log("\nVercel Production env:");
  console.log(`  GA4_PROPERTY_ID=${propertyId}`);
  console.log(`  GA4_SA_CLIENT_EMAIL=${credentials.email}`);
  console.log("  GA4_SA_PRIVATE_KEY=(sensitive, \\n escaped)");

  if (opts.dryRun) {
    console.log("\n--dry-run: Vercel'e yazılmadı.");
    return;
  }

  for (const [name, value] of Object.entries(vercelVars)) {
    vercelEnvSet(name, value, "production");
  }

  console.log("\n✓ Vercel Production env güncellendi.");

  if (opts.redeploy) {
    console.log("\nProduction redeploy başlatılıyor…");
    execSync("npx vercel --prod --yes", { stdio: "inherit" });
    console.log("\nDoğrulama:");
    console.log("  https://pimetiket.com/admin/trafik");
    console.log("  (admin oturumu) GET /api/admin/traffic?range=7d → configured: true");
  } else {
    console.log("\nRedeploy atlandı. Manuel: npx vercel --prod");
  }
}

main().catch((err) => {
  console.error("\nHata:", err.message ?? err);
  if (String(err.message).includes("403") || String(err.message).includes("PERMISSION_DENIED")) {
    console.error(
      "\n→ GA4 Mülk erişim yönetiminde service account'a Görüntüleyen rolü verildi mi?"
    );
  }
  process.exit(1);
});
