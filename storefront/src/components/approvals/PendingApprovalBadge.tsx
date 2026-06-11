"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";

export function PendingApprovalBadge() {
  const [count, setCount] = useState(0);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/pending-approval-requests", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { count?: number; order_id?: string | null } | null) => {
        if (!d) return;
        setCount(typeof d.count === "number" ? d.count : 0);
        setOrderId(d.order_id ?? null);
      })
      .catch(() => {});
  }, []);

  if (count <= 0 || !orderId) return null;

  return (
    <Card padding="p-4" className="border-sari/40 bg-sari-soft/30">
      <Link
        href={`/onay/${orderId}`}
        className="flex items-center gap-3 text-sm font-semibold text-lacivert hover:text-pim-mercan transition min-h-[44px]"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sari-soft text-sari-koyu text-base">
          {count}
        </span>
        <span>
          {count === 1
            ? "1 görsel onayını bekliyor"
            : `${count} görsel onayını bekliyor`}
          <span className="block text-[12px] font-normal text-gri-700 mt-0.5">
            Onay görsellerini incele →
          </span>
        </span>
      </Link>
    </Card>
  );
}
