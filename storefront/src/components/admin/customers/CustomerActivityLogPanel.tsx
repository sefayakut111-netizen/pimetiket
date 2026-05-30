"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

export type CustomerActivityChannel = "phone" | "whatsapp" | "email" | "note";

export interface CustomerActivityLogEntry {
  id: string;
  customer_id: string;
  channel: CustomerActivityChannel;
  summary: string;
  created_by: string | null;
  created_at: string;
}

const CHANNEL_LABEL: Record<CustomerActivityChannel, string> = {
  phone: "Telefon",
  whatsapp: "WhatsApp",
  email: "E-posta",
  note: "Not",
};

const CHANNEL_EMOJI: Record<CustomerActivityChannel, string> = {
  phone: "📞",
  whatsapp: "💬",
  email: "✉️",
  note: "📝",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

interface Props {
  customerId: string;
  /** RPC aktivite akışına eklenecek birleşik liste için callback */
  onActivitiesChange?: (entries: CustomerActivityLogEntry[]) => void;
  /** false ise sadece form gösterilir (üst timeline birleşik kullanılıyorsa) */
  showTimeline?: boolean;
}

export function CustomerActivityLogPanel({
  customerId,
  onActivitiesChange,
  showTimeline = true,
}: Props) {
  const toast = useToast();
  const [items, setItems] = useState<CustomerActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channel, setChannel] = useState<CustomerActivityChannel>("note");
  const [summary, setSummary] = useState("");
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/customers/${encodeURIComponent(customerId)}/activity-log`
      );
      const json = (await res.json()) as {
        activities?: CustomerActivityLogEntry[];
      };
      const list = json.activities ?? [];
      setItems(list);
      onActivitiesChange?.(list);
    } catch {
      setItems([]);
      onActivitiesChange?.([]);
    } finally {
      setLoading(false);
    }
  }, [customerId, onActivitiesChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      toast.error("Özet alanı zorunlu");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/customers/${encodeURIComponent(customerId)}/activity-log`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ channel, summary: summary.trim() }),
        }
      );
      const json = (await res.json()) as {
        activity?: CustomerActivityLogEntry;
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Kaydedilemedi");
        return;
      }
      if (json.activity) {
        setItems((prev) => {
          const next = [json.activity!, ...prev];
          onActivitiesChange?.(next);
          return next;
        });
      }
      setSummary("");
      toast.success("İletişim kaydı eklendi");
    } catch {
      toast.error("Kaydedilemedi (ağ hatası)");
    } finally {
      setSaving(false);
    }
  };

  const visible = expanded ? items : items.slice(0, 5);

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CHANNEL_LABEL) as CustomerActivityChannel[]).map(
            (ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannel(ch)}
                className={cn(
                  "inline-flex items-center gap-1 h-8 px-3 rounded-full text-[11.5px] font-semibold transition-colors",
                  channel === ch
                    ? "bg-lacivert text-white"
                    : "bg-white ring-1 ring-gri-200 text-gri-700 hover:ring-lacivert"
                )}
              >
                {CHANNEL_EMOJI[ch]} {CHANNEL_LABEL[ch]}
              </button>
            )
          )}
        </div>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Görüşme özeti veya not..."
          rows={3}
          className="w-full rounded-lg border border-gri-200 px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-pim-mercan/30 resize-y"
        />
        <Button type="submit" variant="primary" size="sm" disabled={saving}>
          {saving ? "Kaydediliyor..." : "Not ekle"}
        </Button>
      </form>

      {showTimeline && (
        <>
          {loading ? (
            <p className="text-[12px] text-gri-500">Yükleniyor...</p>
          ) : items.length === 0 ? (
            <p className="text-[12px] text-gri-500 italic">
              Manuel iletişim kaydı yok.
            </p>
          ) : (
            <>
              <ol className="relative space-y-3">
                <span
                  aria-hidden
                  className="absolute left-[14px] top-2 bottom-2 w-px bg-gri-200"
                />
                {visible.map((a) => (
                  <li key={a.id} className="relative pl-10">
                    <span
                      aria-hidden
                      className="absolute left-2 top-1.5 grid place-items-center w-6 h-6 rounded-full bg-white ring-2 ring-gri-200 text-[12px]"
                    >
                      {CHANNEL_EMOJI[a.channel]}
                    </span>
                    <div className="rounded-lg bg-white ring-1 ring-gri-200 p-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="font-semibold text-[12.5px] text-lacivert">
                          {CHANNEL_LABEL[a.channel]}
                        </span>
                        <span className="text-[11px] text-gri-500">
                          {timeAgo(a.created_at)}
                        </span>
                      </div>
                      <p className="text-[12px] text-gri-700 mt-1 leading-relaxed whitespace-pre-wrap">
                        {a.summary}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              {items.length > 5 && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="text-[12px] font-semibold text-pim-mercan hover:underline"
                >
                  {expanded
                    ? "Daha az göster"
                    : `Tümünü göster (${items.length})`}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** RPC aktivite ile birleştirmek için dönüştürücü */
export function manualActivityToTimelineItem(entry: CustomerActivityLogEntry) {
  return {
    ref_id: entry.id,
    user_id: entry.customer_id,
    created_at: entry.created_at,
    kind: "manual_contact",
    title: CHANNEL_LABEL[entry.channel],
    detail: entry.summary,
    emoji: CHANNEL_EMOJI[entry.channel],
  };
}

export { CHANNEL_LABEL as CUSTOMER_ACTIVITY_CHANNEL_LABEL };
