/**
 * POST /api/fason/update
 *
 * Fason web form'undan durum güncellemesi.
 *
 * Body: {
 *   token: string,
 *   action: 'acknowledge' | 'in_production' | 'ready' | 'shipped' | 'issue',
 *   issue?: { category, description, photoStoragePath? },
 *   tracking?: { company, number, url? }
 * }
 *
 * Public endpoint (auth: token).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logOrderEvent } from "@/lib/order-events-server";

export const dynamic = "force-dynamic";

type FasonAction =
  | "acknowledge"
  | "in_production"
  | "ready"
  | "shipped"
  | "issue";

interface BodyShape {
  token?: unknown;
  action?: unknown;
  issue?: {
    category?: unknown;
    description?: unknown;
    photoStoragePath?: unknown;
  };
  tracking?: {
    company?: unknown;
    number?: unknown;
    url?: unknown;
  };
}

const VALID_ACTIONS: FasonAction[] = [
  "acknowledge",
  "in_production",
  "ready",
  "shipped",
  "issue",
];

const ACTION_TO_STATUS: Record<FasonAction, string> = {
  acknowledge: "acknowledged",
  in_production: "in_production",
  ready: "ready",
  shipped: "shipped",
  issue: "issue",
};

const ACTION_TO_EVENT: Record<FasonAction, string> = {
  acknowledge: "fason_acknowledged",
  in_production: "fason_in_production",
  ready: "fason_ready",
  shipped: "fason_shipped",
  issue: "fason_issue_reported",
};

const ACTION_TIMESTAMP_COLUMN: Record<FasonAction, string> = {
  acknowledge: "acknowledged_at",
  in_production: "in_production_at",
  ready: "ready_at",
  shipped: "shipped_at",
  issue: "issue_reported_at",
};

export async function POST(req: Request) {
  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const actionStr = typeof body.action === "string" ? body.action : "";

  if (!token || !VALID_ACTIONS.includes(actionStr as FasonAction)) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const action = actionStr as FasonAction;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Sunucu yapılandırması" }, { status: 500 });
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Token doğrula
  const { data: validateData } = await admin.rpc(
    "fn_validate_fason_token",
    { p_token: token }
  );
  const validation = (validateData as Array<{
    assignment_id: string;
    fason_partner_id: string;
    order_id: string;
    is_valid: boolean;
    reason: string;
  }>)?.[0];

  if (!validation?.is_valid) {
    return NextResponse.json(
      { error: "Token geçersiz", reason: validation?.reason ?? "unknown" },
      { status: 401 }
    );
  }

  // Update payload
  const newStatus = ACTION_TO_STATUS[action];
  const timestampCol = ACTION_TIMESTAMP_COLUMN[action];
  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    [timestampCol]: new Date().toISOString(),
  };

  // Issue özel alanları
  if (action === "issue") {
    const cat = body.issue?.category;
    const desc = body.issue?.description;
    const photo = body.issue?.photoStoragePath;
    if (
      typeof cat !== "string" ||
      !["dosya", "malzeme", "sure", "diger"].includes(cat)
    ) {
      return NextResponse.json(
        { error: "Sorun kategorisi geçersiz" },
        { status: 400 }
      );
    }
    if (typeof desc !== "string" || desc.trim().length < 5) {
      return NextResponse.json(
        { error: "Açıklama en az 5 karakter olmalı" },
        { status: 400 }
      );
    }
    updatePayload.issue_category = cat;
    updatePayload.issue_description = desc.trim().slice(0, 2000);
    if (typeof photo === "string") {
      updatePayload.issue_photo_path = photo;
    }
  }

  // Tracking özel alanları
  if (action === "shipped") {
    const company = body.tracking?.company;
    const number = body.tracking?.number;
    const trackUrl = body.tracking?.url;
    if (typeof company !== "string" || typeof number !== "string") {
      return NextResponse.json(
        { error: "Kargo firması ve takip no zorunlu" },
        { status: 400 }
      );
    }
    const companyTrim = company.trim();
    const numberTrim = number.trim();
    if (companyTrim.length === 0 || companyTrim.length > 64) {
      return NextResponse.json(
        { error: "Kargo firması 1-64 karakter olmalı" },
        { status: 400 }
      );
    }
    if (numberTrim.length === 0 || numberTrim.length > 64) {
      return NextResponse.json(
        { error: "Takip numarası 1-64 karakter olmalı" },
        { status: 400 }
      );
    }
    updatePayload.tracking_company = companyTrim;
    updatePayload.tracking_number = numberTrim;

    // Tracking URL — yalnızca https:// kabul edilir.
    // Mail template'inde escape() HTML entity yapar ama `javascript:` /
    // `data:` şeması href'te tıklanabilir kalır. URL parse + scheme
    // allowlist + uzunluk limiti uygula.
    if (typeof trackUrl === "string" && trackUrl.trim().length > 0) {
      const raw = trackUrl.trim();
      if (raw.length > 512) {
        return NextResponse.json(
          { error: "Takip linki çok uzun (max 512)" },
          { status: 400 }
        );
      }
      try {
        const parsed = new URL(raw);
        if (parsed.protocol !== "https:") {
          return NextResponse.json(
            { error: "Takip linki sadece https:// olabilir" },
            { status: 400 }
          );
        }
        updatePayload.tracking_url = parsed.toString();
      } catch {
        return NextResponse.json(
          { error: "Takip linki geçerli bir URL değil" },
          { status: 400 }
        );
      }
    }
  }

  // Update
  const { error: updateErr } = await admin
    .from("order_assignments")
    .update(updatePayload)
    .eq("id", validation.assignment_id);

  if (updateErr) {
    console.error("[fason/update] error:", updateErr);
    return NextResponse.json(
      { error: "Güncelleme başarısız" },
      { status: 500 }
    );
  }

  // Access log
  await admin.from("fason_link_access_log").insert({
    assignment_id: validation.assignment_id,
    ip_address:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    action: "status_update",
    success: true,
  });

  // order_events log
  await logOrderEvent(admin, {
    orderId: validation.order_id,
    eventType: ACTION_TO_EVENT[action],
    actorRole: "fason",
    summary: `Fason durum güncelledi: ${action}`,
    detail: {
      assignment_id: validation.assignment_id,
      action,
      ...(action === "issue" && {
        category: updatePayload.issue_category,
        description: updatePayload.issue_description,
      }),
      ...(action === "shipped" && {
        tracking_company: updatePayload.tracking_company,
        tracking_number: updatePayload.tracking_number,
      }),
    },
  });

  // Order status update (shipped olunca müşteri için)
  if (action === "shipped") {
    await admin
      .from("orders")
      .update({ status: "shipped" })
      .eq("id", validation.order_id);
    await logOrderEvent(admin, {
      orderId: validation.order_id,
      eventType: "shipped",
      statusAfter: "shipped",
      actorRole: "system",
      summary: "Sipariş kargoya verildi",
      detail: { via: "fason_form" },
    });
  }

  // TODO Resend gelince: müşteriye "üretim hattına alındı" / "kargoya verildi" mail
  // TODO Resend gelince: Sefa'ya "fason sorun bildirdi" iç bildirim

  return NextResponse.json({ ok: true, newStatus });
}
