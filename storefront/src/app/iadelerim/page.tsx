/**
 * Pim Etiket — /iadelerim
 *
 * Müşterinin tüm iade taleplerini listeler.
 * Status: pending / approved / rejected / refunded.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listReturns,
  RETURN_REASON_LABEL,
  STATUS_LABEL,
  type ReturnRequest,
  type ReturnStatus,
} from "@/lib/customer-return";

const STATUS_META: Record<
  ReturnStatus,
  { color: string; bg: string }
> = {
  pending: { color: "text-[#7A560A]", bg: "bg-sari-soft" },
  approved: { color: "text-yesil", bg: "bg-yesil-soft" },
  rejected: { color: "text-kirmizi", bg: "bg-kirmizi/10" },
  refunded: { color: "text-yesil", bg: "bg-yesil-soft" },
};

export default function IadelerimPage() {
  const [items, setItems] = useState<ReturnRequest[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const refresh = () => setItems(listReturns());
    refresh();
    setHydrated(true);
    window.addEventListener("pim_customer_returns_updated", refresh);
    return () =>
      window.removeEventListener("pim_customer_returns_updated", refresh);
  }, []);

  if (!hydrated) {
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[480px] px-6 text-center text-gri-500">
          Yükleniyor…
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1080px] px-6">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 mb-7 flex-wrap">
          <div>
            <Eyebrow>Hesabım</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              İade taleplerim
            </h1>
            <p className="mt-2 text-base text-gri-700">
              {items.length === 0
                ? "Henüz iade talebin yok."
                : `${items.length} iade talebin var.`}
            </p>
          </div>
          <Button variant="primary" size="lg" href="/iade-talep">
            <Icon.Plus size={16} /> Yeni iade talebi
          </Button>
        </div>

        {items.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="happy" size={140} />
            <h3 className="mt-4 text-xl font-semibold">
              İyiyiz işler iyi gidiyor 🎉
            </h3>
            <p className="mt-3 text-base text-gri-700 leading-relaxed max-w-[480px] mx-auto">
              Henüz iade talebin yok. Üretim hatası, kargo hasarı veya yanlış
              ürün durumunda buradan talep oluşturabilirsin.
            </p>
            <Button
              variant="secondary"
              size="lg"
              href="/iade-talep"
              className="mt-6"
            >
              <Icon.Plus size={16} /> Yeni iade talebi
            </Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((r) => {
              const meta = STATUS_META[r.status];
              const date = new Date(r.createdAtIso).toLocaleDateString(
                "tr-TR",
                { day: "numeric", month: "long", year: "numeric" }
              );
              return (
                <Card key={r.id} padding="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                        <span className="font-mono text-[12px] text-gri-700">
                          {r.id.slice(0, 8)}…
                        </span>
                        <span className="text-[12px] text-gri-500">·</span>
                        <Link
                          href={`/siparis/${r.orderId}`}
                          className="font-mono text-[12px] text-pim-mercan hover:underline"
                        >
                          {r.orderId}
                        </Link>
                        <span
                          className={cn(
                            "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold",
                            meta.bg,
                            meta.color
                          )}
                        >
                          {STATUS_LABEL[r.status]}
                        </span>
                      </div>
                      <div className="font-semibold text-base mb-0.5">
                        {RETURN_REASON_LABEL[r.reason]}
                      </div>
                      <div className="text-[13px] text-gri-700 mt-1 line-clamp-2 leading-relaxed">
                        {r.description}
                      </div>
                      {r.adminNote && (
                        <div className="mt-2 px-3 py-2 rounded-lg bg-gri-50 text-[12.5px] text-gri-700 leading-relaxed">
                          <strong className="text-lacivert">Pim notu: </strong>
                          {r.adminNote}
                        </div>
                      )}
                      <div className="text-[11.5px] text-gri-500 mt-2 tabular-nums">
                        Açıldı: {date}
                        {r.refundAmount && (
                          <>
                            {" · "}
                            <span className="text-yesil font-semibold">
                              İade: {r.refundAmount.toLocaleString("tr-TR")} TL
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
