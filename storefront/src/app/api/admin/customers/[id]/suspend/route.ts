/**
 * /api/admin/customers/[id]/suspend
 *
 * Müşteri hesabını dondur (suspend) ya da aç (unsuspend). Sefa 23
 * May v68 (P0 #4 — Grup D). Bu dosya daha önce CSV export
 * handler'ının kopyasıydı; UI "hesabı dondur" butonu CSV indiriyordu.
 *
 * UI sözleşmesi (src/app/admin/musteriler/[id]/page.tsx):
 *   POST { until: "permanent" | null, reason: string } → { ok, error? }
 *
 * Mantık:
 *   - until === null         → unsuspend (ban_duration: 'none')
 *   - until === "permanent"  → kalıcı dondur (~100 yıl: '876000h')
 *
 * reason min 3 char, max 500. audit_log'a detay olarak yazılır.
 * Supabase GoTrue ban_duration: ISO interval (e.g. '24h', '7d',
 * '876000h'); 'none' → ban kaldır.
 */

import { NextResponse, type NextRequest } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";

export const runtime = "nodejs";

const PostBodySchema = z.object({
  until: z.union([z.literal("permanent"), z.null()]),
  reason: z.string().trim().min(3, "Sebep çok kısa").max(500),
});

const PERMANENT_BAN = "876000h"; // ~100 yıl

function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
function userAgent(req: Request): string | null {
  return req.headers.get("user-agent") ?? null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("customers", "update");
  if (!auth) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Kendini dondurmaya izin verme
  if (id === auth.user.id) {
    return NextResponse.json(
      { error: "cannot_suspend_self" },
      { status: 400 }
    );
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = PostBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", detail: parsed.error.message },
      { status: 400 }
    );
  }
  const { until, reason } = parsed.data;
  const isSuspending = until === "permanent";

  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(id, {
    ban_duration: isSuspending ? PERMANENT_BAN : "none",
  });

  if (error) {
    return NextResponse.json(
      { error: "update_failed", detail: error.message },
      { status: 500 }
    );
  }

  try {
    await admin.from("audit_log").insert([
      {
        actor_id: auth.user.id,
        actor_email: auth.user.email,
        actor_role: "admin",
        action: (isSuspending
          ? "customer.suspend"
          : "customer.unsuspend") as Enums<"audit_action">,
        target_type: "user",
        target_id: id,
        summary: isSuspending
          ? `Müşteri hesabı donduruldu (kalıcı): ${reason}`
          : `Müşteri hesabı tekrar açıldı: ${reason}`,
        detail: {
          until,
          reason,
          ban_duration: isSuspending ? PERMANENT_BAN : "none",
        },
        ip_address: clientIp(req),
        user_agent: userAgent(req),
      },
    ]);
  } catch {
    /* audit log error silent */
  }

  return NextResponse.json({ ok: true });
}
