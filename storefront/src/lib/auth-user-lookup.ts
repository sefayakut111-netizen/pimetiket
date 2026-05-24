/**
 * Email → auth.users.id lookup (Migration 088 fn_find_auth_user_by_email).
 * RPC henüz remote'da yoksa paginated listUsers fallback.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Mig 088 — types regenerate öncesi geçici genişletme */
type DatabaseWithEmailLookup = Database & {
  public: Database["public"] & {
    Functions: Database["public"]["Functions"] & {
      fn_find_auth_user_by_email: {
        Args: { p_email: string };
        Returns: { user_id: string; email_confirmed_at: string | null }[];
      };
    };
  };
};

export async function findAuthUserIdByEmail(
  admin: SupabaseClient<Database>,
  email: string
): Promise<string | null> {
  const row = await findAuthUserByEmail(admin, email);
  return row?.user_id ?? null;
}

export async function findAuthUserByEmail(
  admin: SupabaseClient<Database>,
  email: string
): Promise<{ user_id: string; email_confirmed_at: string | null } | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return null;

  const rpcClient = admin as SupabaseClient<DatabaseWithEmailLookup>;
  const { data: rpcRows, error: rpcErr } = await rpcClient.rpc(
    "fn_find_auth_user_by_email",
    { p_email: normalized }
  );

  if (!rpcErr && rpcRows?.[0]?.user_id) {
    return rpcRows[0];
  }

  // Mig 088 apply edilmemişse veya RPC hata verdiyse fallback
  if (rpcErr && !isMissingRpcError(rpcErr)) {
    console.warn("[auth-user-lookup] RPC error:", rpcErr.message);
  }

  let page = 1;
  const perPage = 1000;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn("[auth-user-lookup] listUsers error:", error.message);
      return null;
    }
    const match = (data.users ?? []).find(
      (u) => u.email?.toLowerCase() === normalized
    );
    if (match?.id) {
      return {
        user_id: match.id,
        email_confirmed_at: match.email_confirmed_at ?? null,
      };
    }
    if ((data.users ?? []).length < perPage) break;
    page += 1;
  }
  return null;
}

function isMissingRpcError(err: { message?: string; code?: string }): boolean {
  const msg = (err.message ?? "").toLowerCase();
  return (
    err.code === "42883" ||
    err.code === "PGRST202" ||
    msg.includes("could not find the function") ||
    msg.includes("function public.fn_find_auth_user_by_email")
  );
}
