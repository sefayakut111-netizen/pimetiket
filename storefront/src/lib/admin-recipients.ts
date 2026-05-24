/**
 * Auditor / admin bildirim alıcıları.
 * profiles tablosunda email yok — auth.users üzerinden çözülür.
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";

export async function getAuditorNotifyEmails(): Promise<string[]> {
  const envOverride = process.env.AUDITOR_NOTIFY_EMAILS;
  if (envOverride) {
    return envOverride
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));
  }

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .in("role", [...(["admin", "staff"] as const)] as Enums<"user_role">[]);

  const emails: string[] = [];
  for (const p of profiles ?? []) {
    const { data: userData } = await admin.auth.admin.getUserById(p.id);
    const email = userData?.user?.email;
    if (email?.includes("@")) emails.push(email);
  }
  return emails;
}
