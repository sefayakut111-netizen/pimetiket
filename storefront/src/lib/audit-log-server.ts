/**
 * Server-side audit log helper.
 *
 * Admin API endpoint'lerinden çağrılır. Service role kullanır,
 * RLS bypass eder. audit_log tablosu append-only — UPDATE/DELETE
 * trigger ile bloklanır (Migration 004 + 022).
 *
 * Kullanım:
 *   await logServerAudit(admin, {
 *     actorId: user.id,
 *     actorEmail: user.email,
 *     actorRole: 'admin',
 *     action: 'order.status_change',
 *     targetType: 'order',
 *     targetId: orderId,
 *     summary: `Sipariş ${orderId} → in_production`,
 *     detail: { from: 'paid', to: 'in_production' },
 *     ipAddress: req.headers.get('x-forwarded-for'),
 *     userAgent: req.headers.get('user-agent'),
 *   });
 *
 * Hata fırlatmaz — audit log kaybı asıl işlemi bloklamasın.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type AuditAction =
  | "order.status_change"
  | "order.cancel"
  | "order.refund"
  | "return.approve"
  | "return.reject"
  | "return.refund"
  | "coupon.create"
  | "coupon.update"
  | "coupon.delete"
  | "review.approve"
  | "review.reject"
  | "review.delete"
  | "staff.invite"
  | "staff.remove"
  | "staff.role_change"
  | "settings.update"
  | "design_file.approve"
  | "design_file.reject"
  | "auth.login"
  | "auth.logout"
  | "profile.delete"
  | "partner.capability_verify"
  | "partner.capability_unverify";

export interface ServerAuditInput {
  actorId: string | null;
  actorEmail: string | null;
  actorRole: "admin" | "staff" | "customer" | "system";
  action: AuditAction;
  targetType?: string | null;
  targetId?: string | null;
  summary: string;
  detail?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logServerAudit(
  admin: SupabaseClient,
  input: ServerAuditInput
): Promise<void> {
  try {
    const { error } = await admin.from("audit_log").insert({
      actor_id: input.actorId,
      actor_email: input.actorEmail,
      actor_role: input.actorRole,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      summary: input.summary.slice(0, 500),
      detail: input.detail ?? {},
      ip_address: normalizeIp(input.ipAddress),
      user_agent: input.userAgent?.slice(0, 500) ?? null,
    });
    if (error) {
      console.error("[audit-server] insert error:", error.message);
    }
  } catch (err) {
    // Audit log kaybı asıl işlemi bloklamasın
    console.error(
      "[audit-server] unexpected:",
      err instanceof Error ? err.message : err
    );
  }
}

/** x-forwarded-for genelde "1.2.3.4, 5.6.7.8" formatı — ilk IP'yi al */
function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  if (!first) return null;
  // inet kolonu için sadece valid IP olabilir; basit doğrulama
  if (/^[0-9a-f.:]+$/i.test(first)) return first;
  return null;
}
