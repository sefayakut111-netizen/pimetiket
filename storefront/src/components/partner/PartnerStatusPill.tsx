"use client";

import {
  getAssignmentStatusLabel,
  type AssignmentStatus,
} from "@/lib/fason/status-labels";
import { cn } from "@/lib/cn";

export function PartnerStatusPill({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const meta = getAssignmentStatusLabel(status as AssignmentStatus, "fason");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        meta.bg,
        meta.color,
        className
      )}
    >
      {meta.label}
    </span>
  );
}
