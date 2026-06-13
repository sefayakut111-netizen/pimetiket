/**
 * fn_transition_order_status RPC wrapper — orders.status tek chokepoint.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { OrderStatus } from "@/lib/order";

export type TransitionMode =
  | "forward"
  | "bulk"
  | "admin_override"
  | "compensating";

export type TransitionError =
  | "stale_from"
  | "invalid_transition"
  | "terminal"
  | "not_found"
  | "rpc_error";

export type TransitionOrderStatusInput = {
  orderId: string;
  to: OrderStatus;
  from?: OrderStatus | readonly OrderStatus[];
  mode?: TransitionMode;
  actorId?: string | null;
  actorRole?: "customer" | "admin" | "staff" | "system" | "fason";
  eventType?: string;
  summary?: string;
  detail?: Record<string, unknown>;
  idempotencyKey?: string;
  audit?: {
    action: string;
    summary?: string;
    detail?: Record<string, unknown>;
    actorEmail?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
};

export type TransitionOrderStatusResult =
  | {
      ok: true;
      fromStatus: OrderStatus;
      toStatus: OrderStatus;
      unchanged?: boolean;
      duplicate?: boolean;
    }
  | { ok: false; error: TransitionError; fromStatus?: OrderStatus };

type RpcRow = {
  ok?: boolean;
  error?: string;
  from_status?: string;
  to_status?: string;
  unchanged?: boolean;
  duplicate?: boolean;
};

export async function transitionOrderStatus(
  admin: SupabaseClient<Database>,
  input: TransitionOrderStatusInput
): Promise<TransitionOrderStatusResult> {
  const fromArr: OrderStatus[] | undefined = input.from
    ? Array.isArray(input.from)
      ? [...input.from]
      : [input.from]
    : undefined;

  const actorRole =
    input.actorRole === "fason" ? "staff" : (input.actorRole ?? "system");

  const { data, error } = await admin.rpc("fn_transition_order_status", {
    p_order_id: input.orderId,
    p_to_status: input.to,
    p_from_status: fromArr,
    p_mode: input.mode ?? "forward",
    p_actor_id: input.actorId ?? undefined,
    p_actor_role: actorRole,
    p_event_type: input.eventType ?? "status_changed",
    p_summary: input.summary ?? "",
    p_detail: (input.detail ?? {}) as Database["public"]["Tables"]["order_events"]["Insert"]["detail"],
    p_idempotency_key: input.idempotencyKey ?? undefined,
    p_audit_action: input.audit?.action ?? undefined,
    p_audit_summary: input.audit?.summary ?? undefined,
    p_audit_detail: (input.audit?.detail ?? {}) as Database["public"]["Tables"]["audit_log"]["Insert"]["detail"],
    p_actor_email: input.audit?.actorEmail ?? undefined,
    p_ip_address: input.audit?.ipAddress ?? undefined,
    p_user_agent: input.audit?.userAgent ?? undefined,
  });

  if (error) {
    console.error("[transition-order-status] rpc error:", error.message);
    return { ok: false, error: "rpc_error" };
  }

  const row = (data ?? {}) as RpcRow;
  if (!row.ok) {
    const err = row.error as TransitionError | undefined;
    return {
      ok: false,
      error: err ?? "rpc_error",
      fromStatus: row.from_status as OrderStatus | undefined,
    };
  }

  return {
    ok: true,
    fromStatus: (row.from_status ?? input.to) as OrderStatus,
    toStatus: (row.to_status ?? input.to) as OrderStatus,
    unchanged: row.unchanged ?? false,
    duplicate: row.duplicate ?? false,
  };
}

export function transitionHttpStatus(error: TransitionError): number {
  switch (error) {
    case "not_found":
      return 404;
    case "stale_from":
      return 409;
    case "invalid_transition":
    case "terminal":
      return 400;
    default:
      return 500;
  }
}
