"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Button, Card, Input, useToast } from "@/components/ui";
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
  priority: string;
  status: TicketStatus;
  orderId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  adminResponse: string | null;
  aiCategorySuggestion: string | null;
  aiPrioritySuggestion: string | null;
  aiDraftResponse: string | null;
  aiClassifiedAt: string | null;
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
  { id: "low", label: "Düşük" },
  { id: "normal", label: "Normal" },
  { id: "high", label: "Yüksek" },
  { id: "urgent", label: "Acil" },
];

const CATEGORY_LABELS: Record<string, string> = {
  genel: "Genel",
  siparis: "Sipariş",
  tasarim: "Tasarım",
  kargo: "Kargo",
  iade: "İade",
  teknik: "Teknik",
  fiyat: "Fiyat",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-gri-100 text-gri-700",
  normal: "bg-mavi-soft text-mavi",
  high: "bg-sari-soft text-sari-koyu",
  urgent: "bg-kirmizi-soft text-kirmizi",
};

function CategoryBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex h-[22px] px-2 rounded-full text-[10.5px] font-semibold bg-gri-100 text-gri-700">
      {CATEGORY_LABELS[value] ?? value}
    </span>
  );
}

function PriorityBadge({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] px-2 rounded-full text-[10.5px] font-semibold",
        PRIORITY_STYLES[value] ?? PRIORITY_STYLES.normal
      )}
    >
      {PRIORITIES.find((p) => p.id === value)?.label ?? value}
    </span>
  );
}

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

export type DestekPanelProps = {
  showHeader?: boolean;
};

export function DestekPanel({ showHeader = false }: DestekPanelProps) {
  const toast = useToast();
  const [items, setItems] = useState<SupportTicket[]>([]);
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [acceptingAi, setAcceptingAi] = useState(false);
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

  const acceptAiSuggestions = async () => {
    if (!selected) return;
    setAcceptingAi(true);
    try {
      const res = await fetch(`/api/admin/support/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept_ai_suggestions: true }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        ticket?: {
          category: string;
          priority: string | null;
        };
      };
      if (!json.ok) {
        toast.error(json.error ?? "Öneri kabul edilemedi");
        return;
      }
      toast.success("AI önerisi kabul edildi");
      if (json.ticket) {
        setSelected({
          ...selected,
          category: json.ticket.category,
          priority: json.ticket.priority ?? selected.priority,
        });
      }
      await load();
    } finally {
      setAcceptingAi(false);
    }
  };

  const useAiDraft = () => {
    if (!selected?.aiDraftResponse) return;
    setResponse(selected.aiDraftResponse);
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
    <>
      {showHeader && (
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-[22px] font-semibold text-lacivert">Genel Destek</h2>
            <p className="text-sm text-gri-600 mt-2">
              İletişim formu, e-posta ve genel Pim sohbetinden gelen talepler.
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
      )}

      {!showHeader && (
        <div className="flex justify-end mb-4">
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
      )}

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
                  <th className="px-4 py-3 text-left">Öncelik</th>
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
                      setResponse(
                        t.adminResponse ?? t.aiDraftResponse ?? ""
                      );
                    }}
                  >
                    <td className="px-4 py-3 font-semibold">
                      {t.subject}
                      {t.aiClassifiedAt && (
                        <span className="ml-1.5 text-[10px] text-mavi font-semibold">
                          AI
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CategoryBadge value={t.category} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge value={t.priority ?? "normal"} />
                    </td>
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
              <div className="flex flex-wrap gap-2 mb-3">
                <CategoryBadge value={selected.category} />
                <PriorityBadge value={selected.priority ?? "normal"} />
              </div>

              {selected.aiClassifiedAt ? (
                <div className="mb-4 p-3 rounded-lg bg-gri-50 ring-1 ring-gri-200">
                  <p className="text-[11px] font-semibold text-gri-600 uppercase tracking-wide mb-2">
                    AI önerisi
                  </p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selected.aiCategorySuggestion && (
                      <CategoryBadge value={selected.aiCategorySuggestion} />
                    )}
                    {selected.aiPrioritySuggestion && (
                      <PriorityBadge value={selected.aiPrioritySuggestion} />
                    )}
                  </div>
                  {selected.aiDraftResponse && (
                    <p className="text-[12.5px] text-gri-700 whitespace-pre-wrap mb-3">
                      {selected.aiDraftResponse}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={acceptingAi}
                      onClick={() => void acceptAiSuggestions()}
                    >
                      {acceptingAi ? "Kaydediliyor…" : "Öneriyi kabul et"}
                    </Button>
                    {selected.aiDraftResponse && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={useAiDraft}
                      >
                        Taslağı yanıta kopyala
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-gri-500 mb-3">
                  Sınıflandırılmadı (AI henüz işlemedi veya bütçe limiti)
                </p>
              )}

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
    </>
  );
}
