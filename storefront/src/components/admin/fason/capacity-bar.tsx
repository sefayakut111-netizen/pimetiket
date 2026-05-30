"use client";

import { cn } from "@/lib/cn";
import {
  DEFAULT_MAX_CONCURRENT_ORDERS,
  type FasonPartner,
} from "@/components/admin/fason/fason-types";

export function partnerMaxCapacity(partner: FasonPartner): number {
  const raw = partner.max_concurrent_orders;
  if (typeof raw === "number" && raw > 0) return raw;
  return DEFAULT_MAX_CONCURRENT_ORDERS;
}

export function CapacityBar({
  partner,
  className,
}: {
  partner: FasonPartner;
  className?: string;
}) {
  const active = partner.active_order_count ?? 0;
  const max = partnerMaxCapacity(partner);
  const pct = max > 0 ? Math.min(100, Math.round((active / max) * 100)) : 0;
  const barTone =
    pct >= 90 ? "bg-kirmizi" : pct >= 70 ? "bg-sari-koyu" : "bg-yesil";

  return (
    <div className={cn("min-w-[140px]", className)}>
      <div className="flex justify-between text-[11px] text-gri-600 mb-1 tabular-nums">
        <span>
          {active}/{max} aktif (%{pct})
        </span>
      </div>
      <div
        className="h-1.5 rounded-full bg-gri-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={active}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`Kapasite dolulugu ${active} / ${max}`}
      >
        <div
          className={cn("h-full rounded-full transition-all", barTone)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
