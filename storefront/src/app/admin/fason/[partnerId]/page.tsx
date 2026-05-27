"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Button, Card, Skeleton, useToast } from "@/components/ui";
import {
  CAPABILITY_LABEL,
  capabilityChipClassName,
  type FasonPartner,
} from "@/components/admin/fason/fason-types";
import { PartnerDetailView } from "@/components/admin/fason/partner-detail-view";
import { useSetAdminPathLabel } from "@/hooks/useAdminPathLabel";

export default function AdminFasonPartnerDetailPage() {
  const params = useParams();
  const partnerId = decodeURIComponent(String(params.partnerId ?? ""));
  const toast = useToast();

  const [partner, setPartner] = useState<FasonPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingContract, setMarkingContract] = useState(false);

  useSetAdminPathLabel(partnerId, partner?.name);

  const loadPartner = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/fason/partners", { cache: "no-store" });
      const json = (await res.json()) as {
        partners?: FasonPartner[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "list_failed");
      const found = (json.partners ?? []).find((p) => p.id === partnerId) ?? null;
      if (!found) {
        setError("Partner bulunamadi");
        setPartner(null);
        return;
      }
      setPartner(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yukleme hatasi");
      setPartner(null);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    void loadPartner();
  }, [loadPartner]);

  const handleSignContract = async () => {
    if (!partner) return;
    if (
      !confirm(
        `${partner.name} icin sozlesme imzalandi olarak isaretlensin mi?`
      )
    ) {
      return;
    }
    setMarkingContract(true);
    try {
      const res = await fetch(`/api/admin/fason/partners/${partner.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractSignedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Sozlesme kaydedilemedi");
        return;
      }
      toast.success("Sozlesme imzalandi olarak isaretlendi");
      void loadPartner();
    } catch {
      toast.error("Sozlesme kaydedilemedi (ag hatasi)");
    } finally {
      setMarkingContract(false);
    }
  };

  const scorePct =
    partner?.cached_score == null
      ? null
      : Math.round(partner.cached_score * 100);

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="mb-6">
          <Link
            href="/admin/fason"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gri-700 hover:text-pim-mercan mb-4"
          >
            ← Uretim partnerleri
          </Link>

          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          )}

          {!loading && error && (
            <Card padding="p-6" className="text-center">
              <p className="text-gri-700">{error}</p>
              <div className="mt-4 flex gap-3 justify-center">
                <Button variant="secondary" href="/admin/fason">
                  Listeye don
                </Button>
              </div>
            </Card>
          )}

          {!loading && partner && (
            <>
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div className="min-w-0">
                  <h1 className="text-[28px] md:text-[32px] font-semibold tracking-tight">
                    {partner.name}
                    {partner.city && (
                      <span className="text-[15px] font-normal text-gri-700 ml-2">
                        · {partner.city}
                      </span>
                    )}
                  </h1>
                  <p className="mt-1 text-[14px] text-gri-700">
                    {partner.contact_email}
                  </p>
                  {partner.capabilities && partner.capabilities.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-3">
                      {partner.capabilities.map((c) => (
                        <span
                          key={c.id}
                          className={capabilityChipClassName(
                            c.capability_type,
                            c.capability_value
                          )}
                        >
                          {CAPABILITY_LABEL[c.capability_value] ??
                            c.capability_value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {scorePct != null && (
                    <span className="inline-flex items-center h-[28px] px-3 rounded-full bg-gri-100 text-[12px] font-semibold tabular-nums">
                      Skor: {scorePct}/100
                    </span>
                  )}
                  <Button
                    variant="secondary"
                    href={`/admin/fason/yeni?edit=${encodeURIComponent(partner.id)}`}
                  >
                    <Icon.Edit size={14} /> Duzenle
                  </Button>
                </div>
              </div>

              {!partner.contract_signed_at ? (
                <div className="rounded-lg bg-kirmizi-soft/20 border border-kirmizi/20 p-3 flex items-center justify-between gap-4 flex-wrap mb-6">
                  <div>
                    <span className="text-sm font-semibold text-kirmizi">
                      Sozlesme imzalanmamis
                    </span>
                    <p className="text-xs text-gri-600 mt-0.5">
                      KVKK m.12 geregi siparis atanamaz.
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={markingContract}
                      onClick={() => void handleSignContract()}
                    >
                      {markingContract
                        ? "Kaydediliyor..."
                        : "Imzalandi olarak isaretle"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      href={`mailto:${partner.contact_email}?subject=${encodeURIComponent("KVKK Sozlesmesi")}`}
                    >
                      Sozlesme talep et
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-yesil-soft/20 border border-yesil/20 p-2 text-sm text-yesil mb-6">
                  Sozlesme imzali —{" "}
                  {new Date(partner.contract_signed_at).toLocaleDateString(
                    "tr-TR"
                  )}
                </div>
              )}

              <PartnerDetailView
                partner={partner}
                onPartnerUpdated={(updated) => setPartner(updated)}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
