/**
 * HOSGELDIN10 — fn_validate_coupon per-user limit doğrulaması.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase env eksik");

const admin = createClient(url, key);

async function main() {
  const { data: coupon } = await admin
    .from("coupons")
    .select("id, per_user_limit, min_subtotal")
    .eq("code", "HOSGELDIN10")
    .maybeSingle();

  if (!coupon) throw new Error("HOSGELDIN10 kuponu yok — önce seed çalıştır");

  if (coupon.per_user_limit !== 1) {
    throw new Error(`per_user_limit beklenen 1, gelen ${coupon.per_user_limit}`);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!profile?.id) throw new Error("test için profil bulunamadı");

  const testUserId = profile.id;

  // Mevcut test kalıntılarını temizle
  await admin
    .from("coupon_uses")
    .delete()
    .eq("coupon_id", coupon.id)
    .eq("user_id", testUserId);

  const { data: orders } = await admin
    .from("orders")
    .select("id")
    .limit(2);
  if (!orders || orders.length < 2) {
    throw new Error("test için en az 2 sipariş kaydı gerekli (FK)");
  }
  const order1 = orders[0].id;
  const order2 = orders[1].id;

  const { data: apply1, error: e1 } = await admin.rpc("fn_apply_coupon_admin", {
    p_code: "HOSGELDIN10",
    p_subtotal: 300,
    p_user_id: testUserId,
    p_order_id: order1,
  });
  if (e1) throw new Error(`apply 1: ${e1.message}`);
  if (apply1?.ok !== true) {
    throw new Error(`ilk apply ok olmalı: ${JSON.stringify(apply1)}`);
  }

  const { data: apply2, error: e2 } = await admin.rpc("fn_apply_coupon_admin", {
    p_code: "HOSGELDIN10",
    p_subtotal: 300,
    p_user_id: testUserId,
    p_order_id: order2,
  });
  if (e2) throw new Error(`apply 2: ${e2.message}`);
  if (apply2?.ok !== false || apply2?.reason !== "user_limit_reached") {
    throw new Error(
      `ikinci apply user_limit_reached olmalı: ${JSON.stringify(apply2)}`
    );
  }

  await admin
    .from("coupon_uses")
    .delete()
    .eq("coupon_id", coupon.id)
    .eq("user_id", testUserId);

  console.log("[verify-hosgeldin10] OK — per_user_limit=1 zorlanıyor");
}

main().catch((err) => {
  console.error("[verify-hosgeldin10] FAIL:", err);
  process.exit(1);
});
