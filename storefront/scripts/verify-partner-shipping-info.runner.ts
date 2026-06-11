/**
 * F4 Model B — partner shipping-info guard + audit doğrulama.
 * Kullanım: npx tsx scripts/verify-partner-shipping-info.runner.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import {
  canPartnerViewFullShippingAddress,
  partnerShippingAddressDeniedMessage,
} from "../src/lib/fason/partner-shipping-access";
import {
  fullOrderAddressForPartnerShipping,
  redactOrderAddressForPartner,
} from "../src/lib/fason/redact-order-address";

config({ path: resolve(process.cwd(), ".env.local") });

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  // (a) statü guard — birim
  assert(
    !canPartnerViewFullShippingAddress("assigned"),
    "assigned must not allow full address"
  );
  assert(
    !canPartnerViewFullShippingAddress("acknowledged"),
    "acknowledged must not allow full address"
  );
  assert(
    canPartnerViewFullShippingAddress("in_production"),
    "in_production must allow full address"
  );
  assert(
    canPartnerViewFullShippingAddress("ready"),
    "ready must allow full address"
  );
  assert(
    partnerShippingAddressDeniedMessage("assigned").includes("Üretimde"),
    "denied message must explain allowed phases"
  );
  console.log("[verify-partner-shipping-info] status guards OK");

  // redaksiyon varsayılanı değişmedi
  const sample = {
    name: "Ayşe Yılmaz",
    phone: "05551234567",
    addr: "Atatürk Mah. No:5",
    city: "İstanbul",
    district: "Kadıköy",
  };
  const redacted = redactOrderAddressForPartner(sample);
  assert(redacted.city === "İstanbul", "redact must keep city only");
  assert(
    !("name" in redacted) && !("phone" in redacted),
    "redact must not expose PII fields"
  );
  const full = fullOrderAddressForPartnerShipping(sample);
  assert(full?.recipientName === "Ayşe Yılmaz", "full shipping must expose name");
  assert(full?.phone === "05551234567", "full shipping must expose phone");
  assert(
    full?.addressLine === "Atatürk Mah. No:5",
    "full shipping must expose addr"
  );
  console.log("[verify-partner-shipping-info] redact/full split OK");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log(
      "[verify-partner-shipping-info] Supabase env yok — DB audit atlandı"
    );
    console.log("[verify-partner-shipping-info] OK (unit only)");
    return;
  }

  const admin = createClient(url, key);

  // Canlı: ready/in_production atamalı sipariş + farklı partner cross-check
  const { data: readyAsg } = await admin
    .from("order_assignments")
    .select("order_id, fason_partner_id, status")
    .in("status", ["ready", "in_production"])
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readyAsg?.order_id && readyAsg.fason_partner_id) {
    const { data: orderRow } = await admin
      .from("orders")
      .select("id, address")
      .eq("id", readyAsg.order_id)
      .maybeSingle();
    const shipping = fullOrderAddressForPartnerShipping(
      (orderRow as { address?: Record<string, unknown> } | null)?.address
    );
    console.log(
      `[verify-partner-shipping-info] sample order ${readyAsg.order_id} status=${readyAsg.status} addressComplete=${!!shipping}`
    );

    const { data: otherPartner } = await admin
      .from("fason_partners")
      .select("id")
      .neq("id", readyAsg.fason_partner_id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (otherPartner?.id) {
      const { data: cross } = await admin
        .from("order_assignments")
        .select("id")
        .eq("order_id", readyAsg.order_id)
        .eq("fason_partner_id", otherPartner.id)
        .in("status", ["ready", "in_production", "assigned", "sent"])
        .maybeSingle();
      assert(!cross, "(b) wrong partner must have no active assignment row");
      console.log(
        "[verify-partner-shipping-info] cross-partner isolation OK (DB)"
      );
    }

    const { data: auditRows } = await admin
      .from("audit_log")
      .select("id, action, detail, created_at")
      .eq("action", "partner.address_viewed")
      .eq("target_id", readyAsg.order_id)
      .order("created_at", { ascending: false })
      .limit(3);
    console.log(
      `[verify-partner-shipping-info] audit_log partner.address_viewed rows for order: ${auditRows?.length ?? 0}`
    );
    if (auditRows?.[0]) {
      const detail = auditRows[0].detail as Record<string, unknown> | null;
      assert(
        detail?.partner_id === readyAsg.fason_partner_id,
        "audit detail must include partner_id"
      );
      assert(detail?.order_id === readyAsg.order_id, "audit detail must include order_id");
      console.log(
        `[verify-partner-shipping-info] latest audit at ${auditRows[0].created_at}`
      );
    } else {
      console.log(
        "[verify-partner-shipping-info] (c) audit row yok — UI'dan Adresi göster sonrası oluşur"
      );
    }
  } else {
    console.log(
      "[verify-partner-shipping-info] ready/in_production atama yok — DB senaryoları atlandı"
    );
  }

  console.log("[verify-partner-shipping-info] OK");
}

main().catch((err) => {
  console.error("[verify-partner-shipping-info] FAIL", err);
  process.exit(1);
});
