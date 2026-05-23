/**
 * Pim Etiket — /partner (Sefa 23 May v68 — Partner P1 placeholder)
 *
 * Dashboard ana sayfa. P1'de minimal karşılama; P2'de istatistik kartları
 * (kaç sipariş alındı / onaylandı / iptal / revize), P4-P5'te aksiyon listesi.
 *
 * Auth: middleware /partner/* için role='partner' zorunlu kıldı. Bu sayfa
 * server component, role çift kontrolü gereksiz.
 */

import { getCurrentUserRole } from "@/lib/supabase/role";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Eyebrow } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PartnerDashboardPage() {
  const { userId, role } = await getCurrentUserRole();
  if (!userId || role !== "partner") {
    redirect("/partner/giris");
  }

  // Partner bilgisini çek (P2'de istatistik buraya genişler)
  const admin = createAdminClient();
  const { data: contactRow } = await admin
    .from("partner_contacts")
    .select("id, partner_id, name, role, last_login_at")
    .eq("user_id", userId)
    .maybeSingle();
  type ContactRow = {
    id: string;
    partner_id: string;
    name: string;
    role: string;
    last_login_at: string | null;
  };
  const contact = contactRow as ContactRow | null;

  let partnerName = "Üretim Partneri";
  if (contact) {
    const { data: partnerRow } = await admin
      .from("fason_partners")
      .select("name")
      .eq("id", contact.partner_id)
      .maybeSingle();
    partnerName = (partnerRow as { name?: string } | null)?.name ?? partnerName;
  }

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-4xl">
        <Eyebrow>PARTNER PANELİ</Eyebrow>
        <h1 className="mt-2 text-3xl font-bold text-lacivert">
          Hoş geldin, {contact?.name ?? "Partner"}
        </h1>
        <p className="mt-1 text-sm text-gri-700">
          <strong>{partnerName}</strong>
          {contact?.role
            ? ` · ${contact.role === "owner" ? "Sahip" : contact.role === "operator" ? "Operatör" : "Muhasebe"}`
            : ""}
        </p>

        {/* P2 placeholder — istatistik kartları */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Bekleyen onay", value: "—", hint: "P2'de gelecek" },
            { label: "Bu ay tamamlanan", value: "—", hint: "P2'de gelecek" },
            { label: "Reddedilen", value: "—", hint: "P2'de gelecek" },
            { label: "Revize edilen", value: "—", hint: "P2'de gelecek" },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-gri-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs text-gri-700">{card.label}</p>
              <p className="mt-1 text-3xl font-bold text-lacivert">
                {card.value}
              </p>
              <p className="mt-2 text-[11px] text-gri-500">{card.hint}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-pim-mercan/30 bg-pim-mercan-tint/20 p-6">
          <h2 className="text-base font-semibold text-lacivert">
            Partner Paneli geliştirme aşamasında
          </h2>
          <p className="mt-2 text-sm text-gri-700">
            Bu sayfa şu an minimal halinde. Yakında:
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-gri-700">
            <li>Sana atanan siparişlerin listesi</li>
            <li>Tasarım inceleme + Onayla / Red / Revize</li>
            <li>Aylık üretim istatistiğin</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
