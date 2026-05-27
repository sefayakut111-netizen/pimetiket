/**
 * AdminTrackingForm — Admin sipariş detay sayfasına eklenen kargo
 * bilgisi giriş + durum geçmişi bileşeni.
 *
 * Sefa 18 May v68:
 * Admin elle takip numarası girer → Yurtiçi'den ilk poll yapılır →
 * sonuç görüntülenir + müşteriye mail gider (trg_notify_customer_shipped).
 *
 * Kullanım:
 *   <AdminTrackingForm orderId={order.id} />
 */

"use client";

import { useEffect, useState } from "react";
import { Card, Eyebrow, Input, Button, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { StatusDot, type DotColor } from "@/components/admin/ui";
import { cn } from "@/lib/cn";

interface AssignmentInfo {
  id: string;
  tracking_company: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  tracking_status: string | null;
  tracking_last_polled_at: string | null;
  tracking_delivered_at: string | null;
  shipped_at: string | null;
  status: string;
}

interface StatusEvent {
  status: string;
  description: string | null;
  location: string | null;
  event_time: string;
}

const STATUS_LABEL: Record<string, { tr: string; dot: DotColor; color: string }> = {
  created: { tr: "İşleme alındı", dot: "gri", color: "text-gri-700" },
  picked_up: { tr: "Kargo alındı", dot: "mavi", color: "text-mavi-koyu" },
  in_transit: { tr: "Yolda", dot: "mavi", color: "text-mavi-koyu" },
  out_for_delivery: { tr: "Dağıtımda", dot: "sari", color: "text-sari-koyu" },
  delivered: { tr: "Teslim edildi", dot: "yesil", color: "text-yesil-koyu" },
  failed: { tr: "Teslim edilemedi", dot: "kirmizi", color: "text-kirmizi-koyu" },
  returned: { tr: "İade edildi", dot: "mavi", color: "text-mor" },
  cancelled: { tr: "İptal", dot: "kirmizi", color: "text-kirmizi-koyu" },
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

export function AdminTrackingForm({ orderId }: { orderId: string }) {
  const toast = useToast();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<AssignmentInfo | null>(null);
  const [events, setEvents] = useState<StatusEvent[]>([]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/tracking`);
      const data = await res.json();
      setAssignment(data.assignment ?? null);
      setEvents(data.events ?? []);
      if (data.assignment?.tracking_number) {
        setTrackingNumber(data.assignment.tracking_number);
      }
    } catch (e) {
      toast.error(`Yükleme hatası: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trackingNumber.trim()) {
      toast.error("Takip numarası boş olamaz");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrierCode: "yurtici",
          trackingNumber: trackingNumber.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Kayıt başarısız");
        return;
      }
      const poll = data.yurticiPoll;
      if (poll?.dryRun) {
        toast.success(
          `Kaydedildi (DRY_RUN — Yurtiçi API credentials yok, sahte veri)`
        );
      } else if (poll?.success) {
        toast.success(
          `Kaydedildi + Yurtiçi'den ${poll.eventCount} event çekildi (durum: ${poll.currentStatus})`
        );
      } else {
        toast.success(
          `Kaydedildi ama Yurtiçi poll başarısız: ${poll?.error ?? "bilinmeyen"}`
        );
      }
      await fetchData();
    } catch (e) {
      toast.error(`Hata: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function pollNow() {
    if (!assignment?.tracking_number) {
      toast.error("Önce takip numarası gir");
      return;
    }
    setSubmitting(true);
    try {
      // POST aynı tracking number ile yeniden — idempotent upsert + yeni poll
      const res = await fetch(`/api/admin/orders/${orderId}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrierCode: "yurtici",
          trackingNumber: assignment.tracking_number,
        }),
      });
      const data = await res.json();
      const poll = data.yurticiPoll;
      if (poll?.success) {
        toast.success(`Güncellendi (${poll.eventCount} event)`);
      } else if (poll?.dryRun) {
        toast.info("DRY_RUN — gerçek API çağrısı yapılmadı");
      } else {
        toast.error(poll?.error ?? "Poll başarısız");
      }
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-gri-700">Kargo bilgisi yükleniyor...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <Eyebrow>Kargo (Yurtiçi)</Eyebrow>
      <h3 className="mt-1 text-lg font-semibold text-lacivert">
        Kargo Bilgisi
      </h3>

      {/* Mevcut durum */}
      {assignment?.tracking_number ? (
        <div className="mt-3 space-y-2 rounded-lg bg-gri-50 p-3 text-[13px]">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gri-700">Takip no:</span>
            <code className="rounded bg-white px-2 py-0.5 font-mono">
              {assignment.tracking_number}
            </code>
            {assignment.tracking_url && (
              <a
                href={assignment.tracking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-pim-mercan hover:underline"
              >
                Yurtiçi'de aç →
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gri-700">Durum:</span>
            {assignment.tracking_status ? (
              <span
                className={cn(
                  "font-medium",
                  STATUS_LABEL[assignment.tracking_status]?.color ?? "text-gri-700"
                )}
              >
                <StatusDot color={STATUS_LABEL[assignment.tracking_status]?.dot ?? "gri"} className="inline" />{" "}
                {STATUS_LABEL[assignment.tracking_status]?.tr ??
                  assignment.tracking_status}
              </span>
            ) : (
              <span className="text-gri-500">—</span>
            )}
          </div>
          <div className="text-[11.5px] text-gri-500">
            Kargoya verildi: {formatDateTime(assignment.shipped_at)} · Son
            sorgu: {formatDateTime(assignment.tracking_last_polled_at)}
            {assignment.tracking_delivered_at && (
              <>
                {" "}· Teslim:{" "}
                <span className="font-medium text-yesil-koyu">
                  {formatDateTime(assignment.tracking_delivered_at)}
                </span>
              </>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-gri-500">
          Henüz kargo bilgisi girilmemiş. Aşağıdan takip numarası ekleyebilirsin.
        </p>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-[12.5px] font-medium text-lacivert">
            Yurtiçi Kargo Takip Numarası
          </label>
          <div className="flex gap-2">
            <Input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="örn 1234567890"
              disabled={submitting}
            />
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Kaydediliyor..."
                : assignment?.tracking_number
                ? "Güncelle"
                : "Kaydet"}
            </Button>
          </div>
          <p className="mt-1 text-[11.5px] text-gri-500">
            Kayıt sonrası Yurtiçi API'den ilk durum otomatik çekilir + müşteriye
            "kargoya verildi" maili gider.
          </p>
        </div>

        {assignment?.tracking_number && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={pollNow}
            disabled={submitting}
          >
            <Icon.Refresh size={14} className="inline mr-1" />
            Şimdi sorgula (manuel poll)
          </Button>
        )}
      </form>

      {/* Timeline */}
      {events.length > 0 && (
        <div className="mt-6 border-t border-gri-200 pt-4">
          <h4 className="mb-3 text-[13px] font-semibold uppercase text-gri-700">
            Durum Geçmişi ({events.length})
          </h4>
          <ol className="space-y-2">
            {events.map((ev, i) => {
              const meta = STATUS_LABEL[ev.status];
              return (
                <li
                  key={`${ev.status}-${ev.event_time}-${i}`}
                  className="flex gap-3 rounded-lg border border-gri-200 p-2 text-[13px]"
                >
                  <StatusDot color={meta?.dot ?? "gri"} className="mt-1" />
                  <div className="flex-1">
                    <div
                      className={cn(
                        "font-medium",
                        meta?.color ?? "text-lacivert"
                      )}
                    >
                      {meta?.tr ?? ev.status}
                    </div>
                    <div className="text-[12px] text-gri-700">
                      {ev.description ?? "—"}
                      {ev.location && (
                        <span className="text-gri-500">
                          {" "}· {ev.location}
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-gri-500">
                      {formatDateTime(ev.event_time)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Card>
  );
}
