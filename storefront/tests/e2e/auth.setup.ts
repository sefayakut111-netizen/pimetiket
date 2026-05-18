/**
 * Playwright Auth Setup — Pim Etiket bot için 2 rol session hazırlığı.
 *
 * Sefa 18 May v68 (e2e bot):
 * Supabase admin API ile magic link üretir, browser'da bu link'i ziyaret
 * eder, session cookie set olur, storageState'i dosyaya kaydeder. Her
 * sonraki test bu state'ten başlar — login adımı atlanır.
 *
 * 2 rol:
 *   - Customer: BOT_CUSTOMER_EMAIL (yoksa oluşturulur, role='customer')
 *   - Admin:    BOT_ADMIN_EMAIL    (mevcut olmalı, role='admin'|'staff')
 *
 * Env (Playwright çalıştırıldığında set edilmeli — npm run bot:* script
 * --env-file=.env.local ile inject eder):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - BOT_CUSTOMER_EMAIL (default: pim-etiket-bot+customer@gmail.com)
 *   - BOT_ADMIN_EMAIL    (default: sefayakut111@gmail.com)
 *   - PLAYWRIGHT_BASE_URL (default: https://pimetiket.com)
 */

import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import fs from "node:fs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CUSTOMER_EMAIL =
  process.env.BOT_CUSTOMER_EMAIL ?? "pim-etiket-bot+customer@gmail.com";
const ADMIN_EMAIL =
  process.env.BOT_ADMIN_EMAIL ?? "sefayakut111@gmail.com";

const CUSTOMER_STATE = path.resolve("tests/.auth/customer.json");
const ADMIN_STATE = path.resolve("tests/.auth/admin.json");

function makeAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error(
      "Bot env eksik: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensureUser(
  email: string,
  role: "customer" | "admin"
): Promise<string> {
  const admin = makeAdminClient();
  // listUsers'ı sayfa sayfa tarayarak email match'i bul (admin.getUserByEmail v1'de yok)
  // Pim Etiket'te ~100 user var, ilk sayfa yeterli
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    throw new Error(`listUsers failed: ${listErr.message}`);
  }
  const found = list.users.find((u) => u.email === email);

  let userId: string;
  if (found) {
    userId = found.id;
    console.log(`[setup] ✓ Mevcut user: ${email} (${userId.slice(0, 8)}...)`);
  } else {
    // Sadece customer için otomatik oluşturma — admin manuel olmalı
    if (role === "admin") {
      throw new Error(
        `Admin email ${email} sistemde yok. Önce Supabase'de manuel oluştur + role='admin' yap.`
      );
    }
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: "Pim Etiket Bot Customer" },
      });
    if (createErr || !created.user) {
      throw new Error(`createUser failed: ${createErr?.message}`);
    }
    userId = created.user.id;
    console.log(`[setup] ✓ Yeni user oluşturuldu: ${email}`);

    // profiles satırını role ile birlikte upsert
    await admin
      .from("profiles")
      .upsert({ id: userId, role: "customer", display_name: "Bot Customer" });
  }

  return userId;
}

async function loginViaMagicLink(
  page: import("@playwright/test").Page,
  email: string,
  statePath: string
) {
  const admin = makeAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data.properties?.action_link) {
    throw new Error(
      `generateLink failed: ${error?.message ?? "no action_link"}`
    );
  }

  console.log(`[setup] Magic link visit: ${email}`);
  await page.goto(data.properties.action_link, {
    waitUntil: "domcontentloaded",
  });

  // Magic link callback Pim Etiket domain'ine redirect eder
  await page.waitForURL(/pimetiket\.com|localhost/, { timeout: 30_000 });

  // Cookie set olduğunu doğrula
  const cookies = await page.context().cookies();
  const supabaseCookie = cookies.find((c) =>
    c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );
  if (!supabaseCookie) {
    console.warn(
      "[setup] ⚠ Supabase auth cookie bulunamadı — sayfa içerik kontrolü yapılıyor"
    );
  }

  // Storage state'i kaydet
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  await page.context().storageState({ path: statePath });
  console.log(`[setup] ✓ State kaydedildi: ${statePath}`);
}

setup("authenticate customer", async ({ page }) => {
  await ensureUser(CUSTOMER_EMAIL, "customer");
  await loginViaMagicLink(page, CUSTOMER_EMAIL, CUSTOMER_STATE);

  // Sanity check — auth'lu sayfaya gidip 401 olmamalı
  await page.goto("/panelim");
  await expect(page).toHaveURL(/panelim/, { timeout: 10_000 });
});

setup("authenticate admin", async ({ page }) => {
  await ensureUser(ADMIN_EMAIL, "admin");
  await loginViaMagicLink(page, ADMIN_EMAIL, ADMIN_STATE);

  // Sanity check — admin dashboard erişilebilir mi
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 });
});
