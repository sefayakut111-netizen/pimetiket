"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Eyebrow, Input, Skeleton, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

type StatusFilter = "all" | "success" | "pending" | "failed" | "refunded";

interface PaymentItem {
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

interface Totals {
  revenue: number;
  pending: number;
  refunded: number;
  failed: number;
}

const STATUS_CHIPS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "Tümü" },
  { id: "success", label: "Başarılı" },
  { id: "pending", label: "Bekleyen" },
  { id: "refunded", label: "İade" },
  { id: "failed", label: "Başarısız" },
];

const fmt = (n: number) =>
  Math.round(n).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });

export default function AdminOdemelerPage() {
  const toast = useToast();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<PaymentItem | null>(null);
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/payments?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Yüklenemedi");
      const json = (await res.json()) as {
        payments?: PaymentItem[];
        totals?: Totals;
      };
      setPayments(json.payments ?? []);
      setTotals(json.totals ?? null);
    } catch {
      toast.error("Ödemeler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [status, q, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const startRefund = async () => {
    if (!selected || refunding) return;
    const reason = prompt("İade gerekçesi (opsiyonel):");
    if (reason === null) return;
    setRefunding(true);
    try {
      const res = await fetch("/api/admin/payments/refund", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          paymentId: selected.id,
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
      setSelected(null);
      void load();
    } catch {
      toast.error("İade başarısız");
    } finally {
      setRefunding(false);
    }
  };

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <Eyebrow>Yönetim</Eyebrow>
        <h1 className="mt-2 text-2xl font-semibold text-lacivert">Ödemeler</h1>

        {totals && (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Toplam gelir" value={fmt(totals.revenue)} />
            <Kpi label="Bekleyen" value={fmt(totals.pending)} />
            <Kpi label="İade" value={fmt(totals.refunded)} />
            <Kpi label="Başarısız (adet)" value={String(totals.failed)} />
          </div>
        )}

        <Card padding="p-4" className="mt-6">
          <div className="flex flex-wrap gap-2">
            {STATUS_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setStatus(chip.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition",
                  status === chip.id
                    ? "bg-lacivert text-white"
                    : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Sipariş, müşteri veya PayTR ref ara…"
              className="max-w-md"
            />
            <Button variant="secondary" onClick={() => void load()}>
              Ara
            </Button>
          </div>
        </Card>

        {loading ? (
          <Skeleton className="mt-6 h-64 w-full" />
        ) : (
          <Card padding="p-0" className="mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-gri-100 text-xs uppercase text-gri-700">
                  <tr>
                    <th className="px-4 py-3">Tarih</th>
                    <th className="px-4 py-3">Sipariş</th>
                    <th className="px-4 py-3">Müşteri</th>
                    <th className="px-4 py-3">Tutar</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr
                      key={p.id}
                      className={cn(
                        "cursor-pointer border-t border-gri-200 hover:bg-gri-50",
                        selected?.id === p.id && "bg-pim-mercan-tint/20"
                      )}
                      onClick={() => setSelected(p)}
                    >
                      <td className="px-4 py-3 text-xs text-gri-700">
                        {new Date(p.createdAt).toLocaleString("tr-TR")}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <Link
                          href={`/admin/siparisler/${p.orderId}`}
                          className="text-pim-mercan hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.orderId}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-lacivert">{p.customerName ?? "—"}</div>
                        <div className="text-xs text-gri-500">{p.customerEmail ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold">{fmt(p.amount)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-gri-100 px-2 py-0.5 text-xs">
                          {p.status} / {p.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/admin/siparisler/${p.orderId}`}
                            className="inline-flex h-7 items-center rounded-md px-2 text-xs font-semibold text-pim-mercan hover:bg-pim-mercan-tint/30"
                          >
                            Siparis
                          </Link>
                          {p.pspTransactionId && (
                            <button
                              type="button"
                              className="inline-flex h-7 items-center rounded-md px-2 text-xs font-semibold text-gri-700 hover:bg-gri-100"
                              onClick={() => {
                                void navigator.clipboard.writeText(p.pspTransactionId!);
                                toast.success("Ref kopyalandi");
                              }}
                            >
                              Ref kopyala
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {selected && (
          <Card padding="p-6" className="mt-6">
            <h2 className="text-lg font-semibold text-lacivert">Ödeme detayı</h2>
            <dl className="mt-4 grid gap-2 text-sm md:grid-cols-2">
              <Detail label="PayTR ref" value={selected.pspTransactionId ?? "—"} />
              <Detail label="Kart" value={selected.cardMasked ?? "—"} />
              <Detail label="PSP" value={selected.pspProvider} />
              <Detail label="Durum" value={`${selected.status} (${selected.action})`} />
              <Detail
                label="Hata"
                value={selected.failureReason ?? "—"}
              />
            </dl>
            {selected.action === "charge" && selected.status === "success" && (
              <Button
                variant="primary"
                className="mt-4"
                disabled={refunding}
                onClick={() => void startRefund()}
              >
                {refunding ? "İade başlatılıyor…" : "İade başlat"}
              </Button>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="p-4">
      <p className="text-xs text-gri-700">{label}</p>
      <p className="mt-1 text-xl font-semibold text-lacivert">{value}</p>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-gri-500">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm text-lacivert">{value}</dd>
    </div>
  );
}
