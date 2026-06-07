/**
 * POST /api/customer/kvkk-archive-delete
 *
 * KVKK m.11/e — R2 cold storage temizliği.
 * Y3: Yalnızca onaylı silme talebi + grace süresi dolduktan sonra çalışır.
 * Admin (service) başkası adına grace gate'i atlayabilir.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { assertKvkkR2DeleteEligible } from "@/lib/kvkk/delete-eligibility";
import { assertPermission } from "@/lib/supabase/assert-permission";
import {
  deleteFromR2,
  listR2Objects,
  r2KeyBuilders,
} from "@/lib/storage/r2-client";

export const runtime = "nodejs";
export const maxDuration = 60;

interface BodyShape {
  targetUserId?: string;
  kind?: "account_delete" | "partial_delete";
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Giriş yapmanız gerekiyor" },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as BodyShape;
  const targetUserId = body.targetUserId ?? user.id;
  const deleteKind = body.kind ?? "account_delete";

  const isSelf = targetUserId === user.id;
  let adminActing = false;

  if (!isSelf) {
    const auth = await assertPermission("customers", "delete");
    if (!auth) {
      return NextResponse.json(
        { error: "Yetkisiz — sadece kendi verinizi silebilirsiniz" },
        { status: 403 }
      );
    }
    adminActing = true;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const serviceClient = createServiceClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (!adminActing) {
    const eligibility = await assertKvkkR2DeleteEligible(
      serviceClient,
      targetUserId,
      deleteKind
    );
    if (!eligibility.ok) {
      return NextResponse.json(
        { error: eligibility.error },
        { status: eligibility.status }
      );
    }
  }

  try {
    await serviceClient.from("archive_events").insert({
      event_type: "kvkk_delete_request",
      resource_type: "customer_bundle",
      resource_id: targetUserId,
      user_id: targetUserId,
      actor_id: user.id,
      actor_type: adminActing ? "admin" : "user",
      reason: "KVKK m.11/e — kişisel veri silme talebi",
    });

    const prefix = r2KeyBuilders.customerPrefix(targetUserId);
    const keys = await listR2Objects(prefix);

    const deleteResults = [];
    for (const key of keys) {
      const r = await deleteFromR2(key);
      deleteResults.push({ key, success: r.success });
    }

    await serviceClient.from("archive_events").insert({
      event_type: "permanent_deleted",
      resource_type: "customer_bundle",
      resource_id: targetUserId,
      user_id: targetUserId,
      actor_id: user.id,
      actor_type: adminActing ? "admin" : "user",
      archive_path: prefix,
      reason: "KVKK silme tamamlandı — R2 cold storage temizliği",
      metadata: {
        deleted_keys: keys.length,
        failed_deletes: deleteResults.filter((d) => !d.success).length,
        kind: deleteKind,
      },
    });

    await serviceClient
      .from("profiles")
      .update({
        archive_status: "deleted",
        archive_path: null,
      })
      .eq("id", targetUserId);

    return NextResponse.json({
      success: true,
      deletedKeys: keys.length,
      failedDeletes: deleteResults.filter((d) => !d.success).length,
      message: "KVKK silme tamamlandı, arşiv temizlendi",
    });
  } catch (err) {
    console.error("[kvkk-archive-delete] failed:", err);
    return NextResponse.json(
      { error: "İşlem başarısız", details: (err as Error).message },
      { status: 500 }
    );
  }
}
