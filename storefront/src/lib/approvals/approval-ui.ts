import type { ApprovalRequestStatus } from "@/lib/approvals/types";

export const APPROVAL_STATUS_BADGE: Record<
  ApprovalRequestStatus,
  { label: string; bg: string; color: string }
> = {
  pending: {
    label: "Onay bekliyor",
    bg: "bg-sari-soft",
    color: "text-sari-koyu",
  },
  approved: {
    label: "Onaylandı",
    bg: "bg-yesil-soft",
    color: "text-yesil-koyu",
  },
  rejected: {
    label: "Değişiklik istendi",
    bg: "bg-pim-mercan-tint",
    color: "text-pim-mercan",
  },
  cancelled: {
    label: "İptal edildi",
    bg: "bg-gri-100",
    color: "text-gri-700",
  },
};

export function approvalSourceLabel(source: string): string {
  return source === "partner" ? "Fason partner" : "Pim Etiket";
}

export function formatApprovalDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}
