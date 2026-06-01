/**
 * Playwright Auth Setup — Pim Etiket bot için 2 rol session hazırlığı.
 *
 * Supabase admin API ile magic link token üretir, anon client verifyOtp ile
 * session alır, @supabase/ssr çerez formatında enjekte eder, storageState kaydeder.
 *
 * 2 rol:
 *   - Customer: BOT_CUSTOMER_EMAIL (yoksa oluşturulur, role='customer')
 *   - Admin:    BOT_ADMIN_EMAIL    (mevcut olmalı, role='admin'|'staff')
 *
 * Env (.env.local — playwright.config yükler):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - BOT_CUSTOMER_EMAIL (default: pim-etiket-bot+customer@gmail.com)
 *   - BOT_ADMIN_EMAIL    (default: sefayakut111@gmail.com)
 *   - PLAYWRIGHT_BASE_URL (default: https://pimetiket.com)
 */

import { test as setup, expect, type Page } from "@playwright/test";
import { createClient, type Session } from "@supabase/supabase-js";
import {
  createChunks,
  stringToBase64URL,
  DEFAULT_COOKIE_OPTIONS,
} from "@supabase/ssr";
import path from "node:path";
import fs from "node:fs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "https://pimetiket.com";
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

function makeAnonClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Bot env eksik: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getSupabaseAuthCookieName(): string {
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  return `sb-${ref}-auth-token`;
}

async function ensureUser(
  email: string,
  role: "customer" | "admin"
): Promise<string> {
  const admin = makeAdminClient();
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
    if (role === "admin") {
      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      const currentRole = (profile as { role?: string } | null)?.role;
      if (currentRole !== "admin" && currentRole !== "staff") {
        await admin
          .from("profiles")
          .update({ role: "admin" })
          .eq("id", userId);
        console.log(
          `[setup] ⚠ Bot admin role düzeltildi: ${currentRole ?? "?"} → admin`
        );
      }
    }
  } else {
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

    await admin
      .from("profiles")
      .upsert({ id: userId, role: "customer", display_name: "Bot Customer" });
  }

  return userId;
}

async function resolveSession(email: string): Promise<Session> {
  const admin = makeAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data.properties?.hashed_token) {
    throw new Error(
      `generateLink failed: ${error?.message ?? "no hashed_token"}`
    );
  }

  const anon = makeAnonClient();
  const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verifyErr || !verified.session) {
    throw new Error(`verifyOtp failed: ${verifyErr?.message ?? "no session"}`);
  }

  return verified.session;
}

async function injectSupabaseSession(page: Page, session: Session) {
  const cookieName = getSupabaseAuthCookieName();
  const sessionJson = JSON.stringify(session);
  const encoded = `base64-${stringToBase64URL(sessionJson)}`;
  const chunks = createChunks(cookieName, encoded);
  const base = new URL(BASE_URL);

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

  await page.context().addCookies(
    chunks.map(({ name, value }) => ({
      name,
      value,
      domain: base.hostname,
      path: "/",
      sameSite: "Lax" as const,
      httpOnly: false,
      secure: base.protocol === "https:",
      expires:
        Math.floor(Date.now() / 1000) +
        (DEFAULT_COOKIE_OPTIONS.maxAge ?? 400 * 24 * 60 * 60),
    }))
  );

  const cookies = await page.context().cookies();
  const authCookie = cookies.find((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  if (!authCookie) {
    throw new Error(
      `[setup] Supabase auth cookie enjekte edilemedi (${cookieName})`
    );
  }
  console.log(`[setup] ✓ Auth cookie: ${authCookie.name}`);
}

async function loginWithSessionCookie(
  page: Page,
  email: string,
  statePath: string
) {
  console.log(`[setup] Session cookie enjekte: ${email}`);
  const session = await resolveSession(email);
  await injectSupabaseSession(page, session);

  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  await page.context().storageState({ path: statePath });
  console.log(`[setup] ✓ State kaydedildi: ${statePath}`);
}

setup("authenticate customer", async ({ page }) => {
  await ensureUser(CUSTOMER_EMAIL, "customer");
  await loginWithSessionCookie(page, CUSTOMER_EMAIL, CUSTOMER_STATE);

  await page.goto("/panelim");
  await expect(page).toHaveURL(/panelim/, { timeout: 15_000 });
  await expect(page).not.toHaveURL(/\/auth/);
});

setup("authenticate admin", async ({ page }) => {
  await ensureUser(ADMIN_EMAIL, "admin");
  await loginWithSessionCookie(page, ADMIN_EMAIL, ADMIN_STATE);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
  await expect(page).not.toHaveURL(/\/auth/);
  await expect(page).not.toHaveURL(/mfa-challenge/);
});
