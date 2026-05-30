/**
 * Pim Etiket — /admin/yardim-talepleri
 *
 * Sefa 22 May v68 (Faz 4 — Uzman akışı):
 * Müşterilerin /onay sayfasından açtığı proof_help_requests ticket'larını
 * listele, cevap yaz, çöz/yoksay.
 *
 * GET /api/admin/help-requests?status=active|all|...
 * POST /api/admin/help-requests/[id]/respond
 *
 * Müşteri "resolved" sonrası bir sonraki /onay açılışında resolution_note'u
 * görür (fn_proof_summary zaten döndürüyor) ve karar tekrar verebilir.
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Button, Card, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

type HelpStatus = "open" | "in_progress" | "resolved" | "dismissed";

interface HelpRequest {
  id: string;
  orderId: string;
  itemId: string;
  itemTitle: string;
  qty: number;
  width: number;
  height: number;
  customerName: string | null;
  customerEmail: string | null;
  message: string;
  status: HelpStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  ageHours: number;
}

const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: "active", label: "Bekleyenler" },
  { id: "resolved", label: "Çözülenler" },
  { id: "dismissed", label: "Yoksayılanlar" },
  { id: "all", label: "Tümü" },
];

const STATUS_META: Record<HelpStatus, { color: string; bg: string; label: string }> = {
  open: { color: "text-pim-mercan", bg: "bg-pim-mercan-tint/40", label: "Açık" },
  in_progress: {
    color: "text-sari-koyu",
    bg: "bg-sari-soft",
    label: "İşleniyor",
  },
  resolved: { color: "text-yesil", bg: "bg-yesil-soft", label: "Çözüldü" },
  dismissed: { color: "text-gri-700", bg: "bg-gri-100", label: "Yoksayıldı" },
};

export default function AdminYardimTalepleriPage() {
  const toast = useToast();
  const [items, setItems] = useState<HelpRequest[]>([]);
  const [filter, setFilter] = useState<string>("active");
  const [loading, setLoading] = useState(true);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/help-requests?status=${filter}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error || `fetch_failed_${res.status}`);
      }
      const data = (await res.json()) as { items: HelpRequest[] };
      setItems(data.items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error(`Talepler yüklenemedi: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const counts = useMemo(() => {
    return {
      active: items.filter(
        (i) => i.status === "open" || i.status === "in_progress"
      ).length,
      resolved: items.filter((i) => i.status === "resolved").length,
      dismissed: items.filter((i) => i.status === "dismissed").length,
      total: items.length,
    };
  }, [items]);

  async function handleRespond(
    ticket: HelpRequest,
    action: "resolved" | "dismissed"
  ) {
    if (draftNote.trim().length < 10) {
      toast.error("Cevap en az 10 karakter olmalı");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/help-requests/${ticket.id}/respond`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            resolutionNote: draftNote.trim(),
            action,
          }),
        }
      );
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error || `respond_failed_${res.status}`);
      }
      toast.success(
        action === "resolved"
          ? `${ticket.orderId} talebi çözüldü olarak işaretlendi`
          : `${ticket.orderId} talebi yoksayıldı`
      );
      setOpenTicketId(null);
      setDraftNote("");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error(`İşlem başarısız: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-lacivert">Prova Yardımı</h1>
        <p className="mt-1 text-sm text-gri-700">
          Müşterinin /onay sayfasından açtığı prova yardım talepleri — bıçak,
          beyaz veya onay süreci soruları buraya düşer.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
              filter === f.id
                ? "bg-lacivert text-white"
                : "bg-white text-gri-700 border border-gri-200 hover:bg-gri-100"
            )}
          >
            {f.label}
            {f.id === "active" && counts.active > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pim-mercan px-1.5 text-[11px] font-bold text-white">
                {counts.active}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="p-8 text-center text-gri-700">Yükleniyor…</Card>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-[15px] font-semibold text-lacivert">
             Bekleyen yardım talebi yok
          </div>
          <p className="mt-2 text-[13px] text-gri-700">
            Müşteriler /onay sayfasında "Ekibimizden yardım iste" tıkladığında
            burada görünür.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((t) => {
            const meta = STATUS_META[t.status];
            const isOpen = openTicketId === t.id;
            const canRespond = t.status === "open" || t.status === "in_progress";
            const ageColor =
              t.ageHours >= 24
                ? "text-pim-mercan font-bold"
                : t.ageHours >= 6
                  ? "text-sari-koyu font-semibold"
                  : "text-gri-700";

            return (
              <Card key={t.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/admin/siparisler/${t.orderId}`}
                      className="text-[14px] font-bold text-lacivert hover:underline tabular-nums"
                    >
                      #{t.orderId}
                    </Link>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        meta.bg,
                        meta.color
                      )}
                    >
                      {meta.label}
                    </span>
                    <span className={cn("text-[12px] tabular-nums", ageColor)}>
                      {t.ageHours}sa önce
                    </span>
                  </div>
                  <div className="text-right text-[12px] text-gri-700">
                    {t.customerName ? (
                      <div className="font-semibold text-lacivert">
                        {t.customerName}
                      </div>
                    ) : null}
                    {t.customerEmail ? (
                      <div className="text-[11px]">{t.customerEmail}</div>
                    ) : null}
                  </div>
                </div>

                <div className="mb-2 text-[13px] text-gri-700">
                  <strong className="text-lacivert">{t.itemTitle}</strong> ·{" "}
                  {t.qty} ad · {t.width}×{t.height} mm
                </div>

                <div className="rounded-lg bg-gri-50 p-3 text-[13.5px] leading-relaxed text-lacivert">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-gri-700 mb-1">
                    Müşteri mesajı
                  </div>
                  {t.message}
                </div>

                {t.resolutionNote && (
                  <div className="mt-2 rounded-lg bg-yesil-soft p-3 text-[13.5px] leading-relaxed text-lacivert">
                    <div className="text-[10.5px] font-semibold uppercase tracking-wider text-yesil mb-1">
                      Operatör cevabı
                    </div>
                    {t.resolutionNote}
                  </div>
                )}

                {canRespond && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setOpenTicketId(isOpen ? null : t.id);
                        setDraftNote("");
                      }}
                    >
                      <Icon.Edit size={14} /> Cevap yaz
                    </Button>
                    <Link
                      href={`/admin/siparisler/${t.orderId}`}
                      className="inline-flex items-center gap-1 text-[12.5px] font-medium text-lacivert hover:underline"
                    >
                      <Icon.ArrowR size={14} /> Sipariş detayını aç
                    </Link>
                  </div>
                )}

                {isOpen && canRespond && (
                  <div className="mt-4 rounded-lg border border-gri-200 bg-white p-3">
                    <label
                      htmlFor={`note-${t.id}`}
                      className="block text-[12px] font-semibold text-lacivert mb-1.5"
                    >
                      Cevabın
                    </label>
                    <textarea
                      id={`note-${t.id}`}
                      value={draftNote}
                      onChange={(e) => setDraftNote(e.target.value)}
                      rows={4}
                      maxLength={2000}
                      placeholder="Müşteri ne yapmalı? Hangi düzeltme önerildi? (en az 10 karakter)"
                      className="w-full rounded-lg border border-gri-300 bg-white px-3 py-2 text-[13.5px] text-lacivert focus:border-pim-mercan focus:outline-none focus:ring-1 focus:ring-pim-mercan/30"
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-gri-700">
                      <span>{draftNote.length} / 2000 karakter</span>
                      <span>{draftNote.trim().length < 10 ? "En az 10 karakter gerekli" : "Hazır"}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={submitting || draftNote.trim().length < 10}
                        onClick={() => void handleRespond(t, "resolved")}
                      >
                         Çözüldü olarak işaretle
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={submitting || draftNote.trim().length < 10}
                        onClick={() => void handleRespond(t, "dismissed")}
                      >
                        Yoksay
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={submitting}
                        onClick={() => {
                          setOpenTicketId(null);
                          setDraftNote("");
                        }}
                      >
                        Vazgeç
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
