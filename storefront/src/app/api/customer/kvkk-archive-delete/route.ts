/**
 * POST /api/customer/kvkk-archive-delete
 *
 * Sefa 18 May v68 (R2 cold storage paketi):
 * KVKK madde 11/e gereği "kişisel verilerin silinmesi" talebi —
 * arşivde kalan tüm müşteri verisini fiziksel olarak siler.
 *
 * Bu endpoint ayrı bir KVKK delete flow'undan parça (mevcut /ayarlar/verilerim
 * silme akışıyla entegre). Çalışma sırası:
 *   1. Mevcut KVKK delete flow Postgres sıcak verisi siler
 *   2. Bu endpoint R2 arşiv verisini siler (cold storage cleanup)
 *   3. archive_events'e "kvkk_delete_request" + "permanent_deleted" kayıt
 *
 * Auth: kullanıcı veya admin (admin başkası adına talep edebilir)
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  deleteFromR2,
  listR2Objects,
  r2KeyBuilders,
} from "@/lib/storage/r2-client";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  // Body'den targetUserId al — admin başkası adına silebilir
  const body = await req.json().catch(() => ({}));
  const targetUserId = (body.targetUserId as string) ?? user.id;

  // Admin ise başkasının verisini silebilir (Pim Etiket: profiles.role)
  if (targetUserId !== user.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profile as { role?: string } | null)?.role;
    const isAdmin = role === "admin" || role === "staff";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Yetkisiz — sadece kendi verinizi silebilirsiniz" },
        { status: 403 }
      );
    }
  }

  // Service client (audit log için service_role gerekir)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const serviceClient = createServiceClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. KVKK delete request audit
    await serviceClient.from("archive_events").insert({
      event_type: "kvkk_delete_request",
      resource_type: "customer_bundle",
      resource_id: targetUserId,
      user_id: targetUserId,
      actor_id: user.id,
      actor_type: targetUserId === user.id ? "user" : "admin",
      reason: "KVKK m.11/e — kişisel veri silme talebi",
    });

    // 2. R2'deki tüm müşteri dosyalarını listele + sil
    const prefix = r2KeyBuilders.customerPrefix(targetUserId);
    const keys = await listR2Objects(prefix);

    const deleteResults = [];
    for (const key of keys) {
      const r = await deleteFromR2(key);
      deleteResults.push({ key, success: r.success });
    }

    // 3. Permanent deleted audit
    await serviceClient.from("archive_events").insert({
      event_type: "permanent_deleted",
      resource_type: "customer_bundle",
      resource_id: targetUserId,
      user_id: targetUserId,
      actor_id: user.id,
      actor_type: targetUserId === user.id ? "user" : "admin",
      archive_path: prefix,
      reason: "KVKK silme tamamlandı — R2 cold storage temizliği",
      metadata: {
        deleted_keys: keys.length,
        failed_deletes: deleteResults.filter((d) => !d.success).length,
      },
    });

    // 4. Profil status'unu 'deleted' yap (kayıt kalır, kişisel veri sıfırlanır)
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
