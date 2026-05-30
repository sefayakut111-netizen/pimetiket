"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Eyebrow, Skeleton, useToast } from "@/components/ui";

interface PaymentDetail {
  id: string;
  orderId: string;
  action: string;
  amount: number;
  status: string;
  cardMasked: string | null;
  pspTransactionId: string | null;
  pspProvider: string;
  createdAt: string;
  completedAt: string | null;
  failureReason: string | null;
  customerEmail: string | null;
  customerName: string | null;
  orderTotal: number | null;
  pspRaw: Record<string, unknown> | null;
}

interface RelatedPayment {
  id: string;
  action: string;
  amount: number;
  status: string;
  createdAt: string;
  pspTransactionId: string | null;
}

const fmt = (n: number) =>
  Math.round(n).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });

export default function AdminOdemeDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const toast = useToast();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [related, setRelated] = useState<RelatedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payments/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      const json = (await res.json()) as {
        payment?: PaymentDetail;
        relatedPayments?: RelatedPayment[];
      };
      setPayment(json.payment ?? null);
      setRelated(json.relatedPayments ?? []);
    } catch {
      toast.error("Ödeme detayı yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const startRefund = async () => {
    if (!payment || refunding) return;
    const reason = prompt("İade gerekçesi (opsiyonel):");
    if (reason === null) return;
    setRefunding(true);
    try {
      const res = await fetch("/api/admin/payments/refund", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          reason: reason || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "İade başarısız");
        return;
      }
      toast.success("İade başlatıldı");
      void load();
    } catch {
      toast.error("İade başarısız");
    } finally {
      setRefunding(false);
    }
  };

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-[900px] px-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  if (!payment) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-[900px] px-6">
          <p className="text-gri-700">Ödeme kaydı bulunamadı.</p>
          <Button variant="secondary" href="/admin/odemeler" className="mt-4">
            Listeye dön
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[900px] px-6">
        <Eyebrow>Yönetim</Eyebrow>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-lacivert">Ödeme detayı</h1>
          <span className="rounded-full bg-gri-100 px-2 py-0.5 text-xs">
            {payment.status} / {payment.action}
          </span>
        </div>

        <div className="mt-4">
          <Link href="/admin/odemeler" className="text-sm text-pim-mercan hover:underline">
            ← Ödemeler listesi
          </Link>
        </div>

        <Card padding="p-6" className="mt-6">
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <Detail label="Tutar" value={fmt(payment.amount)} />
            <Detail label="Sipariş" value={payment.orderId} href={`/admin/siparisler/${payment.orderId}`} />
            <Detail label="Müşteri" value={payment.customerName ?? "—"} />
            <Detail label="E-posta" value={payment.customerEmail ?? "—"} />
            <Detail label="PayTR ref" value={payment.pspTransactionId ?? "—"} />
            <Detail label="Kart" value={payment.cardMasked ?? "—"} />
            <Detail label="PSP" value={payment.pspProvider} />
            <Detail
              label="Oluşturulma"
              value={new Date(payment.createdAt).toLocaleString("tr-TR")}
            />
            <Detail
              label="Tamamlanma"
              value={
                payment.completedAt
                  ? new Date(payment.completedAt).toLocaleString("tr-TR")
                  : "—"
              }
            />
            <Detail label="Sipariş toplamı" value={payment.orderTotal != null ? fmt(payment.orderTotal) : "—"} />
            <Detail label="Hata" value={payment.failureReason ?? "—"} />
          </dl>

          {payment.action === "charge" && payment.status === "success" && (
            <Button
              variant="primary"
              className="mt-6"
              disabled={refunding}
              onClick={() => void startRefund()}
            >
              {refunding ? "İade başlatılıyor…" : "İade başlat"}
            </Button>
          )}
        </Card>

        {payment.pspRaw && Object.keys(payment.pspRaw).length > 0 && (
          <Card padding="p-6" className="mt-6">
            <h2 className="text-lg font-semibold text-lacivert">PayTR ham yanıt</h2>
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-gri-100 p-3 text-xs">
              {JSON.stringify(payment.pspRaw, null, 2)}
            </pre>
          </Card>
        )}

        {related.length > 1 && (
          <Card padding="p-0" className="mt-6 overflow-hidden">
            <div className="border-b border-gri-200 px-4 py-3 text-sm font-semibold text-lacivert">
              Aynı siparişteki diğer ödemeler
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-gri-100 text-xs uppercase text-gri-700">
                  <tr>
                    <th className="px-4 py-3">Tarih</th>
                    <th className="px-4 py-3">İşlem</th>
                    <th className="px-4 py-3">Tutar</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">Detay</th>
                  </tr>
                </thead>
                <tbody>
                  {related.map((r) => (
                    <tr key={r.id} className="border-t border-gri-200">
                      <td className="px-4 py-3 text-xs">
                        {new Date(r.createdAt).toLocaleString("tr-TR")}
                      </td>
                      <td className="px-4 py-3">{r.action}</td>
                      <td className="px-4 py-3 font-semibold">{fmt(r.amount)}</td>
                      <td className="px-4 py-3">{r.status}</td>
                      <td className="px-4 py-3">
                        {r.id === payment.id ? (
                          <span className="text-xs text-gri-500">Bu kayıt</span>
                        ) : (
                          <Link
                            href={`/admin/odemeler/${r.id}`}
                            className="text-pim-mercan hover:underline"
                          >
                            Aç
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}

function Detail({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-gri-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-lacivert">
        {href ? (
          <Link href={href} className="text-pim-mercan hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
