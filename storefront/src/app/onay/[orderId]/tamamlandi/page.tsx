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
  hasEtiket: boolean;
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
          items: Array<{ id: string; product?: string }>;
        };
        if (cancelled) return;

        if (data.order.status === "proof_pending") {
          router.replace(`/onay/${orderId}`);
          return;
        }

        setInfo({
          id: data.order.id,
          status: data.order.status,
          total: data.order.total,
          itemCount: data.items.length,
          hasEtiket: data.items.some((i) => i.product === "etiket"),
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
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <Skeleton className="mx-auto mb-4 h-20 w-20 rounded-full" />
          <Skeleton className="mx-auto mb-2 h-8 w-72" />
          <Skeleton className="mx-auto h-4 w-96" />
        </div>
      </main>
    );
  }

  const deliveryDays = info?.hasEtiket ? "10 iş günü" : "5 iş günü";

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
      <div className="mx-auto max-w-2xl px-4 md:px-8 text-center">
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
          Teşekkürler! Üretim Başladı
        </h1>
        <p className="mb-8 text-base text-gri-700">
          {info
            ? `${info.itemCount} ürünün baskı onayını aldık.`
            : "Tüm baskı onayları alındı."}{" "}
          Tasarımların üretim kuyruğuna girdi. Operatör kontrolünden sonra baskıya alınacak,
          kargoya verildiğinde mail ile bilgilendireceğiz.
        </p>

        {/* Üretim aşamaları */}
        <Card className="mb-6 p-6 text-left">
          <h2 className="mb-4 text-base font-semibold text-lacivert">
            Bundan Sonraki Adımlar
          </h2>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yesil text-white text-sm font-bold">
                ✓
              </span>
              <div>
                <div className="font-medium text-lacivert">Onayın Alındı</div>
                <div className="text-sm text-gri-700">
                  Tasarımların kilitlendi, üretim sıramıza girdi
                </div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gri-200 text-gri-500 text-sm">
                2
              </span>
              <div>
                <div className="font-medium text-lacivert">
                  Operatör Kontrolü
                </div>
                <div className="text-sm text-gri-700">
                  Baskı standartlarına uygunluk kontrolü yapılıyor
                </div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gri-200 text-gri-500 text-sm">
                3
              </span>
              <div>
                <div className="font-medium text-lacivert">Üretim</div>
                <div className="text-sm text-gri-700">
                  Baskı + kesim + kalite kontrol
                </div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gri-200 text-gri-500 text-sm">
                4
              </span>
              <div>
                <div className="font-medium text-lacivert">Kargoya Verildi</div>
                <div className="text-sm text-gri-700">
                  Kargoya verildiğinde e-posta ile bilgilendireceğiz. Takip numaranı sipariş detayında görebilirsin.
                </div>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gri-200 text-gri-500 text-sm">
                5
              </span>
              <div>
                <div className="font-medium text-lacivert">Teslimat</div>
                <div className="text-sm text-gri-700">
                  Tahmini teslimat: {deliveryDays}
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
            Sipariş Takibimi Aç
          </Button>
          <Button href="/etiket" variant="secondary" size="md">
            Yeni Sipariş Ver
          </Button>
        </div>

        <p className="mt-8 text-sm text-gri-700">
          Sorun yaşadıysan{" "}
          <a
            href="mailto:info@pimetiket.com"
            className="text-pim-mercan font-semibold hover:underline"
          >
            info@pimetiket.com
          </a>{" "}
          veya sağ alt köşedeki{" "}
          <span className="font-semibold text-pim-mercan">Pim</span>
          &apos;e sorabilirsin.
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
