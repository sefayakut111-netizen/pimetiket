/**
 * Partner auth context — gerçek partner veya admin arayüz denetimi.
 */

import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PARTNER_PREVIEW_ID_COOKIE,
  parsePartnerPreviewId,
} from "@/lib/partner-preview";
import { VIEW_MODE_COOKIE, parseViewMode } from "@/lib/view-mode";

export interface PartnerAuthContext {
  userId: string;
  /** null = generic UI preview (admin denetimi) */
  partnerId: string | null;
  isPreview: boolean;
  /** Admin ortak arayüz denetimi — belirli partner verisi yok */
  isGenericPreview: boolean;
  previewPartnerName?: string;
}

/**
 * Partner API route'ları için bağlam çözümle.
 * - role=partner → partner_contacts üzerinden kendi verisi
 * - admin/staff + view_mode=partner → generic UI preview (partnerId null)
 */
export async function resolvePartnerContext(): Promise<PartnerAuthContext | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profileRow } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profileRow as { role?: string } | null)?.role;

  if (role === "partner") {
    const { data: contactRow } = await admin
      .from("partner_contacts")
      .select("partner_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const contact = contactRow as { partner_id: string } | null;
    if (!contact) return null;
    return {
      userId: user.id,
      partnerId: contact.partner_id,
      isPreview: false,
      isGenericPreview: false,
    };
  }

  if (role === "admin" || role === "staff") {
    const cookieStore = await cookies();
    const viewMode = parseViewMode(cookieStore.get(VIEW_MODE_COOKIE)?.value);
    if (viewMode !== "partner") return null;

    // Legacy: eski preview cookie varsa o partner verisiyle devam (opsiyonel)
    const previewId = parsePartnerPreviewId(
      cookieStore.get(PARTNER_PREVIEW_ID_COOKIE)?.value
    );
    if (previewId) {
      const { data: partnerRow } = await admin
        .from("fason_partners")
        .select("id, name")
        .eq("id", previewId)
        .maybeSingle();
      const partner = partnerRow as { id: string; name: string } | null;
      if (partner) {
        return {
          userId: user.id,
          partnerId: partner.id,
          isPreview: true,
          isGenericPreview: false,
          previewPartnerName: partner.name,
        };
      }
    }

    return {
      userId: user.id,
      partnerId: null,
      isPreview: true,
      isGenericPreview: true,
    };
  }

  return null;
}
