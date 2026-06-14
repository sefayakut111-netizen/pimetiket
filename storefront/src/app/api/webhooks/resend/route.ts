/**
 * POST /api/webhooks/resend
 *
 * Sefa 21 May v68 — Resend webhook event handler.
 *
 * Resend webhook'ları Svix imzalı gönderir. Header'lar:
 *   svix-id, svix-timestamp, svix-signature
 *
 * Signature doğrulama:
 *   secret_b64 = WHSEC olmadan (whsec_xxxx → xxxx kısmı, base64-decode)
 *   payload = `${svix-id}.${svix-timestamp}.${rawBody}`
 *   expected = base64(HMAC-SHA256(secret_b64, payload))
 *   Header `v1,xxx v1,yyy` formatında, en az biri eşleşmeli.
 *
 * Resend dashboard:
 *   Webhook URL: https://pimetiket.com/api/webhooks/resend
 *   Events: email.sent, email.delivered, email.delivery_delayed,
 *           email.bounced, email.complained, email.opened, email.clicked
 *
 * Davranış:
 *   - email.delivered → outbox.delivered_at set
 *   - email.bounced (hard) → outbox.bounced_at + mail_suppressions
 *   - email.complained → outbox.complaint_at + mail_suppressions (her zaman)
 *   - email.opened/clicked → outbox.opened_at/clicked_at set (ilk olay)
 *
 * Idempotency: svix-id header'ı + outbox.last_event_at karşılaştırma.
 */

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { recordSuppression } from "@/lib/mail/suppression";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// Tipler
// ============================================================
type ResendEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.complained"
  | "email.opened"
  | "email.clicked"
  | "email.failed";

interface ResendBounceData {
  type?: "hard" | "soft" | string;
  subType?: string;
  message?: string;
}

interface ResendEventPayload {
  type: ResendEventType;
  created_at?: string;
  data: {
    email_id?: string;
    to?: string[] | string;
    from?: string;
    subject?: string;
    bounce?: ResendBounceData;
    [k: string]: unknown;
  };
}

// ============================================================
// Svix imza doğrulama
// ============================================================
/**
 * Svix-style HMAC signature verification.
 * @returns true if any v1 signature matches; false otherwise.
 */
function verifySvix(
  rawBody: string,
  svixId: string,
  svixTs: string,
  svixSig: string,
  secretWithPrefix: string
): boolean {
  // "whsec_xxxx" → xxxx (base64)
  const secretBase64 = secretWithPrefix.startsWith("whsec_")
    ? secretWithPrefix.slice(6)
    : secretWithPrefix;

  let secretBuf: Buffer;
  try {
    secretBuf = Buffer.from(secretBase64, "base64");
  } catch {
    return false;
  }

  const payload = `${svixId}.${svixTs}.${rawBody}`;
  const expected = createHmac("sha256", secretBuf)
    .update(payload)
    .digest("base64");

  // Header format: "v1,sig1 v1,sig2 v2,sig3"
  const sigs = svixSig.split(" ");
  for (const s of sigs) {
    const [version, value] = s.split(",");
    if (version !== "v1" || !value) continue;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    if (a.length !== b.length) continue;
    try {
      if (timingSafeEqual(a, b)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

/** Replay attack koruması — timestamp > 5dk eski olmasın. */
function isFreshTimestamp(svixTs: string): boolean {
  const ts = Number(svixTs);
  if (!Number.isFinite(ts)) return false;
  const ageMs = Date.now() - ts * 1000;
  // ±5dk tolere et
  return Math.abs(ageMs) <= 5 * 60 * 1000;
}

// ============================================================
// Handler
// ============================================================
export async function POST(req: Request) {
  // 1) Body ve header'ları al
  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTs = req.headers.get("svix-timestamp") ?? "";
  const svixSig = req.headers.get("svix-signature") ?? "";

  if (!svixId || !svixTs || !svixSig) {
    return NextResponse.json(
      { error: "missing_svix_headers" },
      { status: 400 }
    );
  }

  // 2) İmza doğrula (RESEND_WEBHOOK_SECRET yoksa reddet)
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook/resend] RESEND_WEBHOOK_SECRET eksik");
    return NextResponse.json(
      { error: "webhook_not_configured" },
      { status: 503 }
    );
  }

  if (!isFreshTimestamp(svixTs)) {
    return NextResponse.json(
      { error: "stale_timestamp" },
      { status: 400 }
    );
  }

  if (!verifySvix(rawBody, svixId, svixTs, svixSig, secret)) {
    return NextResponse.json(
      { error: "invalid_signature" },
      { status: 401 }
    );
  }

  // 3) Parse
  let evt: ResendEventPayload;
  try {
    evt = JSON.parse(rawBody) as ResendEventPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!evt.type || !evt.data) {
    return NextResponse.json(
      { error: "invalid_payload_shape" },
      { status: 400 }
    );
  }

  // 4) Supabase admin client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "supabase_env_missing" },
      { status: 500 }
    );
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const messageId = evt.data.email_id ?? null;
  const toArr = Array.isArray(evt.data.to)
    ? evt.data.to
    : evt.data.to
    ? [evt.data.to]
    : [];
  const recipient = toArr[0] ?? "";

  // 5) Event router
  const nowIso = new Date().toISOString();

  switch (evt.type) {
    case "email.bounced": {
      const bounceType = evt.data.bounce?.type ?? "unknown";
      const bounceMsg = evt.data.bounce?.message ?? "";
      if (recipient && bounceType === "hard") {
        await recordSuppression({
          email: recipient,
          type: "bounce_hard",
          reason: `${bounceType}: ${bounceMsg}`.slice(0, 500),
          sourceMessageId: messageId ?? undefined,
          sourceEventId: svixId,
        });
      }
      break;
    }
    case "email.complained": {
      if (recipient) {
        await recordSuppression({
          email: recipient,
          type: "complaint",
          reason: "user_marked_spam",
          sourceMessageId: messageId ?? undefined,
          sourceEventId: svixId,
        });
      }
      break;
    }
    case "email.sent":
    case "email.delivery_delayed":
    case "email.delivered":
    case "email.opened":
    case "email.clicked":
    case "email.failed":
      break;
    default:
      console.warn("[webhook/resend] unknown event type:", evt.type);
      return NextResponse.json({ ok: true, ignored: true });
  }

  // 6) Outbox row güncelle (varsa) — metadata her zaman; timestamp null-guard
  if (messageId) {
    const metaPatch: Record<string, unknown> = {
      last_event: evt.type,
      last_event_at: nowIso,
    };
    if (evt.type === "email.failed") {
      metaPatch.last_error = "resend_failed_event";
    }

    const { error: metaErr } = await admin
      .from("fason_mail_outbox")
      .update(metaPatch)
      .eq("resend_message_id", messageId);
    if (metaErr) {
      console.error("[webhook/resend] outbox meta update error:", metaErr);
    }

    let tsField: string | null = null;
    switch (evt.type) {
      case "email.delivered":
        tsField = "delivered_at";
        break;
      case "email.opened":
        tsField = "opened_at";
        break;
      case "email.clicked":
        tsField = "clicked_at";
        break;
      case "email.bounced":
        tsField = "bounced_at";
        break;
      case "email.complained":
        tsField = "complaint_at";
        break;
      default:
        break;
    }

    if (tsField) {
      const { error: tsErr } = await admin
        .from("fason_mail_outbox")
        .update({ [tsField]: nowIso })
        .eq("resend_message_id", messageId)
        .is(tsField, null);
      if (tsErr) {
        console.error("[webhook/resend] outbox timestamp update error:", tsErr);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    type: evt.type,
    matched_outbox: Boolean(messageId),
  });
}

// Cron auth değil — webhook secret kullanıyoruz; GET'i 405 ile reddet
export function GET() {
  return NextResponse.json(
    { error: "method_not_allowed" },
    { status: 405 }
  );
}
