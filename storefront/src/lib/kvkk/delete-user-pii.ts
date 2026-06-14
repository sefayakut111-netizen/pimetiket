import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type DeleteUserPiiResult =
  | { ok: true }
  | { ok: false; stage: "rpc" | "auth"; message: string };

/**
 * KVKK Mimari A — DB PII silme/anonimleştirme + GoTrue anonimleştirme (auth.users silinmez).
 */
export async function deleteUserPiiAndAnonymizeAuth(
  admin: SupabaseClient<Database>,
  args: {
    userId: string;
    email: string | null;
    kvkkRequestId: string | null;
    actorId: string | null;
    actorRole?: "admin" | "customer";
  }
): Promise<DeleteUserPiiResult> {
  const { error } = await admin.rpc("fn_delete_user_pii", {
    p_user_id: args.userId,
    p_user_email: args.email ?? "",
    p_kvkk_request_id: args.kvkkRequestId ?? undefined,
    p_actor_id: args.actorId ?? undefined,
    p_actor_role: args.actorRole ?? "admin",
  });

  if (error) {
    return { ok: false, stage: "rpc", message: error.message };
  }

  const { error: authErr } = await admin.auth.admin.updateUserById(args.userId, {
    email: `deleted-${args.userId}@deleted.invalid`,
    phone: "",
    user_metadata: {},
    app_metadata: {},
    ban_duration: "876000h",
  });

  if (authErr) {
    return { ok: false, stage: "auth", message: authErr.message };
  }

  return { ok: true };
}
