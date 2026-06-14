/**
 * GET /api/cron/purge-expired-designs
 *
 * Daily cron (04:00 UTC) — KVKK m.4 periyodik imha:
 *   1. design_files'da deletion_due_at geçmiş satırları soft-delete işaretle
 *   2. Storage'dan asıl dosyaları sil
 *   3. Pim sohbet anonimleştir (tablo gelince)
 *   4. 10 yıl yasal saklama bitenleri SAYIM (alarm)
 *
 * Sefa iş kuralı: tasarım dosyası son siparişten 24 ay sonra silinir,
 * tekrar baskı geldiğinde sayaç sıfırlanır (fn_renew_design_retention).
 *
 * Bu cron sadece deletion_due_at < now() olanları işler — rolling
 * window mantığı RPC'de.
 *
 * Auth: CRON_SECRET (timing-safe).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";
import { withCronRun } from "@/lib/cron-logger";
import { logServerAudit } from "@/lib/audit-log-server";
import {
  listR2Objects,
  listR2ObjectsDetailed,
} from "@/lib/storage/r2-client";
import {
  deleteR2Keys,
  isR2StorageKey,
  normalizeR2Key,
} from "@/lib/storage/purge-r2";
import { deleteFromR2 } from "@/lib/storage/r2-client";

const EDITOR_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const dynamic = "force-dynamic";

interface ExpiredDesignRow {
  design_id: string;
  order_id: string;
  user_id: string;
  storage_path: string;
  deletion_due_at: string;
}

const STORAGE_BUCKET = "designs";

export async function GET(req: Request) {
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  try {
    const payload = await withCronRun("purge-expired-designs", async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) {
        throw new Error("Supabase env eksik");
      }
      const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

  // ---- 1) KVKK saklama suresi — iptal/teslim adaylarini isaretle ----
  try {
    await admin.rpc("fn_apply_kvkk_order_design_retention");
  } catch (err) {
    console.warn("[purge-expired-designs] kvkk retention apply skip:", err);
  }

  // ---- 2) Süresi dolmuş tasarımları işaretle (soft-delete) ----
  const { data: markedData, error: markErr } = await admin.rpc(
    "fn_mark_expired_designs_for_deletion"
  );
      if (markErr) {
        console.error("[purge-expired-designs] mark error:", markErr);
        throw new Error(markErr.message);
      }
  const marked = (markedData as ExpiredDesignRow[] | null) ?? [];

  // ---- 2) Asıl Storage dosyalarını sil ----
  let storageDeleted = 0;
  let storageErrors = 0;
  if (marked.length > 0) {
    // Batch 100'er — Supabase Storage delete limit
    for (let i = 0; i < marked.length; i += 100) {
      const batch = marked.slice(i, i + 100);
      const paths = batch
        .map((r) => r.storage_path)
        .filter((p) => p && !isR2StorageKey(p));
      if (paths.length === 0) continue;
      const { data: delData, error: delErr } = await admin.storage
        .from(STORAGE_BUCKET)
        .remove(paths);
      if (delErr) {
        console.error("[purge-expired-designs] storage delete error:", delErr);
        storageErrors += paths.length;
      } else {
        storageDeleted += (delData as { name: string }[])?.length ?? 0;
      }
    }
  }

  // ---- 2b) R2 cold archive + cutline key silme ----
  let r2Deleted = 0;
  let r2Errors = 0;
  if (marked.length > 0) {
    const designIds = marked.map((m) => m.design_id);
    const orderIds = [...new Set(marked.map((m) => m.order_id))];

    const { data: fileRows } = await admin
      .from("design_files")
      .select("id, archive_path, storage_path")
      .in("id", designIds);

    const { data: cutlineRows } = await admin
      .from("cutline_designs")
      .select("svg_url, preview_png_url")
      .in("order_id", orderIds);

    const r2Keys: string[] = [];
    for (const row of fileRows ?? []) {
      const fr = row as {
        archive_path: string | null;
        storage_path: string | null;
      };
      if (fr.archive_path) r2Keys.push(fr.archive_path);
      if (fr.storage_path && isR2StorageKey(fr.storage_path)) {
        r2Keys.push(fr.storage_path);
      }
    }
    for (const row of cutlineRows ?? []) {
      const cr = row as {
        svg_url: string | null;
        preview_png_url: string | null;
      };
      if (cr.svg_url) r2Keys.push(normalizeR2Key(cr.svg_url));
      if (cr.preview_png_url) r2Keys.push(normalizeR2Key(cr.preview_png_url));
    }

    const r2Result = await deleteR2Keys(r2Keys);
    r2Deleted = r2Result.deleted;
    r2Errors = r2Result.errors;

    // Süresi dolan siparişlerin print/{orderId}/ önbelleği
    const printKeys: string[] = [];
    for (const orderId of orderIds) {
      const keys = await listR2Objects(`print/${orderId}/`);
      printKeys.push(...keys);
    }
    if (printKeys.length > 0) {
      const printResult = await deleteR2Keys(printKeys);
      r2Deleted += printResult.deleted;
      r2Errors += printResult.errors;
    }
  }

  // ---- 2c) 30 günden eski editor-drafts/ ----
  try {
    const draftCutoff = Date.now() - EDITOR_DRAFT_MAX_AGE_MS;
    const draftItems = await listR2ObjectsDetailed("editor-drafts/");
    const staleDraftKeys = draftItems
      .filter(
        (o) => o.lastModified && o.lastModified.getTime() < draftCutoff
      )
      .map((o) => o.key);
    if (staleDraftKeys.length > 0) {
      const draftResult = await deleteR2Keys(staleDraftKeys);
      r2Deleted += draftResult.deleted;
      r2Errors += draftResult.errors;
    }
  } catch (err) {
    console.warn("[purge-expired-designs] editor-drafts purge skip:", err);
  }

  // ---- 2d) Süresi dolmuş KVKK data_export JSON dosyaları (R2) ----
  let dataExportPurged = 0;
  let dataExportPurgeErrors = 0;
  try {
    const nowIso = new Date().toISOString();
    const { data: expiredExports } = await admin
      .from("kvkk_requests")
      .select("id, user_id, result_path")
      .eq("kind", "data_export")
      .eq("status", "completed")
      .not("result_path", "is", null)
      .lt("result_expires_at", nowIso)
      .limit(100);

    for (const row of expiredExports ?? []) {
      const exp = row as {
        id: string;
        user_id: string;
        result_path: string | null;
      };
      if (!exp.result_path) continue;

      const del = await deleteFromR2(exp.result_path);
      if (!del.success) {
        dataExportPurgeErrors++;
        continue;
      }

      const { error: updErr } = await admin
        .from("kvkk_requests")
        .update({ result_path: null })
        .eq("id", exp.id)
        .eq("status", "completed");

      if (updErr) {
        dataExportPurgeErrors++;
      } else {
        dataExportPurged++;
      }
    }
  } catch (err) {
    console.warn("[purge-expired-designs] data_export TTL purge skip:", err);
  }

  // ---- 3) Pim sohbet anonimleştirme (stub — tablo gelince çalışır) ----
  let pimAnonymized: number | null = null;
  try {
    const { data: anonData } = await admin.rpc(
      "fn_anonymize_old_pim_conversations"
    );
    pimAnonymized = (anonData as number) ?? 0;
  } catch (err) {
    console.warn("[purge-expired-designs] pim anonymize skip:", err);
  }

  // ---- 4) 10 yıl yasal saklama sayım (alarm — gerçek silme 2036+) ----
  let legalCandidateCount = 0;
  let legalWarn30Day = 0;
  try {
    const { data: legalData } = await admin.rpc(
      "fn_count_legal_purge_candidates"
    );
    const row = (legalData as Array<{
      candidate_count: number;
      warn_30day_count: number;
    }>)?.[0];
    legalCandidateCount = row?.candidate_count ?? 0;
    legalWarn30Day = row?.warn_30day_count ?? 0;
  } catch (err) {
    console.warn("[purge-expired-designs] legal count skip:", err);
  }

  // ---- Audit log entry (toplu, run özeti) ----
  if (
    marked.length > 0 ||
    legalWarn30Day > 0 ||
    dataExportPurged > 0
  ) {
    await logServerAudit(admin, {
      actorId: null,
      actorEmail: null,
      actorRole: "system",
      action: "settings.update",
      targetType: "cron_run",
      targetId: "purge-expired-designs",
      summary: `Daily purge: ${marked.length} tasarım soft-delete, ${storageDeleted} storage sil, ${r2Deleted} R2 sil, ${dataExportPurged} data_export TTL, ${legalWarn30Day} sipariş 30 gün içinde yasal süre doluyor`,
      detail: {
        designs_marked: marked.length,
        storage_deleted: storageDeleted,
        storage_errors: storageErrors,
        r2_deleted: r2Deleted,
        r2_errors: r2Errors,
        data_export_purged: dataExportPurged,
        data_export_purge_errors: dataExportPurgeErrors,
        pim_anonymized: pimAnonymized,
        legal_candidates: legalCandidateCount,
        legal_warn_30day: legalWarn30Day,
      },
    });
  }

      const responseData = {
        ok: true,
        designs_marked: marked.length,
        storage_deleted: storageDeleted,
        storage_errors: storageErrors,
        r2_deleted: r2Deleted,
        r2_errors: r2Errors,
        data_export_purged: dataExportPurged,
        data_export_purge_errors: dataExportPurgeErrors,
        pim_anonymized: pimAnonymized,
        legal_candidates: legalCandidateCount,
        legal_warn_30day: legalWarn30Day,
        timestamp: new Date().toISOString(),
      };

      return {
        summary: `${marked.length} tasarım imha, ${storageDeleted} storage + ${r2Deleted} R2 silindi`,
        itemsProcessed: marked.length,
        data: responseData,
      };
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/purge-expired-designs]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
