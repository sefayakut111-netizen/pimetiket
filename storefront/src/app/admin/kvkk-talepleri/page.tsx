"use client";

/**
 * Pim Etiket — /admin/kvkk-talepleri
 *
 * Müşterilerin oluşturduğu KVKK m.11 taleplerini işleme ekranı.
 * - Status filter (pending/confirmed/processing/completed/cancelled/rejected/all)
 * - Detay panel: kim, ne istedi, scope, audit info
 * - Action: complete (talebi tamamla) / reject (gerekçeli reddet)
 *
 * Resend gelene kadar email confirmation flow yok — talepler doğrudan
 * "confirmed" olarak gelir, admin "processing"e alır, sonra
 * "completed"a getirir.
 */

import { useCallback, useEffect, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, Modal, useToast, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";

interface KvkkAdminRow {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  kind:
    | "data_export"
    | "account_delete"
    | "partial_delete"
    | "correction"
    | "objection"
    | "restriction";
  status:
    | "pending"
    | "confirmed"
    | "processing"
    | "completed"
    | "cancelled"
    | "rejected";
  scope: Record<string, boolean>;
  user_note: string | null;
  grace_period_until: string | null;
  cancelled_at: string | null;
  processed_at: string | null;
  admin_note: string | null;
  request_ip: string | null;
  created_at: string;
}

const KIND_LABEL: Record<KvkkAdminRow["kind"], string> = {
  data_export: "Verileri dışa aktar (ZIP)",
  account_delete: "Hesap silme",
  partial_delete: "Seçili veri silme",
  correction: "Düzeltme",
  objection: "İtiraz",
  restriction: "Sınırlandırma",
};

const STATUS_META: Record<
  KvkkAdminRow["status"],
  { label: string; color: string }
> = {
  pending: { label: "Onay bekliyor", color: "bg-sari-soft text-sari-koyu" },
  confirmed: {
    label: "Onaylı — 48h grace",
    color: "bg-pim-mercan-tint text-pim-mercan",
  },
  processing: { label: "İşleniyor", color: "bg-pim-mercan-tint text-pim-mercan" },
  completed: { label: "Tamamlandı", color: "bg-yesil-soft text-yesil" },
  cancelled: { label: "Vazgeçildi", color: "bg-gri-100 text-gri-700" },
  rejected: { label: "Reddedildi", color: "bg-kirmizi-soft text-kirmizi" },
};

const SCOPE_LABEL: Record<string, string> = {
  orders: "Siparişler",
  designs: "Tasarımlar",
  pim_chat: "Pim sohbet",
  reviews: "Yorumlar",
  profile: "Profil + adres",
};

type StatusFilter = "all" | KvkkAdminRow["status"];

export default function AdminKvkkTalepleriPage() {
  const toast = useToast();
  const [requests, setRequests] = useState<KvkkAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("confirmed");
  const [active, setActive] = useState<KvkkAdminRow | null>(null);
  const [actionMode, setActionMode] = useState<"complete" | "reject" | null>(
    null
  );
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async (status: StatusFilter) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/kvkk-requests?status=${status}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "list_failed");
      setRequests(json.requests ?? []);
    } catch (err) {
      console.error("[admin/kvkk-talepleri]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(filter);
  }, [filter, refresh]);

  const submitAction = async () => {
    if (!active || !actionMode) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/kvkk-requests/${active.id}/process`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: actionMode,
            note: adminNote.trim() || null,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "İşlem başarısız");
        return;
      }
      toast.success(
        actionMode === "complete" ? "Talep tamamlandı" : "Talep reddedildi"
      );
      setActive(null);
      setActionMode(null);
      setAdminNote("");
      void refresh(filter);
    } finally {
      setSubmitting(false);
    }
  };

  const stats = {
    confirmed: requests.filter((r) => r.status === "confirmed").length,
    processing: requests.filter((r) => r.status === "processing").length,
    completed: requests.filter((r) => r.status === "completed").length,
  };

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="mb-6">
          <Eyebrow>Sistem · KVKK m.11</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            KVKK talepleri
          </h1>
          <p className="mt-1.5 text-base text-gri-700 leading-relaxed">
            Müşterilerin veri hakları talepleri. <strong>48 saat SLA</strong> ·
            yasal azami 30 gün (KVKK m.13).
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap mb-4">
          {(
            [
              { id: "confirmed" as const, label: `Bekliyor (${stats.confirmed})` },
              { id: "processing" as const, label: `İşleniyor (${stats.processing})` },
              { id: "completed" as const, label: "Tamamlanan" },
              { id: "cancelled" as const, label: "Vazgeçilen" },
              { id: "rejected" as const, label: "Reddedilen" },
              { id: "all" as const, label: "Tümü" },
            ]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-4 py-2 rounded-full text-[13px] font-semibold transition-colors",
                filter === f.id
                  ? "bg-lacivert text-white"
                  : "bg-white ring-1 ring-gri-200 text-gri-700 hover:bg-gri-100"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Liste */}
        <Card padding="p-0" className="overflow-x-auto">
          {loading && (
            <div className="p-4">
              <Skeleton.AdminTable rows={5} />
            </div>
          )}

          {!loading && requests.length === 0 && (
            <div className="p-12 text-center">
              <Pim pose="happy" size={120} />
              <h3 className="mt-3 font-semibold text-base">
                {filter === "confirmed"
                  ? "Bekleyen talep yok — kuyruk temiz 🎉"
                  : "Bu filtrede kayıt yok"}
              </h3>
            </div>
          )}

          {!loading && requests.length > 0 && (
            <table className="w-full text-[13px] text-left">
              <thead className="border-b border-gri-200 bg-gri-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Tarih
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Müşteri
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Talep tipi
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Durum
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gri-100">
                {requests.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <tr key={r.id} className="hover:bg-gri-50">
                      <td className="px-4 py-3 text-gri-700 text-[12.5px] tabular-nums whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-lacivert">
                          {r.user_name ?? "—"}
                        </div>
                        <div className="text-[11.5px] text-gri-700 font-mono">
                          {r.user_email ?? r.user_id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">
                          {KIND_LABEL[r.kind]}
                        </div>
                        {r.kind === "partial_delete" &&
                          r.scope &&
                          Object.entries(r.scope).filter(
                            ([, v]) => v
                          ).length > 0 && (
                            <div className="text-[11px] text-gri-700 mt-0.5">
                              {Object.entries(r.scope)
                                .filter(([, v]) => v)
                                .map(([k]) => SCOPE_LABEL[k] ?? k)
                                .join(", ")}
                            </div>
                          )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold",
                            meta.color
                          )}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActive(r)}
                        >
                          Detay <Icon.ChevR size={12} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Detay modal */}
      {active && !actionMode && (
        <Modal
          open={true}
          onClose={() => setActive(null)}
          title={KIND_LABEL[active.kind]}
          maxWidthClassName="max-w-[640px]"
        >
          <div className="space-y-3 text-[13px]">
            <DetailRow label="Müşteri">
              <strong>{active.user_name ?? "—"}</strong>
              <span className="text-gri-700"> · {active.user_email ?? "—"}</span>
            </DetailRow>
            <DetailRow label="Talep tarihi">
              {new Date(active.created_at).toLocaleString("tr-TR")}
            </DetailRow>
            <DetailRow label="Durum">
              <span
                className={cn(
                  "inline-flex items-center h-[20px] px-2 rounded-full text-[11px] font-semibold",
                  STATUS_META[active.status].color
                )}
              >
                {STATUS_META[active.status].label}
              </span>
            </DetailRow>
            {active.grace_period_until && (
              <DetailRow label="Vazgeçme süresi sonu">
                {new Date(active.grace_period_until).toLocaleString("tr-TR")}
              </DetailRow>
            )}
            {active.kind === "partial_delete" && (
              <DetailRow label="Silinecek veriler">
                <ul className="list-disc pl-5 mt-1">
                  {Object.entries(active.scope)
                    .filter(([, v]) => v)
                    .map(([k]) => (
                      <li key={k}>{SCOPE_LABEL[k] ?? k}</li>
                    ))}
                </ul>
              </DetailRow>
            )}
            {active.user_note && (
              <DetailRow label="Müşteri notu">
                <em className="text-gri-700">{active.user_note}</em>
              </DetailRow>
            )}
            {active.admin_note && (
              <DetailRow label="Admin notu">
                <em className="text-gri-700">{active.admin_note}</em>
              </DetailRow>
            )}
            {active.request_ip && (
              <DetailRow label="IP">
                <code className="text-[11.5px] font-mono">{active.request_ip}</code>
              </DetailRow>
            )}
          </div>

          {(active.status === "confirmed" ||
            active.status === "processing") && (
            <div className="mt-5 pt-5 border-t border-gri-100 flex gap-2 flex-wrap">
              <Button
                variant="ghost"
                onClick={() => setActive(null)}
                className="!text-gri-700"
              >
                Kapat
              </Button>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setActionMode("reject")}
                  className="!text-kirmizi"
                >
                  Reddet
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setActionMode("complete")}
                >
                  Tamamlandı olarak işaretle
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Action modal */}
      {active && actionMode && (
        <Modal
          open={true}
          onClose={() => setActionMode(null)}
          title={
            actionMode === "complete"
              ? "Talebi tamamla"
              : "Talebi reddet"
          }
        >
          <p className="text-[13px] text-gri-700 leading-relaxed mb-3">
            {actionMode === "complete"
              ? "Bu talebi 'tamamlandı' olarak işaretle. Asıl silme/export işlemini yaptıktan sonra not bırakabilirsin."
              : "Reddetme gerekçesini yaz (örn: yasal saklama süresi nedeniyle silinemiyor)."}
          </p>
          <textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder={
              actionMode === "complete"
                ? "Örn: Tasarım dosyaları silindi, sipariş kayıtları arşivde tutuldu."
                : "Reddetme gerekçesi (zorunlu)…"
            }
            rows={4}
            className="w-full px-3 py-2 rounded-lg ring-1 ring-gri-200 focus:ring-2 focus:ring-pim-mercan outline-none text-[13px] resize-y"
          />
          <div className="mt-5 flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setActionMode(null)}>
              Vazgeç
            </Button>
            <Button
              variant="primary"
              onClick={submitAction}
              disabled={
                submitting ||
                (actionMode === "reject" && adminNote.trim().length < 5)
              }
              className={cn(actionMode === "reject" && "!bg-kirmizi")}
            >
              {submitting
                ? "Gönderiliyor…"
                : actionMode === "complete"
                  ? "Tamamlandı"
                  : "Reddet"}
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-[180px] shrink-0 text-[12px] text-gri-700 font-semibold uppercase tracking-[0.04em]">
        {label}
      </div>
      <div className="flex-1 min-w-0 text-lacivert">{children}</div>
    </div>
  );
}
