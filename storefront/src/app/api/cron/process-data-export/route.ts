/**
 * GET /api/cron/process-data-export
 *
 * KVKK m.11/g data_export worker: processing → exporting → JSON R2 → mail → completed.
 * Hobby: günlük cron + talep-anı fire-and-forget (triggerDataExportProcess).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import { casUpdate } from "@/lib/db/cas-update";
import {
  collectUserExportData,
  EXPORT_TTL_SECONDS,
} from "@/lib/kvkk/collect-export-data";
import { enqueueMail } from "@/lib/mail/enqueue";
import {
  getSignedDownloadUrl,
  uploadToR2,
} from "@/lib/storage/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_LIMIT = 5;
const STUCK_EXPORTING_MS = 30 * 60 * 1000;

interface ExportRow {
  id: string;
  user_id: string;
}

export async function GET(req: Request) {
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  try {
    const payload = await withCronRun("process-data-export", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) {
        throw new Error("Supabase env eksik");
      }

      const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const stuckCutoff = new Date(Date.now() - STUCK_EXPORTING_MS).toISOString();
      await admin
        .from("kvkk_requests")
        .update({ status: "processing" })
        .eq("kind", "data_export")
        .eq("status", "exporting")
        .lt("updated_at", stuckCutoff);

      const { data: rows, error: selectErr } = await admin
        .from("kvkk_requests")
        .select("id, user_id")
        .eq("kind", "data_export")
        .eq("status", "processing")
        .order("created_at", { ascending: true })
        .limit(BATCH_LIMIT);

      if (selectErr) {
        throw new Error(selectErr.message);
      }

      const queue = (rows as ExportRow[] | null) ?? [];
      let completed = 0;
      let failed = 0;

      for (const row of queue) {
        try {
          const claim = await casUpdate(
            admin,
            "kvkk_requests",
            row.id,
            { status: "exporting" },
            { expectFrom: "processing", col: "status" }
          );
          if (!claim.ok) continue;

          const { data: userData, error: userErr } =
            await admin.auth.admin.getUserById(row.user_id);
          const email = userData?.user?.email;
          if (userErr || !email) {
            await casUpdate(admin, "kvkk_requests", row.id, {
              status: "processing",
            }, { expectFrom: "exporting", col: "status" });
            failed++;
            continue;
          }

          const exportData = await collectUserExportData(
            admin,
            row.user_id,
            email
          );
          const json = JSON.stringify(exportData, null, 2);
          const key = `exports/${row.user_id}/${row.id}.json`;

          const up = await uploadToR2({
            key,
            body: json,
            contentType: "application/json",
          });
          if (!up.success) {
            await casUpdate(admin, "kvkk_requests", row.id, {
              status: "processing",
            }, { expectFrom: "exporting", col: "status" });
            failed++;
            continue;
          }

          const downloadUrl = await getSignedDownloadUrl(
            key,
            EXPORT_TTL_SECONDS,
            {
              downloadFilename: `pimetiket-verilerim-${row.id}.json`,
              contentType: "application/json",
            }
          );
          const expiresAt = new Date(
            Date.now() + EXPORT_TTL_SECONDS * 1000
          );

          await enqueueMail({
            templateKey: "customer_data_export_ready",
            to: email,
            category: "customer",
            targetType: "user",
            targetId: row.user_id,
            idempotencyKey: `data_export_ready:${row.id}`,
            payload: {
              download_url: downloadUrl,
              expires_at: expiresAt.toISOString(),
              request_id: row.id,
            },
          });

          const done = await casUpdate(admin, "kvkk_requests", row.id, {
            status: "completed",
            result_path: key,
            result_expires_at: expiresAt.toISOString(),
          }, { expectFrom: "exporting", col: "status" });

          if (done.ok) completed++;
          else failed++;
        } catch (err) {
          console.error("[cron/process-data-export] row error:", row.id, err);
          await casUpdate(admin, "kvkk_requests", row.id, {
            status: "processing",
          }, { expectFrom: "exporting", col: "status" });
          failed++;
        }
      }

      return {
        summary: `${queue.length} export kuyruğu, ${completed} tamam, ${failed} hata/retry`,
        itemsProcessed: queue.length,
        data: {
          ok: true,
          queued: queue.length,
          completed,
          failed,
        },
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/process-data-export]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
