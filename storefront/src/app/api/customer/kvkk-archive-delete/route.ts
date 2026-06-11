/**
 * POST /api/customer/kvkk-archive-delete
 *
 * KVKK m.11/e — R2 + Supabase depolama temizliği.
 * Y3: Yalnızca onaylı silme talebi + grace süresi dolduktan sonra çalışır.
 * Admin (service) başkası adına grace gate'i atlayabilir.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { assertKvkkR2DeleteEligible } from "@/lib/kvkk/delete-eligibility";
import { purgeKvkkUserStorage } from "@/lib/kvkk/storage-purge";
import { assertPermission } from "@/lib/supabase/assert-permission";

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

    const purge = await purgeKvkkUserStorage({
      admin: serviceClient,
      userId: targetUserId,
      kind: deleteKind,
      actorId: user.id,
      actorType: adminActing ? "admin" : "user",
      reason: "KVKK silme tamamlandı — depolama temizliği",
    });

    if (!purge.ok) {
      return NextResponse.json(
        {
          error: purge.error ?? "Depolama temizliği kısmen başarısız",
          supabaseDeleted: purge.supabaseDeleted,
          r2Deleted: purge.r2Deleted,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      supabaseDeleted: purge.supabaseDeleted,
      r2Deleted: purge.r2Deleted,
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
