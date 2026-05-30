"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Button, Card, Eyebrow, Input, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { StatusDot, type DotColor } from "@/components/admin/ui";
import type { AdminCustomerRow } from "@/lib/admin-customer-types";

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

const CATEGORIES = [
  { id: "genel", label: "Genel" },
  { id: "siparis", label: "Sipariş" },
  { id: "tasarim", label: "Tasarım" },
  { id: "kargo", label: "Kargo" },
  { id: "iade", label: "İade" },
  { id: "teknik", label: "Teknik" },
  { id: "fiyat", label: "Fiyat" },
];

const PRIORITIES = [
  { id: "normal", label: "Normal" },
  { id: "yuksek", label: "Yüksek" },
  { id: "acil", label: "Acil" },
];

const STATUS_META: Record<TicketStatus, { label: string; dot: DotColor }> = {
  open: { label: "açık", dot: "sari" },
  in_progress: { label: "işlemde", dot: "mavi" },
  waiting_customer: { label: "bekliyor", dot: "gri" },
  resolved: { label: "çözüldü", dot: "yesil" },
  closed: { label: "kapalı", dot: "gri" },
};

function StatusBadge({ status }: { status: TicketStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot color={meta.dot} />
      {meta.label}
    </span>
  );
}

export default function AdminDestekPage() {
  const toast = useToast();
  const [items, setItems] = useState<SupportTicket[]>([]);
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerHits, setCustomerHits] = useState<AdminCustomerRow[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<AdminCustomerRow | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newCategory, setNewCategory] = useState("genel");
  const [newPriority, setNewPriority] = useState("normal");
  const [newOrderId, setNewOrderId] = useState("");

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

  useEffect(() => {
    if (!createOpen || customerSearch.trim().length < 2) {
      setCustomerHits([]);
      return;
    }
    const t = setTimeout(() => {
      void fetch(
        `/api/admin/customers?search=${encodeURIComponent(customerSearch.trim())}&limit=5`,
        { cache: "no-store" }
      )
        .then((r) => r.json())
        .then((json: { customers?: AdminCustomerRow[] }) => {
          setCustomerHits(json.customers ?? []);
        })
        .catch(() => setCustomerHits([]));
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch, createOpen]);

  const resetCreateForm = () => {
    setCustomerSearch("");
    setCustomerHits([]);
    setSelectedCustomer(null);
    setGuestEmail("");
    setGuestName("");
    setNewSubject("");
    setNewMessage("");
    setNewCategory("genel");
    setNewPriority("normal");
    setNewOrderId("");
  };

  const createTicket = async () => {
    if (!newSubject.trim() || !newMessage.trim()) {
      toast.error("Konu ve açıklama zorunlu");
      return;
    }
    if (!selectedCustomer && !guestEmail.trim()) {
      toast.error("Müşteri seç veya misafir e-postası gir");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: newSubject.trim(),
          message: newMessage.trim(),
          category: newCategory,
          priority: newPriority,
          order_id: newOrderId.trim() || undefined,
          user_id: selectedCustomer?.user_id,
          guest_email: selectedCustomer ? undefined : guestEmail.trim(),
          guest_name: selectedCustomer
            ? selectedCustomer.display_name ?? undefined
            : guestName.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!json.ok) {
        toast.error(json.error ?? "Oluşturulamadı");
        return;
      }
      toast.success("Destek talebi oluşturuldu");
      setCreateOpen(false);
      resetCreateForm();
      await load();
    } finally {
      setCreating(false);
    }
  };

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
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <Eyebrow>Müşteri</Eyebrow>
            <h1 className="mt-3 text-[28px] font-semibold">Destek (Genel)</h1>
            <p className="text-sm text-gri-600 mt-2">
              İletişim formu, e-posta ve genel Pim sohbetinden gelen talepler —
              prova ekranı yardımı için Prova Yardımı sayfasını kullanın.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetCreateForm();
              setCreateOpen(true);
            }}
          >
            Yeni talep oluştur
          </Button>
        </div>

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
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
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

      {createOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card padding="p-6" className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Yeni destek talebi</h2>
            <div className="space-y-3">
              <div>
                <label className="text-[12px] font-semibold text-gri-700">
                  Müşteri ara
                </label>
                <Input
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setSelectedCustomer(null);
                  }}
                  placeholder="E-posta veya isim…"
                  className="mt-1"
                />
                {customerHits.length > 0 && !selectedCustomer && (
                  <ul className="mt-1 ring-1 ring-gri-200 rounded-lg overflow-hidden">
                    {customerHits.map((c) => (
                      <li key={c.user_id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-[13px] hover:bg-gri-50"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerSearch(
                              c.display_name
                                ? `${c.display_name} (${c.email})`
                                : c.email
                            );
                            setCustomerHits([]);
                          }}
                        >
                          {c.display_name ?? c.email}
                          {c.display_name && (
                            <span className="text-gri-500 ml-1">{c.email}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedCustomer && (
                  <p className="text-[12px] text-yesil mt-1">
                    Seçildi: {selectedCustomer.email}
                  </p>
                )}
              </div>
              {!selectedCustomer && (
                <>
                  <div>
                    <label className="text-[12px] font-semibold text-gri-700">
                      Misafir e-posta
                    </label>
                    <Input
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      type="email"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-gri-700">
                      Misafir adı (isteğe bağlı)
                    </label>
                    <Input
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="text-[12px] font-semibold text-gri-700">Konu</label>
                <Input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-gri-700">
                  Açıklama
                </label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={4}
                  className="mt-1 w-full px-3 py-2 rounded-lg ring-1 ring-gri-200 text-[13px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-gri-700">
                    Kategori
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-lg ring-1 ring-gri-200 text-[13px]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-gri-700">
                    Öncelik
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-lg ring-1 ring-gri-200 text-[13px]"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-gri-700">
                  Sipariş no (isteğe bağlı)
                </label>
                <Input
                  value={newOrderId}
                  onChange={(e) => setNewOrderId(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCreateOpen(false);
                  resetCreateForm();
                }}
              >
                İptal
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={creating}
                onClick={() => void createTicket()}
              >
                {creating ? "Kaydediliyor…" : "Oluştur"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
