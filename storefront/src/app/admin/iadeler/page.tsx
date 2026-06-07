/**
 * Pim Etiket — /admin/iadeler
 *
 * Admin RMA yönetimi: iade taleplerini incele, onayla / reddet / iade et.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  RETURN_REASON_LABEL,
  STATUS_LABEL,
  type ReturnRequest,
  type ReturnStatus,
} from "@/lib/customer-return";

const STATUS_FILTERS: { id: ReturnStatus | "all"; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "pending", label: "İncelemede" },
  { id: "approved", label: "Onaylı" },
  { id: "rejected", label: "Reddedildi" },
  { id: "refunded", label: "İade tamamlandı" },
];

const STATUS_META: Record<ReturnStatus, { color: string; bg: string }> = {
  pending: { color: "text-sari-koyu", bg: "bg-sari-soft" },
  approved: { color: "text-yesil", bg: "bg-yesil-soft" },
  rejected: { color: "text-kirmizi", bg: "bg-kirmizi/10" },
  refunded: { color: "text-yesil", bg: "bg-yesil-soft" },
};

export default function AdminIadelerPage() {
  const toast = useToast();
  const [items, setItems] = useState<ReturnRequest[]>([]);
  const [filter, setFilter] = useState<ReturnStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadReturns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/returns?status=all", {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        items?: ReturnRequest[];
        error?: string;
      };
      if (!res.ok || !data.ok || !data.items) {
        toast.error(data.error ?? "İade listesi yüklenemedi");
        setItems([]);
        return;
      }
      setItems(data.items);
    } catch {
      toast.error("İade listesi yüklenemedi");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadReturns();
  }, [loadReturns]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((r) => r.status === filter);
  }, [items, filter]);

  const postStatus = async (
    r: ReturnRequest,
    status: "approved" | "rejected",
    adminNote: string
  ) => {
    setActionId(r.id);
    try {
      const res = await fetch(`/api/admin/returns/${r.id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "İşlem başarısız");
        return;
      }
      toast.success(
        status === "approved"
          ? `${r.id.slice(0, 8)}… onaylandı`
          : `${r.id.slice(0, 8)}… reddedildi`
      );
      await loadReturns();
    } catch {
      toast.error("İşlem başarısız");
    } finally {
      setActionId(null);
    }
  };

  const handleApprove = (r: ReturnRequest) => {
    const note = prompt(
      "Onay notu (müşteriye görünür):",
      "İade talebin onaylandı. Ürünü kargoyla geri gönder, eline ulaşınca para iadesi başlatılacak."
    );
    if (note == null || !note.trim()) return;
    void postStatus(r, "approved", note.trim());
  };

  const handleReject = (r: ReturnRequest) => {
    const note = prompt(
      "Red sebebi (müşteriye görünür):",
      "Müşterinin sağladığı görseller üretim hatasına işaret etmiyor. Detay için iletişim formundan ulaşabilirsin."
    );
    if (note == null || !note.trim()) return;
    void postStatus(r, "rejected", note.trim());
  };

  const handleRefund = async (r: ReturnRequest) => {
    const amount = prompt("İade tutarı (₺):", String(r.refundAmount ?? ""));
    if (amount == null) return;
    const parsed = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Geçerli bir tutar gir");
      return;
    }

    const reason = prompt(
      "İade gerekçesi (audit log):",
      `İade talebi ${r.id.slice(0, 8)} — admin onaylı para iadesi`
    );
    if (reason == null || reason.trim().length < 10) {
      toast.error("Gerekçe en az 10 karakter olmalı");
      return;
    }

    setActionId(r.id);
    try {
      const res = await fetch("/api/payment/refund", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: r.orderId,
          amount: parsed,
          returnId: r.id,
          force: true,
          reason: reason.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        toast.error(data.hint ?? data.error ?? "Para iadesi başarısız");
        return;
      }
      toast.success(`${parsed.toLocaleString("tr-TR")} ₺ iade başlatıldı`);
      await loadReturns();
    } catch {
      toast.error("Para iadesi başarısız");
    } finally {
      setActionId(null);
    }
  };

  const pending = items.filter((r) => r.status === "pending").length;
  const approved = items.filter((r) => r.status === "approved").length;
  const rejected = items.filter((r) => r.status === "rejected").length;
  const refunded = items.filter((r) => r.status === "refunded").length;
  const totalRefund = items
    .filter((r) => r.status === "refunded")
    .reduce((s, r) => s + (r.refundAmount ?? 0), 0);

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="mb-6">
          <Eyebrow>Müşteri hizmetleri</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            İade yönetimi
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {loading ? "Yükleniyor…" : `${items.length} iade talebi · ${pending} incelemede · ${refunded} tamamlandı`}
          </p>
          <p className="text-sm text-gri-600 mt-4">
            İade = teslim edildikten sonra müşteri geri göndermesi. İptal =
            sipariş üretime girmeden vazgeçme. İptal edilen siparişleri
            Siparişler sayfasından görebilirsin.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {[
            { label: "İncelemede", value: pending, accent: "text-sari-koyu", bg: "bg-sari-soft" },
            { label: "Onaylı", value: approved, accent: "text-yesil", bg: "bg-yesil-soft" },
            { label: "Reddedildi", value: rejected, accent: "text-kirmizi", bg: "bg-kirmizi/10" },
            { label: "İade tamamlandı", value: refunded, accent: "text-yesil", bg: "bg-yesil-soft" },
            { label: "Toplam iade tutarı", value: `${Math.round(totalRefund).toLocaleString("tr-TR")} ₺`, accent: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
          ].map((k) => (
            <Card key={k.label} padding="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("grid place-items-center w-10 h-10 rounded-xl shrink-0", k.bg, k.accent)}>
                  <Icon.Box size={16} />
                </div>
                <div>
                  <div className="text-[11.5px] uppercase tracking-[0.04em] text-gri-700 font-semibold">
                    {k.label}
                  </div>
                  <div className={cn("text-2xl font-bold tabular-nums", k.accent)}>
                    {k.value}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card padding="p-4" className="mb-5">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-[13px] font-semibold transition-colors",
                  filter === f.id
                    ? "bg-lacivert text-white"
                    : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Card>

        {loading ? (
          <Card padding="p-10" className="text-center text-gri-700">
            İade talepleri yükleniyor…
          </Card>
        ) : filtered.length === 0 ? (
          <Card padding="p-10" className="text-center">
            <Pim pose="happy" size={120} />
            <h3 className="mt-4 text-xl font-semibold">
              {items.length === 0
                ? "İade talebi yok"
                : "Bu filtrede sonuç yok"}
            </h3>
            <p className="mt-2 text-[13px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
              {items.length === 0
                ? "Müşteriler iade açtığında burada görünür."
                : "Filtreyi değiştirmeyi dene."}
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((r) => {
              const meta = STATUS_META[r.status];
              const date = new Date(r.createdAtIso).toLocaleString("tr-TR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Istanbul",
              });
              const ageHours =
                (Date.now() - new Date(r.createdAtIso).getTime()) /
                (1000 * 60 * 60);
              const isPending = r.status === "pending";
              const slaMeta = !isPending
                ? null
                : ageHours < 24
                  ? { tr: "Yeni", bg: "bg-yesil-soft", color: "text-yesil-koyu" }
                  : ageHours < 72
                    ? { tr: `${Math.floor(ageHours)}sa`, bg: "bg-sari-soft", color: "text-sari-koyu" }
                    : { tr: `${Math.floor(ageHours / 24)}g+`, bg: "bg-kirmizi-soft", color: "text-kirmizi-koyu" };
              const busy = actionId === r.id;

              return (
                <Card key={r.id} padding="p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
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
                        {slaMeta && (
                          <span
                            className={cn(
                              "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold",
                              slaMeta.bg,
                              slaMeta.color
                            )}
                            title="SLA yaşı — TKHK m.30 gün sınır"
                          >
                            {slaMeta.tr}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-base text-lacivert">
                        {r.customerName}{" "}
                        <span className="text-gri-500 font-normal text-[13px]">
                          · {r.customerEmail}
                        </span>
                      </div>
                      <div className="text-[13px] text-gri-700 mt-1 font-semibold">
                        {RETURN_REASON_LABEL[r.reason]}
                      </div>
                      <div className="text-[13.5px] text-gri-700 mt-2 leading-relaxed">
                        {r.description}
                      </div>
                      {r.attachments.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mt-2.5">
                          {r.attachments.map((f) => (
                            <span
                              key={f}
                              className="inline-flex items-center gap-1 h-7 px-2 rounded-full bg-gri-100 text-gri-700 text-[11px] font-mono"
                            >
                              <Icon.Box size={11} /> {f}
                            </span>
                          ))}
                        </div>
                      )}
                      {r.adminNote && (
                        <div className="mt-2.5 px-3 py-2 rounded-lg bg-gri-50 text-[12.5px] text-gri-700 leading-relaxed">
                          <strong className="text-lacivert">Senin notun: </strong>
                          {r.adminNote}
                        </div>
                      )}
                      <div className="text-[11.5px] text-gri-500 mt-2 tabular-nums">
                        Açıldı: {date}
                        {r.refundAmount != null && r.refundAmount > 0 && (
                          <>
                            {" · "}
                            <span className="text-yesil font-semibold">
                              İade: {r.refundAmount.toLocaleString("tr-TR")} ₺
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {r.status === "pending" && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleApprove(r)}
                          className="!bg-yesil hover:!bg-yesil-koyu"
                        >
                          <Icon.Check size={12} /> Onayla
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleReject(r)}
                        >
                          Reddet
                        </Button>
                      </div>
                    )}
                    {r.status === "approved" && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleRefund(r)}
                      >
                        <Icon.Check size={12} /> İade et
                      </Button>
                    )}
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
