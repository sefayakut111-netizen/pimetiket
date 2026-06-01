/**
 * GET /api/cron/process-mail-outbox
 *
 * Vercel Cron günde bir kez bu endpoint'i çağırır (Hobby plan limiti;
 * Pro plan'a geçince schedule * /5 * * * * yapılabilir).
 * fason_mail_outbox tablosundan pending/failed kayıtları okur ve
 * Resend üzerinden gönderir.
 *
 * STUB MODU (Resend env yok):
 *   RESEND_API_KEY ve RESEND_FROM_EMAIL yoksa endpoint çalışır
 *   ama hiçbir mail göndermez — sadece kayıtları "blocked_no_provider"
 *   son hatasıyla işaretler, kuyrukta tutar. Resend aktifleşince
 *   tekrar denenir.
 *
 * Auth: CRON_SECRET (Vercel Cron Authorization header otomatik).
 *
 * Test (manuel):
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://pimetiket.com/api/cron/process-mail-outbox
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderMailTemplate } from "@/lib/mail/templates";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import {
  buildUnsubscribeUrl,
  buildListUnsubscribeHeader,
} from "@/lib/mail/unsubscribe";

export const dynamic = "force-dynamic";

interface OutboxRow {
  id: string;
  assignment_id: string;
  template_key: string;
  to_email: string;
  subject: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  /** Sefa 21 May v68 — unsubscribe URL + List-Unsubscribe için */
  category: "fason" | "customer" | "lead" | "admin" | null;
}

const MAX_ATTEMPTS = 6;
const BATCH_SIZE = 25;

/** Exponential backoff: 5 dk → 15 dk → 45 dk → 2 sa → 6 sa → 12 sa */
function backoffMinutes(attempts: number): number {
  const ladder = [5, 15, 45, 120, 360, 720];
  return ladder[Math.min(attempts, ladder.length - 1)];
}

export async function GET(req: Request) {
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  try {
    const payload = await withCronRun("process-mail-outbox", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) {
        throw new Error("Supabase env eksik");
      }

      const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Env naming unification: src/lib/mail/resend.ts ile aynı isim kullan.
      // Önce RESEND_FROM_EMAIL, fallback MAIL_FROM_ADDRESS (legacy).
      const resendKey = process.env.RESEND_API_KEY;
      const fromAddress =
        process.env.RESEND_FROM_EMAIL ?? process.env.MAIL_FROM_ADDRESS;
      const stubMode = !resendKey || !fromAddress;

      const staleSendingCutoff = new Date(
        Date.now() - 30 * 60 * 1000
      ).toISOString();
      await admin
        .from("fason_mail_outbox")
        .update({
          status: "failed",
          last_error: "stale_sending_recovered",
          next_retry_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("status", "sending")
        .lt("updated_at", staleSendingCutoff);

      // Pending veya retry zamanı gelen kayıtları çek
      const { data: rows, error: selectErr } = await admin
        .from("fason_mail_outbox")
        .select(
          "id, assignment_id, template_key, to_email, subject, payload, attempts, category"
        )
        .in("status", ["pending", "failed"])
        .lt("attempts", MAX_ATTEMPTS)
        .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
        .order("created_at", { ascending: true })
        .limit(BATCH_SIZE);

      if (selectErr) {
        console.error("[cron/process-mail-outbox] select error:", selectErr);
        throw new Error(selectErr.message);
      }

  const queue = (rows as OutboxRow[] | null) ?? [];

  let sent = 0;
  let blocked = 0;
  let failed = 0;
  let unknownTemplate = 0;

  for (const row of queue) {
    // Sefa 21 May v68 — Lead/marketing kategorisi için token-li
    // unsubscribe URL üret + List-Unsubscribe header ekle. Transactional
    // mailler (customer/admin/fason) için zorunlu değil (KVKK m.5/2-c).
    const isMarketing = row.category === "lead";
    let unsubscribeUrl: string | undefined;
    let listUnsubHeader:
      | { listUnsubscribe: string; listUnsubscribePost: string }
      | undefined;
    if (isMarketing && row.to_email) {
      try {
        unsubscribeUrl = buildUnsubscribeUrl(row.to_email, "marketing");
        listUnsubHeader = buildListUnsubscribeHeader(
          row.to_email,
          "marketing"
        );
      } catch (e) {
        // UNSUBSCRIBE_SECRET yoksa silent — template fallback kullanır
        console.warn(
          "[cron/process-mail-outbox] unsubscribe url build skipped:",
          e instanceof Error ? e.message : e
        );
      }
    }

    const renderPayload: Record<string, unknown> = {
      ...(row.payload ?? {}),
      ...(unsubscribeUrl ? { _unsubscribe_url: unsubscribeUrl } : {}),
    };

    if (
      row.template_key === "fason_new_assignment" &&
      !renderPayload.fason_token &&
      row.assignment_id
    ) {
      const { data: tokRow } = await admin
        .from("fason_access_tokens")
        .select("token")
        .eq("assignment_id", row.assignment_id)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const plain = (tokRow as { token: string } | null)?.token;
      if (plain) {
        renderPayload.fason_token = plain;
      } else {
        await admin
          .from("fason_mail_outbox")
          .update({
            status: "failed",
            attempts: row.attempts + 1,
            last_error: "fason_token_resolve_failed",
            next_retry_at: new Date(
              Date.now() + backoffMinutes(row.attempts + 1) * 60_000
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        failed++;
        continue;
      }
    }

    const rendered = renderMailTemplate(row.template_key, renderPayload);

    // Template tanımsızsa hard-fail (retry yapmaya gerek yok)
    if (!rendered) {
      unknownTemplate++;
      await admin
        .from("fason_mail_outbox")
        .update({
          status: "failed",
          attempts: row.attempts + 1,
          last_error: `unknown_template:${row.template_key}`,
          next_retry_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      continue;
    }

    // STUB modu — Resend yok, kuyrukta tutmaya devam
    if (stubMode) {
      blocked++;
      const nextRetry = new Date(
        Date.now() + backoffMinutes(row.attempts) * 60_000
      ).toISOString();
      await admin
        .from("fason_mail_outbox")
        .update({
          status: "pending", // failed değil — Resend gelince çalışsın
          last_error: "blocked_no_provider",
          next_retry_at: nextRetry,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      continue;
    }

    // ----- Resend gönderim (aktif olduğunda) -----
    try {
      // Atomic claim: status pending/failed ise sending'e çevir.
      // 2 paralel cron instance aynı satırı çekerse, ikincisi
      // 0 satır günceller ve atlanır → duplicate mail gönderilmez.
      const { data: claimed, error: claimErr } = await admin
        .from("fason_mail_outbox")
        .update({
          status: "sending",
          attempts: row.attempts + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .in("status", ["pending", "failed"])
        .select("id")
        .maybeSingle();
      if (claimErr || !claimed) {
        // Başka worker zaten claim etti → atla
        continue;
      }

      // Resend body — List-Unsubscribe header'ı sadece marketing için
      const resendBody: Record<string, unknown> = {
        from: fromAddress,
        to: row.to_email,
        subject: row.subject ?? rendered.subject,
        html: rendered.html,
        text: rendered.text,
      };
      if (listUnsubHeader) {
        resendBody.headers = {
          "List-Unsubscribe": listUnsubHeader.listUnsubscribe,
          // RFC 8058 — Gmail/Yahoo One-Click
          "List-Unsubscribe-Post": listUnsubHeader.listUnsubscribePost,
        };
      }

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resendBody),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`resend_${resp.status}: ${text.slice(0, 200)}`);
      }

      const json = (await resp.json().catch(() => ({}))) as {
        id?: string;
      };

      await admin
        .from("fason_mail_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          resend_message_id: json.id ?? null,
          last_error: null,
          next_retry_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      sent++;
    } catch (err) {
      failed++;
      const errMsg = err instanceof Error ? err.message : "unknown_error";
      const nextAttempts = row.attempts + 1;
      const willRetry = nextAttempts < MAX_ATTEMPTS;
      const nextRetry = willRetry
        ? new Date(
            Date.now() + backoffMinutes(nextAttempts) * 60_000
          ).toISOString()
        : null;

      await admin
        .from("fason_mail_outbox")
        .update({
          // willRetry false → terminal state (max attempt). UI'da filter
          // edilebilsin diye "failed" kalır; next_retry_at null sinyal.
          status: "failed",
          last_error: errMsg.slice(0, 500),
          next_retry_at: nextRetry,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }

      const responseData = {
        ok: true,
        mode: stubMode ? "stub" : "live",
        processed: queue.length,
        sent,
        blocked, // STUB modunda kuyrukta bekletilen sayısı
        failed,
        unknown_template: unknownTemplate,
        timestamp: new Date().toISOString(),
      };

      return {
        summary: `${sent} mail gönderildi, ${failed} hata, ${blocked} blocked`,
        itemsProcessed: queue.length,
        data: responseData,
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/process-mail-outbox]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
