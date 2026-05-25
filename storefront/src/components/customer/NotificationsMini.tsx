"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { useT } from "@/lib/i18n/context";

interface Notification {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  read: boolean;
  href?: string;
}

const EVENT_ICON: Record<string, string> = {
  paid: "🟢",
  design_uploaded: "📁",
  file_uploaded: "📁",
  qc_passed: "✅",
  qc_flagged: "⚠️",
  proof_ready: "🎨",
  proof_pending: "🎨",
  proof_approved: "✅",
  shipped: "📦",
  delivered: "🎉",
  auto_refund_stale_proof: "💸",
};

export function NotificationsMini() {
  const { locale } = useT();
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    fetch("/api/customer/notifications?limit=5", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Notification[] }) => setItems(d.items ?? []))
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  const title =
    locale === "en" ? "Recent notifications" : "Son bildirimler";

  return (
    <Card padding="p-4">
      <h3 className="font-semibold text-[14px] mb-3">{title}</h3>
      <div className="space-y-2">
        {items.map((n) => {
          const inner = (
            <div className="flex items-start gap-2 text-[12px] hover:bg-gri-50 rounded-md p-1 -mx-1 transition-colors">
              <span className="shrink-0 mt-0.5">
                {EVENT_ICON[n.type] ?? "📋"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-gri-700 leading-snug">{n.message}</div>
                <div className="text-[10.5px] text-gri-400 mt-0.5">
                  {new Date(n.createdAt).toLocaleDateString(
                    locale === "en" ? "en-US" : "tr-TR",
                    {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Europe/Istanbul",
                    }
                  )}
                </div>
              </div>
            </div>
          );
          return n.href ? (
            <Link key={n.id} href={n.href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={n.id}>{inner}</div>
          );
        })}
      </div>
    </Card>
  );
}
