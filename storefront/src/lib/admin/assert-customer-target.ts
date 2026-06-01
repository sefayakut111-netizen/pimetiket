import "server-only";

import { NextResponse } from "next/server";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Yalnızca customer rolündeki kullanıcılar suspend/delete edilebilir. */
export async function assertCustomerOnlyTarget(
  admin: AdminClient,
  userId: string
): Promise<NextResponse | null> {
  const { data: profileRow } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const role = (profileRow as { role: string } | null)?.role;
  if (role === "admin" || role === "staff") {
    return NextResponse.json(
      { error: "cannot_modify_staff_or_admin" },
      { status: 403 }
    );
  }
  return null;
}
