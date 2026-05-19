/**
 * Pim Etiket — Baskı Onay Tamamlandı (Teşekkür) Sayfası
 * /onay/[orderId]/tamamlandi
 *
 * Sefa 19 May v68 (Migration 059):
 * fn_finalize_proof RPC orders.status='proof_approved' yaptıktan sonra
 * müşteri buraya yönlendirilir. Üretim aşamaları + tahmini teslim
 * gösterilir. /siparis/[orderId] sayfasına link verilir.
 */

"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Skeleton } from "@/components/ui";

interface OrderInfo {
  id: string;
  status: string;
  total: number;
  itemCount: number;
  estimatedDelivery?: string | null;
}

export default function ProofCompletedPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const router = useRouter();

  const [info, setInfo] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/proof`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          order: { id: string; status: string; total: number };
          items: Array<{ id: string }>;
        };
        if (cancelled) return;

        // Sadece proof_approved (ve sonrası) durumlarda göster
        if (data.order.status === "proof_pending") {
          router.replace(`/onay/${orderId}`);
          return;
        }

        setInfo({
          id: data.order.id,
          status: data.order.status,
          total: data.order.total,
          itemCount: data.items.length,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, router]);

  if (loading) {
    return (
      <main className="container py-12">
        <Skeleton className="mx-auto mb-4 h-20 w-20 rounded-full" />
        <Skeleton className="mx-auto mb-2 h-8 w-72" />
        <Skeleton className="mx-auto h-4 w-96" />
      </main>
    );
  }

  return (
    <main className="container py-12">
      <div className="mx-auto max-w-2xl text-center">
        {/* Animasyonlu yeşil tik */}
        <div
          className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-yesil text-white"
          style={{
            animation: "scaleIn 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        <h1 className="mb-3 text-3xl font-bold text-lacivert">
          Teşekkürler! Üretim başladı 🎉
        </h1>
        <p className="mb-8 text-base text-gri-700">
          {info
            ? `${info.itemCount} ürünün baskı önizlemesini onayladın.`
            : "Tüm baskı önizlemeleri onaylandı."}{" "}
          Tasarımların artık matbaa hattına aktarıldı. En geç 2 iş günü
          içinde kargoya veriyoruz.
        </p>

        {/* Üretim aşamaları */}
        <Card className="mb-6 p-6 text-left">
          <h2 className="mb-4 text-base font-semibold text-lacivert">
            📦 Bundan sonraki adımlar
          </h2>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yesil text-white text-sm">
                ✓
              </span>
              <div>
                <div className="font-medium text-lacivert">Onayın alındı</div>
                <div className="text-sm text-gri-700">
                  Şimdi · Tasarımların kilitlendi, üretim sıramıza girdi
                </div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gri-100 text-gri-700 text-sm">
                ○
              </span>
              <div>
                <div className="font-medium text-lacivert">
                  Operatör son göz kontrolü
                </div>
                <div className="text-sm text-gri-700">
                  1-2 saat · Matbaa standartlarına uygun mu son bir bak
                </div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gri-100 text-gri-700 text-sm">
                ○
              </span>
              <div>
                <div className="font-medium text-lacivert">Üretim hattı</div>
                <div className="text-sm text-gri-700">
                  1-2 iş günü · Baskı + kesim + kalite kontrol
                </div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gri-100 text-gri-700 text-sm">
                ○
              </span>
              <div>
                <div className="font-medium text-lacivert">Kargoya verildi</div>
                <div className="text-sm text-gri-700">
                  Mail bildirimi geleceğin gün · Yurtiçi Kargo takip linki
                </div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gri-100 text-gri-700 text-sm">
                ○
              </span>
              <div>
                <div className="font-medium text-lacivert">Teslimat</div>
                <div className="text-sm text-gri-700">
                  3-5 iş günü · Adresinde
                </div>
              </div>
            </li>
          </ol>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            href={`/siparis/${orderId}`}
            variant="primary"
            size="md"
          >
            Sipariş takibimi aç
          </Button>
          <Button href="/etiket" variant="secondary" size="md">
            Yeni sipariş ver
          </Button>
        </div>

        <p className="mt-8 text-sm text-gri-700">
          Sorun yaşadıysan{" "}
          <a
            href="mailto:info@pimetiket.com"
            className="text-pim-mercan underline"
          >
            info@pimetiket.com
          </a>{" "}
          veya{" "}
          <Link href="/iletisim" className="text-pim-mercan underline">
            Pim sohbet
          </Link>{" "}
          asistanından ulaşabilirsin.
        </p>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </main>
  );
}
