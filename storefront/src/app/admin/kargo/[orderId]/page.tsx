/**
 * Pim Etiket — /admin/kargo/[orderId]
 *
 * Sefa 18 May v68 (kargo paneli detay sayfası):
 *   - Tüm timeline event'leri (kronolojik)
 *   - Manual poll butonu
 *   - Yurtiçi sitesinde aç
 *   - Müşteriye yeniden mail
 *   - Manual override (durum düzelt) modal
 */

"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Card,
  Eyebrow,
  Skeleton,
  Button,
  useToast,
  Modal,
  Input,
} from "@/components/ui";
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

const STATUS_META: Record<
  string,
  { tr: string; emoji: string; color: string; bg: string }
> = {
  created: { tr: "İşleme alındı", emoji: "📝", color: "text-gri-700", bg: "bg-gri-100" },
  picked_up: { tr: "Kargo alındı", emoji: "📦", color: "text-mavi-koyu", bg: "bg-mavi-soft" },
  in_transit: { tr: "Yolda", emoji: "🚚", color: "text-mavi-koyu", bg: "bg-mavi-soft" },
  out_for_delivery: { tr: "Dağıtımda", emoji: "🛵", color: "text-sari-koyu", bg: "bg-sari-soft" },
  delivered: { tr: "Teslim edildi", emoji: "✅", color: "text-yesil-koyu", bg: "bg-yesil-soft" },
  failed: { tr: "Başarısız", emoji: "⚠️", color: "text-kirmizi-koyu", bg: "bg-kirmizi-soft" },
  returned: { tr: "İade edildi", emoji: "↩️", color: "text-mor", bg: "bg-mor/10" },
  cancelled: { tr: "İptal", emoji: "❌", color: "text-kirmizi-koyu", bg: "bg-kirmizi-soft" },
};

const OVERRIDE_STATUSES = [
  "created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
  "returned",
  "cancelled",
] as const;

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

export default function AdminKargoDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<AssignmentInfo | null>(null);
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [polling, setPolling] = useState(false);

  // Override modal
  const [showOverride, setShowOverride] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<string>("in_transit");
  const [overrideDescription, setOverrideDescription] = useState("");
  const [overrideLocation, setOverrideLocation] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/tracking`);
      const data = await res.json();
      setAssignment(data.assignment ?? null);
      setEvents(data.events ?? []);
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

  async function handlePollNow() {
    if (!assignment?.tracking_number) {
      toast.error("Takip numarası yok");
      return;
    }
    setPolling(true);
    try {
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
        toast.success(`Poll tamam: ${poll.eventCount} event`);
      } else if (poll?.dryRun) {
        toast.info("DRY_RUN — gerçek API çağrılmadı");
      } else {
        toast.error(poll?.error ?? "Poll başarısız");
      }
      await fetchData();
    } finally {
      setPolling(false);
    }
  }

  async function handleOverride() {
    if (!overrideStatus || !overrideDescription.trim() || !overrideReason.trim()) {
      toast.error("Status, açıklama ve sebep zorunlu");
      return;
    }
    setOverrideSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/shipments/${orderId}/override`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: overrideStatus,
            description: overrideDescription.trim(),
            location: overrideLocation.trim() || undefined,
            reason: overrideReason.trim(),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Override başarısız");
        return;
      }
      toast.success(`Durum ${overrideStatus} olarak override edildi`);
      setShowOverride(false);
      setOverrideDescription("");
      setOverrideLocation("");
      setOverrideReason("");
      await fetchData();
    } finally {
      setOverrideSubmitting(false);
    }
  }

  const meta = assignment?.tracking_status
    ? STATUS_META[assignment.tracking_status]
    : null;

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-6 md:px-6">
      <Link
        href="/admin/kargo"
        className="mb-4 inline-flex items-center gap-1 text-[13px] text-gri-700 hover:text-pim-mercan"
      >
        ← Kargo listesine dön
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Eyebrow>Yurtiçi Kargo</Eyebrow>
          <h1 className="mt-1 text-2xl font-bold text-lacivert md:text-3xl font-mono">
            {orderId}
          </h1>
          <p className="mt-1 text-sm text-gri-700">
            <Link
              href={`/admin/siparisler/${orderId}`}
              className="text-pim-mercan hover:underline"
            >
              Sipariş detayına git →
            </Link>
          </p>
        </div>
      </div>

      {loading ? (
        <Card className="p-6">
          <Skeleton className="h-32 w-full" />
        </Card>
      ) : !assignment?.tracking_number ? (
        <Card className="p-10 text-center">
          <div className="mb-2 text-4xl">📭</div>
          <h2 className="text-lg font-semibold text-lacivert">
            Bu sipariş için kargo bilgisi yok
          </h2>
          <p className="mt-1 text-sm text-gri-700">
            <Link
              href={`/admin/siparisler/${orderId}`}
              className="text-pim-mercan hover:underline"
            >
              Sipariş detay sayfasından kargo bilgisi gir →
            </Link>
          </p>
        </Card>
      ) : (
        <>
          {/* Özet kart */}
          <Card className="mb-4 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <div className="text-[11px] text-gri-700">Kargo şirketi</div>
                <div className="mt-1 text-sm font-semibold text-lacivert">
                  {assignment.tracking_company ?? "Yurtiçi Kargo"}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-gri-700">Takip no</div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-gri-100 px-2 py-0.5 font-mono text-[12.5px]">
                    {assignment.tracking_number}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        assignment.tracking_number ?? ""
                      );
                      toast.success("Kopyalandı");
                    }}
                    className="text-[11px] font-semibold text-pim-mercan hover:underline"
                  >
                    Kopyala
                  </button>
                </div>
              </div>
              <div>
                <div className="text-[11px] text-gri-700">Durum</div>
                {meta ? (
                  <span
                    className={cn(
                      "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium",
                      meta.bg,
                      meta.color
                    )}
                  >
                    {meta.emoji} {meta.tr}
                  </span>
                ) : (
                  <span className="text-gri-500">—</span>
                )}
              </div>
              <div className="md:col-span-3 text-[11.5px] text-gri-500 border-t border-gri-100 pt-3">
                Kargoya verildi: {formatDateTime(assignment.shipped_at)} · Son
                poll: {formatDateTime(assignment.tracking_last_polled_at)}
                {assignment.tracking_delivered_at && (
                  <>
                    {" "}· Teslim:{" "}
                    <span className="font-semibold text-yesil-koyu">
                      {formatDateTime(assignment.tracking_delivered_at)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Aksiyon butonları */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={handlePollNow}
                disabled={polling}
              >
                {polling ? "Sorgulanıyor..." : "🔄 Şimdi sorgula"}
              </Button>
              {assignment.tracking_url && (
                <a
                  href={assignment.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="secondary">
                    Yurtiçi'de aç →
                  </Button>
                </a>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowOverride(true)}
              >
                ⚠️ Durum override
              </Button>
            </div>
          </Card>

          {/* Timeline */}
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase text-gri-700">
              Durum geçmişi ({events.length})
            </h3>
            {events.length === 0 ? (
              <p className="text-sm text-gri-500 py-4">
                Henüz event çekilmedi. "Şimdi sorgula" butonuna basabilirsin.
              </p>
            ) : (
              <ol className="relative space-y-3 pl-6 border-l-2 border-gri-200">
                {events.map((ev, i) => {
                  const m = STATUS_META[ev.status];
                  const isLast = i === events.length - 1;
                  return (
                    <li
                      key={`${ev.status}-${ev.event_time}-${i}`}
                      className="relative"
                    >
                      <span
                        className={cn(
                          "absolute -left-[33px] top-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] ring-2 ring-white",
                          m?.bg ?? "bg-gri-100",
                          isLast ? "ring-pim-mercan" : ""
                        )}
                      >
                        {m?.emoji ?? "📍"}
                      </span>
                      <div className="rounded-lg border border-gri-200 p-3">
                        <div
                          className={cn(
                            "text-[13px] font-semibold",
                            m?.color ?? "text-lacivert"
                          )}
                        >
                          {m?.tr ?? ev.status}
                        </div>
                        {ev.description && (
                          <div className="mt-0.5 text-[12.5px] text-gri-700">
                            {ev.description}
                            {ev.location && (
                              <span className="text-gri-500">
                                {" "}· {ev.location}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="mt-1 text-[11.5px] text-gri-500">
                          {formatDateTime(ev.event_time)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </>
      )}

      {/* Override Modal */}
      {showOverride && (
        <Modal
          open={true}
          onClose={() => setShowOverride(false)}
          title="Durum Manuel Override"
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-sari-soft p-3 text-[12.5px] text-sari-koyu">
              ⚠️ Bu işlem Yurtiçi API'nin gönderdiği durum yerine manuel bir
              kayıt oluşturur. Sadece istisnai durumlarda kullan. Audit log
              tutulur (kim, ne zaman, neden).
            </div>

            <div>
              <label className="mb-1 block text-[12.5px] font-medium text-lacivert">
                Yeni durum
              </label>
              <select
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value)}
                className="w-full rounded-lg border border-gri-200 px-3 py-2 text-sm"
              >
                {OVERRIDE_STATUSES.map((s) => {
                  const m = STATUS_META[s];
                  return (
                    <option key={s} value={s}>
                      {m.emoji} {m.tr}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[12.5px] font-medium text-lacivert">
                Açıklama <span className="text-kirmizi">*</span>
              </label>
              <Input
                value={overrideDescription}
                onChange={(e) => setOverrideDescription(e.target.value)}
                placeholder="örn: Müşteri telefonla teslim aldığını bildirdi"
              />
            </div>

            <div>
              <label className="mb-1 block text-[12.5px] font-medium text-lacivert">
                Lokasyon (opsiyonel)
              </label>
              <Input
                value={overrideLocation}
                onChange={(e) => setOverrideLocation(e.target.value)}
                placeholder="örn: Üsküdar Şubesi"
              />
            </div>

            <div>
              <label className="mb-1 block text-[12.5px] font-medium text-lacivert">
                Sebep (audit için) <span className="text-kirmizi">*</span>
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
                placeholder="örn: Yurtiçi sistemde durum güncellenmedi ama müşteri WhatsApp'tan teslim aldığını söyledi"
                className="w-full rounded-lg border border-gri-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowOverride(false)}
                disabled={overrideSubmitting}
              >
                İptal
              </Button>
              <Button onClick={handleOverride} disabled={overrideSubmitting}>
                {overrideSubmitting ? "Kaydediliyor..." : "Override et"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
