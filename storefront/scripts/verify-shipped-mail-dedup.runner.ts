/**
 * Kargo maili çifte gönderim koruması — birim testi.
 * Kullanım: npx tsx scripts/verify-shipped-mail-dedup.runner.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { renderMailTemplate } from "../src/lib/mail/templates";
import {
  hasRecentCustomerShippedMail,
  shouldSkipAdminOrderShippedMail,
} from "../src/lib/mail/shipped-mail-guard";

config({ path: resolve(process.cwd(), ".env.local") });

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env eksik");

  const admin = createClient(url, key);

  // 1) Tek şablon — customer_shipped
  const rendered = renderMailTemplate("customer_shipped", {
    order_id: "PE-TEST-001",
    customer_name: "Ayşe Yılmaz",
    carrier: "Yurtiçi Kargo",
    tracking_no: "1234567890",
    tracking_url: "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=1234567890",
    delivery_window: "5-7 iş günü",
  });
  assert(!!rendered, "customer_shipped render failed");
  assert(
    rendered!.subject.includes("PE-TEST-001"),
    "subject must include order id"
  );
  assert(
    rendered!.html.includes("Ayşe") && rendered!.html.includes("5-7 iş günü"),
    "html must include name and delivery window"
  );
  console.log("[verify-shipped-mail-dedup] template OK");

  // 2) Outbox shipped-tipi algılama
  const { data: recentShipped } = await admin
    .from("fason_mail_outbox")
    .select("target_id, template_key, created_at")
    .eq("template_key", "customer_shipped")
    .order("created_at", { ascending: false })
    .limit(1);

  if (recentShipped?.[0]?.target_id) {
    const orderId = String(recentShipped[0].target_id);
    const found = await hasRecentCustomerShippedMail(admin, orderId);
    console.log(
      `[verify-shipped-mail-dedup] hasRecentCustomerShippedMail(${orderId}) => ${found}`
    );
    const skip = await shouldSkipAdminOrderShippedMail(admin, orderId);
    console.log(
      `[verify-shipped-mail-dedup] shouldSkipAdminOrderShippedMail(${orderId}) => ${skip}`
    );
  } else {
    console.log(
      "[verify-shipped-mail-dedup] no customer_shipped outbox row — skip live DB check"
    );
  }

  // 3) _prerendered legacy kind
  const legacyHit = renderMailTemplate("_prerendered", {
    subject: "test",
    html: "<p>x</p>",
    text: "x",
    _kind: "order_shipped",
  });
  assert(!!legacyHit, "_prerendered bypass still works");

  console.log("[verify-shipped-mail-dedup] OK");
}

main().catch((err) => {
  console.error("[verify-shipped-mail-dedup] FAIL:", err);
  process.exit(1);
});
