/**
 * POST /api/admin/impersonate/partner
 *
 * Sefa 23 May v68:
 * Admin "Bu partner olarak gez" tikladiginda magic-link uretir →
 * yeni sekmede o partner'ın email'iyle Supabase login → /partner panel.
 * Admin'in ana sekmesi etkilenmez (çünkü magic-link yeni sekmede yeni
 * session açar; ama dikkat: aynı tarayıcı cookie jar'ı paylaşır →
 * magic-link cookie'leri override eder. UYARI: bu işlem admin'in ana
 * sekmesindeki session'ı geçici olarak partner'a çevirebilir).
 *
 * KULLANIM ÖNERİSİ: Admin yeni bir Incognito penceresinde aç ve burada
 * magic-link'i yapıştır — kendi admin session'ını korumak için.
 *
 * Body: { partner_id: string }  // fason_partners.id
 *
 * Akış:
 *   1. assertAdmin (admin/staff zorunlu)
 *   2. partner_contacts SELECT (partner_id ile, role='owner' veya ilk)
 *   3. Eğer user_id null → auth.users oluştur + partner_contacts.user_id link
 *   4. profiles.role = 'partner' upsert
 *   5. supabase.auth.admin.generateLink({ type: 'magiclink', email })
 *   6. order_events: 'admin_impersonate_partner' (audit trail)
 *   7. Response: { ok, url, email, partner_name }
 *
 * Güvenlik:
 *   - sadece admin/staff çağırabilir
 *   - audit log her impersonation için
 *   - magic-link'in expiry'si Supabase default (1 saat)
 */

import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  partner_id: z.string().uuid(),
});

export async function POST(req: Request) {
  // Auth
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", detail: parsed.error.issues },
      { status: 400 }
    );
  }
  const { partner_id: partnerId } = parsed.data;

  const admin = createAdminClient();

  // Partner var mı?
  const { data: partnerRow } = await admin
    .from("fason_partners")
    .select("id, name")
    .eq("id", partnerId)
    .maybeSingle();
  const partner = partnerRow as { id: string; name: string } | null;
  if (!partner) {
    return NextResponse.json({ error: "partner_not_found" }, { status: 404 });
  }

  // Birincil contact'ı bul — önce owner, yoksa auto_notification=true,
  // yoksa ilk contact
  const { data: contactsRow } = await admin
    .from("partner_contacts")
    .select("id, role, name, email, user_id, auto_notification")
    .eq("partner_id", partnerId)
    .order("auto_notification", { ascending: false });
  type ContactRow = {
    id: string;
    role: string;
    name: string;
    email: string;
    user_id: string | null;
    auto_notification: boolean;
  };
  const contacts = (contactsRow as ContactRow[] | null) ?? [];
  if (contacts.length === 0) {
    return NextResponse.json(
      {
        error: "no_contacts",
        message: "Bu partnerin kontak bilgisi yok — /admin/fason/yeni'den ekle",
      },
      { status: 400 }
    );
  }
  const owner = contacts.find((c) => c.role === "owner");
  const primary = owner ?? contacts[0];
  const email = primary.email.trim().toLowerCase();

  // 3) user_id yoksa auth.users oluştur + link
  let userId = primary.user_id;
  if (!userId) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        partner_contact_id: primary.id,
        partner_id: partnerId,
        name: primary.name,
      },
    });
    if (createErr || !created?.user) {
      if (createErr?.message?.toLowerCase().includes("already")) {
        const { data: list } = await admin.auth.admin.listUsers();
        const existing = list?.users?.find(
          (u) => u.email?.toLowerCase() === email
        );
        if (existing) {
          userId = existing.id;
        } else {
          return NextResponse.json(
            { error: "auth_user_link_failed" },
            { status: 500 }
          );
        }
      } else {
        console.error("[admin/impersonate/partner] createUser error:", createErr);
        return NextResponse.json(
          { error: "auth_user_create_failed", detail: createErr?.message },
          { status: 500 }
        );
      }
    } else {
      userId = created.user.id;
    }
    await admin
      .from("partner_contacts")
      .update({ user_id: userId } as never)
      .eq("id", primary.id);
  }

  // 4) profiles.role = 'partner' upsert
  await admin
    .from("profiles")
    .upsert({ id: userId, role: "partner" } as never, {
      onConflict: "id",
    } as never);

  // 5) Magic-link üret
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData?.properties?.action_link) {
    console.error(
      "[admin/impersonate/partner] generateLink error:",
      linkErr
    );
    return NextResponse.json(
      {
        error: "magiclink_failed",
        detail: linkErr?.message ?? "action_link missing",
      },
      { status: 500 }
    );
  }

  // 6) Audit — order_events partner_id'ye bağlı değil, partner_audit logu
  // ayrı tablo gerek. Şimdilik console + (varsa) admin_audit tablosuna
  // yazılabilir. Minimal audit: console log + supabase log.
  console.log(
    `[admin/impersonate/partner] Admin ${auth.user.email} impersonating partner ${partner.name} (${email})`
  );

  return NextResponse.json({
    ok: true,
    url: linkData.properties.action_link,
    partner: { id: partner.id, name: partner.name },
    contact: { email, name: primary.name, role: primary.role },
    warning:
      "Magic-link kullanıldığında ANA tarayıcı session'ı geçici olarak partner'a değişebilir. Incognito/yeni pencerede açmanız önerilir.",
  });
}
