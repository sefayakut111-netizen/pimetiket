"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

type TicketStatus =
  | "open"
  | "in_progress"
  | "waiting_customer"
  | "resolved"
  | "closed";

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  category: string;
  status: TicketStatus;
  orderId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  adminResponse: string | null;
  createdAt: string;
}

const FILTERS = [
  { id: "open", label: "Açık" },
  { id: "in_progress", label: "İşlemde" },
  { id: "waiting_customer", label: "Bekliyor" },
  { id: "resolved", label: "Çözüldü" },
  { id: "all", label: "Tümü" },
];

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "🟡 açık",
  in_progress: "🔵 işlemde",
  waiting_customer: "⏳ bekliyor",
  resolved: "🟢 çözüldü",
  closed: "📦 kapalı",
};

export default function AdminDestekPage() {
  const toast = useToast();
  const [items, setItems] = useState<SupportTicket[]>([]);
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/support?status=${filter}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as { ok?: boolean; items?: SupportTicket[] };
      if (!json.ok) throw new Error("fetch_failed");
      setItems(json.items ?? []);
    } catch {
      toast.error("Liste alınamadı");
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (status: TicketStatus) => {
    if (!selected || !response.trim()) {
      toast.error("Yanıt yazın");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/support/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_response: response, status }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!json.ok) {
        toast.error(json.error ?? "Kaydedilemedi");
        return;
      }
      toast.success("Yanıt gönderildi");
      setSelected(null);
      setResponse("");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <Eyebrow>Müşteri</Eyebrow>
        <h1 className="mt-3 text-[28px] font-semibold mb-6">Destek Talepleri</h1>

        <div className="flex gap-2 flex-wrap mb-5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[13px] font-semibold",
                filter === f.id
                  ? "bg-lacivert text-white"
                  : "bg-gri-100 text-gri-700"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
          <Card padding="p-0" className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-gri-600">Yükleniyor…</div>
            ) : items.length === 0 ? (
              <div className="p-12 text-center">
                <Pim pose="happy" size={100} />
                <p className="mt-4 text-gri-700">Bu filtrede talep yok.</p>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="bg-gri-50 border-b border-gri-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Konu</th>
                    <th className="px-4 py-3 text-left">Kategori</th>
                    <th className="px-4 py-3 text-left">Müşteri</th>
                    <th className="px-4 py-3 text-left">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gri-100">
                  {items.map((t) => (
                    <tr
                      key={t.id}
                      className={cn(
                        "cursor-pointer hover:bg-gri-50",
                        selected?.id === t.id && "bg-pim-mercan-tint/20"
                      )}
                      onClick={() => {
                        setSelected(t);
                        setResponse(t.adminResponse ?? "");
                      }}
                    >
                      <td className="px-4 py-3 font-semibold">{t.subject}</td>
                      <td className="px-4 py-3">{t.category}</td>
                      <td className="px-4 py-3">
                        {t.customerName ?? t.customerEmail ?? "—"}
                      </td>
                      <td className="px-4 py-3">{STATUS_LABEL[t.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card padding="p-5">
            {!selected ? (
              <p className="text-gri-600 text-[13px]">Detay için satıra tıklayın.</p>
            ) : (
              <>
                <h2 className="font-semibold text-[16px] mb-2">{selected.subject}</h2>
                <p className="text-[13px] text-gri-700 whitespace-pre-wrap mb-4">
                  {selected.message}
                </p>
                {selected.orderId && (
                  <p className="text-[12px] mb-4">
                    Sipariş:{" "}
                    <Link
                      href={`/admin/siparisler/${selected.orderId}`}
                      className="text-pim-mercan font-semibold underline"
                    >
                      #{selected.orderId}
                    </Link>
                  </p>
                )}
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={5}
                  placeholder="Admin yanıtı…"
                  className="w-full px-3 py-2 rounded-lg ring-1 ring-gri-200 text-[13px] mb-3"
                />
                <div className="flex flex-col gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={submitting}
                    onClick={() => void respond("resolved")}
                  >
                    Yanıtla + Çözüldü
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={submitting}
                    onClick={() => void respond("waiting_customer")}
                  >
                    Yanıtla + Beklet
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
