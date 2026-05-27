/**
 * Pim Etiket — /admin/kargo/[orderId]
 *
 * Tek siparis kargo detayi: takip, durum, son event.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, Eyebrow, Skeleton } from "@/components/ui";
import type { AdminShipmentRow } from "@/app/api/admin/shipments/route";

function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return "—";
  const opts: Intl.DateTimeFormatOptions = withTime
    ? {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Istanbul",
      }
    : {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Istanbul",
      };
  return new Date(iso).toLocaleString("tr-TR", opts);
}

export default function AdminKargoDetailPage() {
  const params = useParams();
  const orderId = decodeURIComponent(String(params.orderId ?? ""));

  const [row, setRow] = useState<AdminShipmentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const qs = new URLSearchParams({
        status: "all",
        dateRange: "all",
        limit: "5",
        search: orderId,
      });
      const res = await fetch(`/api/admin/shipments?${qs.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const json = (await res.json()) as { shipments?: AdminShipmentRow[] };
      const match =
        json.shipments?.find((s) => s.order_id === orderId) ??
        json.shipments?.[0] ??
        null;
      if (!match) {
        setNotFound(true);
        setRow(null);
        return;
      }
      setRow(match);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-[880px] mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/kargo"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gri-700 hover:text-pim-mercan"
        >
          ← Kargo listesi
        </Link>
      </div>

      <Eyebrow>Kargo detay</Eyebrow>
      <h1 className="text-[28px] font-semibold tracking-tight mt-1 font-mono">
        {orderId}
      </h1>

      {loading && (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      )}

      {!loading && notFound && (
        <Card padding="p-6" className="mt-6 text-center">
          <p className="text-gri-700">
            Bu siparis icin kargo kaydi bulunamadi.
          </p>
          <div className="mt-4 flex gap-3 justify-center flex-wrap">
            <Button variant="secondary" href="/admin/kargo">
              Listeye don
            </Button>
            <Button variant="primary" href={`/admin/siparisler?search=${encodeURIComponent(orderId)}`}>
              Siparislerde ara
            </Button>
          </div>
        </Card>
      )}

      {!loading && row && (
        <div className="mt-6 space-y-4">
          <Card padding="p-6">
            <div className="grid gap-4 sm:grid-cols-2 text-[13px]">
              <div>
                <div className="text-gri-500 text-[11px] uppercase tracking-wide">
                  Musteri
                </div>
                <div className="font-semibold text-lacivert mt-0.5">
                  {row.customer_name ?? "—"}
                </div>
                <div className="text-gri-600">{row.customer_email ?? "—"}</div>
              </div>
              <div>
                <div className="text-gri-500 text-[11px] uppercase tracking-wide">
                  Durum
                </div>
                <div className="font-semibold text-lacivert mt-0.5">
                  {row.tracking_status ?? row.assignment_status ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-gri-500 text-[11px] uppercase tracking-wide">
                  Kargo firmasi
                </div>
                <div className="font-semibold mt-0.5">
                  {row.tracking_company ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-gri-500 text-[11px] uppercase tracking-wide">
                  Takip no
                </div>
                <div className="font-mono font-semibold mt-0.5">
                  {row.tracking_number ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-gri-500 text-[11px] uppercase tracking-wide">
                  Kargoya verildi
                </div>
                <div className="mt-0.5">{formatDate(row.shipped_at, true)}</div>
              </div>
              <div>
                <div className="text-gri-500 text-[11px] uppercase tracking-wide">
                  Teslim
                </div>
                <div className="mt-0.5">
                  {formatDate(row.tracking_delivered_at, true)}
                </div>
              </div>
            </div>

            {row.last_event_description && (
              <div className="mt-5 pt-4 border-t border-gri-200">
                <div className="text-gri-500 text-[11px] uppercase tracking-wide">
                  Son hareket
                </div>
                <p className="text-[13px] text-gri-800 mt-1">
                  {row.last_event_description}
                  {row.last_event_location
                    ? ` · ${row.last_event_location}`
                    : ""}
                </p>
                <p className="text-[12px] text-gri-500 mt-1">
                  {formatDate(row.last_event_time, true)}
                </p>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              {row.tracking_url && (
                <Button variant="primary" size="sm" href={row.tracking_url}>
                  Kargo takip
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                href={`/admin/siparisler?search=${encodeURIComponent(orderId)}`}
              >
                Siparis detayi
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                Yenile
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
