/**
 * POST /api/admin/customers/[id]/reset-password
 *
 * Müşteriye şifre sıfırlama maili gönder (Supabase auth recovery).
 * Admin click → kullanıcıya magic link mail gider.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  // Email çek
  const { data: user, error: userErr } = await admin.auth.admin.getUserById(id);
  if (userErr || !user?.user?.email) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  const email = user.user.email;

  // Reset link generate et (Supabase auth.admin.generateLink)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";
  const { error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${siteUrl}/auth/reset-password`,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: "link_failed", detail: error.message },
      { status: 500 }
    );
  }

  // generateLink Supabase'in kendi mail'ini tetikler (template kullanılır)
  // Ek olarak customer_notes'a kayıt
  await admin.from("customer_notes").insert([
    {
      user_id: id,
      author_id: auth.user.id,
      author_name: auth.user.email ?? "admin",
      body: `🔄 Şifre sıfırlama maili gönderildi — ${email}`,
      pinned: false,
    },
  ] as never);

  return NextResponse.json({ ok: true, sent_to: email });
}
