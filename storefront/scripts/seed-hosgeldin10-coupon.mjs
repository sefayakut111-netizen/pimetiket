#!/usr/bin/env node
/**
 * HOSGELDIN10 kupon seed — admin API yerine service-role insert (idempotent).
 * Kullanım: node scripts/seed-hosgeldin10-coupon.mjs
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Supabase env eksik");
  process.exit(1);
}

const admin = createClient(url, key);

const { data: existing } = await admin
  .from("coupons")
  .select("id, code")
  .eq("code", "HOSGELDIN10")
  .maybeSingle();

if (existing) {
  console.log("[seed-hosgeldin10] Zaten var:", existing.code);
  process.exit(0);
}

const { data, error } = await admin
  .from("coupons")
  .insert({
    code: "HOSGELDIN10",
    kind: "percent",
    value: 10,
    min_subtotal: 250,
    per_user_limit: 1,
    total_uses_limit: null,
    description: "Hoş geldin — ilk siparişe özel %10 (min 250₺, kişi başı 1)",
    is_active: true,
    starts_at: new Date().toISOString(),
    expires_at: null,
  })
  .select("id, code")
  .single();

if (error) {
  console.error("[seed-hosgeldin10] FAIL:", error.message);
  process.exit(1);
}

console.log("[seed-hosgeldin10] OK:", data.code, data.id);
