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
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail } from "@/lib/auth-user-lookup";
import type { Enums } from "@/lib/supabase/types";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  partner_id: z.string().uuid(),
});

export async function POST(req: Request) {
  // Auth — impersonation yüksek yetki gerektirir (view-only staff engellenir)
  const auth = await assertPermission("staff", "update");
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
  let priorRole: string | null = null;
  if (!userId) {
    // Sefa 23 May v68 (P1.6): listUsers paging fix — RPC ile email lookup
    const existingUserId = await findAuthUserIdByEmail(admin, email);

    if (existingUserId) {
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", existingUserId)
        .maybeSingle();
      priorRole = (existingProfile as { role?: string } | null)?.role ?? null;

      if (priorRole === "customer") {
        return NextResponse.json(
          {
            error: "role_conflict",
            detail:
              "Bu email müşteri hesabıyla kayıtlı — partner impersonation yapılamaz.",
          },
          { status: 409 }
        );
      }
      if (priorRole === "admin" || priorRole === "staff") {
        return NextResponse.json(
          { error: "role_conflict_privileged" },
          { status: 409 }
        );
      }

      userId = existingUserId;
    } else {
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
        console.error("[admin/impersonate/partner] createUser error:", createErr);
        return NextResponse.json(
          { error: "auth_user_create_failed", detail: createErr?.message },
          { status: 500 }
        );
      }
      userId = created.user.id;
    }
    await admin
      .from("partner_contacts")
      .update({ user_id: userId })
      .eq("id", primary.id);
  } else if (userId) {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    priorRole = (existingProfile as { role?: string } | null)?.role ?? null;

    if (priorRole === "customer") {
      return NextResponse.json(
        {
          error: "role_conflict",
          detail:
            "Bu email müşteri hesabıyla kayıtlı — partner impersonation yapılamaz.",
        },
        { status: 409 }
      );
    }
    if (priorRole === "admin" || priorRole === "staff") {
      return NextResponse.json(
        { error: "role_conflict_privileged" },
        { status: 409 }
      );
    }
  }

  // 4) profiles.role = 'partner' ensure (orphan veya zaten partner)
  if (priorRole !== "partner") {
    await admin
      .from("profiles")
      .upsert({ id: userId, role: "partner" }, { onConflict: "id" });
  }

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

  const { error: auditErr } = await admin.from("audit_log").insert([
    {
      actor_id: auth.user.id,
      actor_email: auth.user.email,
      actor_role: "admin",
      action: "admin.impersonate_partner" as Enums<"audit_action">,
      target_type: "fason_partner",
      target_id: partnerId,
      summary: `Partner impersonation: ${partner.name} (${email})`,
      detail: {
        partner_id: partnerId,
        partner_name: partner.name,
        contact_email: email,
        contact_role: primary.role,
        impersonated_user_id: userId,
        prior_role: priorRole,
      },
    },
  ]);
  if (auditErr) {
    console.error("[admin/impersonate/partner] audit insert error:", auditErr);
    return NextResponse.json({ error: "audit_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    url: linkData.properties.action_link,
    partner: { id: partner.id, name: partner.name },
    contact: { email, name: primary.name, role: primary.role },
    incognitoRequired: true,
    warning:
      "ZORUNLU: Magic-link'i gizli/incognito pencerede açın. Aynı tarayıcıda açarsanız admin oturumunuz partner oturumuna dönüşür; işlem bitince /giris üzerinden admin hesabınızla tekrar giriş yapın.",
    priorRole,
  });
}
