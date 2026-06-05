/**
 * GET /api/admin/kvkk/delete-audit
 *
 * Manuel KVKK delete follow-up audit — processed silme taleplerinde
 * R2 müşteri klasörü temizliğini doğrular (SADECE okur).
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { runKvkkDeleteAudit } from "@/lib/kvkk/delete-audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertPermission("kvkk", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const admin = createAdminClient();
    const report = await runKvkkDeleteAudit(admin);
    return NextResponse.json(report);
  } catch (err) {
    console.error("[admin/kvkk/delete-audit]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "KVKK delete audit başarısız",
      },
      { status: 500 }
    );
  }
}
