/**
 * GET /api/admin/archive/r2-status
 *
 * R2 bağlantı durumu — admin arşiv sayfası badge için.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import {
  getR2Config,
  getR2ObjectInfo,
  uploadToR2,
  deleteFromR2,
} from "@/lib/storage/r2-client";

export const runtime = "nodejs";

const PROBE_KEY = "_health/r2-probe.txt";

export async function GET() {
  const auth = await assertPermission("archive", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = getR2Config();
  let hotPathOk = false;
  let probeError: string | null = null;

  if (config.hasCredentials) {
    try {
      const upload = await uploadToR2({
        key: PROBE_KEY,
        body: `probe-${Date.now()}`,
        contentType: "text/plain",
      });
      if (upload.success) {
        const info = await getR2ObjectInfo(PROBE_KEY);
        hotPathOk = info.exists;
        await deleteFromR2(PROBE_KEY);
      } else {
        probeError = upload.error ?? "upload_failed";
      }
    } catch (err) {
      probeError = (err as Error).message;
    }
  }

  return NextResponse.json({
    ...config,
    hotPathOk,
    probeError,
    archiveDryRunNote:
      config.archiveDryRun === true
        ? "Cold archive cron DRY_RUN — cutline/manifest hot path gerçek R2 kullanır"
        : "Cold archive cron aktif (R2_ARCHIVE_DRY_RUN=false)",
  });
}
