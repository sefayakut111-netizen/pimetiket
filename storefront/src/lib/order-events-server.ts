/**
 * Server-side order_events helper.
 *
 * Bütün admin/fason endpoint'lerinde sipariş yaşam döngüsü olayları
 * `order_events` tablosuna eklenir (Migration 002 + 019'da event_type
 * CHECK genişletildi). Daha önce 8+ endpoint aynı insert pattern'ini
 * tekrarlıyordu — bu helper o tekrarı kapatır.
 *
 * Hata fırlatmaz: event log kaybı asıl iş akışını bloklamasın.
 *
 * Kullanım:
 *   await logOrderEvent(admin, {
 *     orderId,
 *     eventType: "fason_assigned",
 *     statusAfter: "in_production",
 *     actorId: user.id,
 *     actorRole: "admin",
 *     summary: "Fason atandı: İstanbul Atölye",
 *     detail: { assignment_id, fason_id, ... },
 *   });
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type OrderEventActorRole = "customer" | "admin" | "staff" | "fason" | "system";

export interface OrderEventInput {
  orderId: string;
  eventType: string;
  statusAfter?: string | null;
  actorId?: string | null;
  actorRole: OrderEventActorRole;
  summary: string;
  detail?: Record<string, unknown>;
}

export async function logOrderEvent(
  admin: SupabaseClient,
  input: OrderEventInput
): Promise<void> {
  try {
    const { error } = await admin.from("order_events").insert({
      order_id: input.orderId,
      event_type: input.eventType,
      status_after: input.statusAfter ?? null,
      actor_id: input.actorId ?? null,
      actor_role: input.actorRole,
      summary: input.summary.slice(0, 500),
      detail: input.detail ?? {},
    });
    if (error) {
      console.error("[order-events] insert error:", error.message);
    }
  } catch (err) {
    console.error(
      "[order-events] unexpected:",
      err instanceof Error ? err.message : err
    );
  }
}
