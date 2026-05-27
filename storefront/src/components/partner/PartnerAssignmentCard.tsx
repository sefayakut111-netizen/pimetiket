"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  formatDeliveryCountdown,
  isAssignmentOverdue,
} from "@/lib/fason/assignment-utils";
import { urgentReasonLabel, type UrgentReason } from "@/lib/fason/urgent-assignment";
import { PartnerStatusPill } from "./PartnerStatusPill";
import { PartnerStatusActions } from "./PartnerStatusActions";
import { ProductionDownloadBar } from "./ProductionDownloadBar";
import { PartnerCountdownTimer } from "./PartnerCountdownTimer";

export interface PartnerAssignmentItem {
  id: string;
  title: string;
  product: string;
  qty: number;
  width?: number;
  height?: number;
  proof_status: string;
  design_file_id: string | null;
  has_cutline: boolean;
}

export interface PartnerAssignmentRow {
  assignment_id: string;
  order_id: string;
  status: string;
  assigned_at: string | null;
  estimated_delivery: string | null;
  sla_deadline?: string | null;
  is_urgent?: boolean;
  urgent_reason?: UrgentReason | null;
  hours_left: number | null;
  title: string;
  item_count: number;
  items: PartnerAssignmentItem[];
}

interface PartnerAssignmentCardProps {
  row: PartnerAssignmentRow;
  defaultExpanded?: boolean;
  showStatusActions?: boolean;
  onRefresh?: () => void;
  onError?: (message: string) => void;
}

export function PartnerAssignmentCard({
  row,
  defaultExpanded = false,
  showStatusActions = true,
  onRefresh,
  onError,
}: PartnerAssignmentCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [status, setStatus] = useState(row.status);
  const deadline = row.sla_deadline ?? row.estimated_delivery;
  const overdue = isAssignmentOverdue(status, deadline);
  const isUrgent = !!row.urgent_reason;
  const firstItem = row.items[0];

  return (
    <article
      className={cn(
        "rounded-2xl border bg-white p-4 shadow-sm transition-colors",
        isUrgent && "border-l-4 border-l-kirmizi",
        isUrgent
          ? "border-kirmizi/40 bg-kirmizi-soft/10"
          : overdue
            ? "border-kirmizi/40 bg-kirmizi-soft/20"
            : status === "issue"
              ? "border-sari/50 bg-sari-soft/30"
              : "border-gri-200 hover:border-pim-mercan/30"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/partner/siparisler/${row.order_id}`}
              className="font-mono text-[12px] font-semibold text-pim-mercan hover:underline"
            >
              #{row.order_id.slice(-8)}
            </Link>
            <PartnerStatusPill status={status} />
            {isUrgent && row.urgent_reason && (
              <span className="rounded-full bg-kirmizi-soft px-2 py-0.5 text-[10px] font-bold text-kirmizi">
                {urgentReasonLabel(row.urgent_reason)}
              </span>
            )}
          </div>
          <h3 className="mt-1 truncate text-[15px] font-semibold text-lacivert">
            {row.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-gri-600">
            <span>{row.item_count} kalem</span>
            <span
              className={cn(
                overdue ? "font-semibold text-kirmizi" : "text-gri-700"
              )}
            >
              {formatDeliveryCountdown(row.hours_left)}
            </span>
            {deadline && (
              <span className="flex items-center gap-1">
                Kalan:{" "}
                <PartnerCountdownTimer deadline={deadline} />
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/partner/siparisler/${row.order_id}`}
            className="inline-flex min-h-[40px] items-center rounded-xl bg-pim-mercan px-4 text-[12.5px] font-semibold text-white hover:bg-pim-mercan/90"
          >
            Siparişi aç
          </Link>
          {row.items.length > 1 && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="inline-flex min-h-[40px] items-center rounded-xl border border-gri-200 px-3 text-[12px] font-semibold text-gri-700 hover:border-lacivert"
            >
              {expanded ? "Gizle" : "Kalemler"}
            </button>
          )}
        </div>
      </div>

      {firstItem && row.items.length === 1 && (
        <div className="mt-3 border-t border-gri-100 pt-3">
          <ProductionDownloadBar
            orderId={row.order_id}
            itemId={firstItem.id}
            designFileId={firstItem.design_file_id}
            hasCutline={firstItem.has_cutline}
            compact
            onError={onError}
          />
        </div>
      )}

      {expanded && row.items.length > 1 && (
        <ul className="mt-3 space-y-3 border-t border-gri-100 pt-3">
          {row.items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-gri-100 bg-gri-50/50 p-3"
            >
              <p className="text-[13px] font-semibold text-lacivert">
                {item.title}
              </p>
              <p className="text-[11px] text-gri-600">{item.qty} adet</p>
              <div className="mt-2">
                <ProductionDownloadBar
                  orderId={row.order_id}
                  itemId={item.id}
                  designFileId={item.design_file_id}
                  hasCutline={item.has_cutline}
                  compact
                  onError={onError}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {showStatusActions && (
        <div className="mt-3 border-t border-gri-100 pt-3">
          <PartnerStatusActions
            orderId={row.order_id}
            status={status}
            compact
            onUpdated={(s) => {
              setStatus(s);
              onRefresh?.();
            }}
            onError={onError}
          />
        </div>
      )}
    </article>
  );
}
