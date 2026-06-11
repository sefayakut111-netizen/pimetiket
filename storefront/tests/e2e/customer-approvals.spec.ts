/**
 * Onay görseli — müşteri karar akışı E2E.
 *
 * (a) Admin istek oluştur → müşteri kartı görür
 * (b) Onayla → durum + rozet güncellenir
 * (c) Değişiklik iste boş yorumla gönderilemez; yorumla gönderilir
 * (d) İkinci karar 409
 */

import { test, expect } from "@playwright/test";

/** Playwright test fixture `playwright` — yerel tip (tsc uyumu). */
type PlaywrightWorker = {
  request: {
    newContext(options: {
      storageState?: string;
      baseURL?: string;
    }): Promise<{
      post(
        url: string,
        options?: { multipart?: Record<string, unknown> }
      ): Promise<{
        ok: () => boolean;
        status: () => number;
        json: () => Promise<unknown>;
      }>;
      dispose(): Promise<void>;
    }>;
  };
};
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import fs from "node:fs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const CUSTOMER_EMAIL =
  process.env.BOT_CUSTOMER_EMAIL ?? "pim-etiket-bot+customer@gmail.com";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z5+hHgAHggJ/PchI7wAAAABJRU9ErkJggg==",
  "base64"
);

const ADMIN_STATE = path.resolve("tests/.auth/admin.json");

function loadEnvLocal() {
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

function makeAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase env eksik");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveCustomerUserId(): Promise<string> {
  const admin = makeAdmin();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw new Error(error.message);
  const user = data.users.find((u) => u.email === CUSTOMER_EMAIL);
  if (!user) throw new Error(`Customer bot user yok: ${CUSTOMER_EMAIL}`);
  return user.id;
}

async function createTestOrder(userId: string): Promise<string> {
  const admin = makeAdmin();
  const orderId = `PE-E2E-AR-${Date.now()}`;
  const { error } = await admin.from("orders").insert({
    id: orderId,
    user_id: userId,
    status: "in_production",
    subtotal: 100,
    shipping: 0,
    total: 100,
    address: { name: "Bot Customer" },
    invoice: { type: "individual" },
    payment: { method: "test" },
  });
  if (error) throw new Error(`order insert: ${error.message}`);
  return orderId;
}

async function adminCreateApprovalRequest(
  playwright: object,
  orderId: string,
  title: string
): Promise<string> {
  const ctx = await (playwright as PlaywrightWorker).request.newContext({
    storageState: ADMIN_STATE,
    baseURL: BASE_URL,
  });
  try {
    const res = await ctx.post(
      `/api/admin/orders/${orderId}/approval-requests`,
      {
        multipart: {
          title,
          blocking: "false",
          file: {
            name: "e2e-approval.png",
            mimeType: "image/png",
            buffer: PNG_1X1,
          },
        },
      }
    );
    const body = (await res.json().catch(() => ({}))) as {
      request_id?: string;
      error?: string;
    };
    expect(res.ok(), body.error ?? String(res.status())).toBeTruthy();
    expect(body.request_id).toBeTruthy();
    return body.request_id!;
  } finally {
    await ctx.dispose();
  }
}

let orderId: string;

test.beforeAll(async () => {
  const userId = await resolveCustomerUserId();
  orderId = await createTestOrder(userId);
});

test.describe.serial("Onay görseli müşteri akışı", () => {
  let approveRequestId: string;
  let rejectRequestId: string;

  test("(a) admin istek oluştur → müşteri kartı görür", async ({
    page,
    playwright,
  }) => {
    const title = `E2E Onay ${Date.now()}`;
    approveRequestId = await adminCreateApprovalRequest(
      playwright,
      orderId,
      title
    );

    await page.goto(`/siparis/${orderId}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Onay bekliyor")).toBeVisible();
  });

  test("(b) Onayla → durum ve rozet güncellenir", async ({ page }) => {
    await page.goto(`/siparis/${orderId}`);
    const approveBtn = page.getByRole("button", { name: "Onayla" }).first();
    await expect(approveBtn).toBeVisible({ timeout: 15_000 });
    await approveBtn.click();
    await expect(page.getByText("Onaylandı")).toBeVisible({ timeout: 15_000 });
  });

  test("(c) Değişiklik iste — boş yorum engeli + yorumla gönderim", async ({
    page,
    playwright,
  }) => {
    const title = `E2E Red ${Date.now()}`;
    rejectRequestId = await adminCreateApprovalRequest(
      playwright,
      orderId,
      title
    );

    await page.goto(`/siparis/${orderId}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Değişiklik iste" }).last().click();
    const sendBtn = page.getByRole("button", { name: "İsteği gönder" });
    await expect(sendBtn).toBeDisabled();

    await page
      .getByPlaceholder("Kısa ve net yaz — ekibimiz anlasın")
      .fill("E2E: renk tonu biraz koyu olsun");
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    await expect(page.getByText("Değişiklik istendi")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("(d) ikinci karar 409", async ({ page }) => {
    const res = await page.request.post(
      `/api/orders/${orderId}/approval-requests/${rejectRequestId}/decide`,
      {
        data: { decision: "approve" },
      }
    );
    expect(res.status()).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("request_not_pending");
  });
});
