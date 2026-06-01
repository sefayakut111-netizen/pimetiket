import type { SupabaseClient } from "@supabase/supabase-js";

/** KVKK partial_delete (pim_chat) — üye Pim sohbet kaydını sunucudan sil. */
export async function deletePimConversationForUser(
  admin: SupabaseClient,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await admin
    .from("pim_conversations")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("[kvkk] pim_conversations delete failed:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export function scopeIncludesPimChat(
  scope: Record<string, unknown> | null | undefined
): boolean {
  return scope?.pim_chat === true;
}
