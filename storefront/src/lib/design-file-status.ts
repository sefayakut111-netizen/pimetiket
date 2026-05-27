/**
 * design_file_status enum — DB + types.ts ile uyumlu.
 * Filtre UI ve /api/admin/designs query validation tek kaynak.
 */
import type { Enums } from "@/lib/supabase/types";

export type DesignFileStatus = Enums<"design_file_status">;

/** Liste filtresi (superseded hariç — API zaten exclude eder) */
export const DESIGN_FILE_STATUS_VALUES = [
  "uploaded",
  "analyzing",
  "qc_passed",
  "qc_warned",
  "qc_failed",
  "approved",
] as const satisfies readonly DesignFileStatus[];

/** fn_order_has_design / upload-status ile aynı küme — kullanılabilir tasarım */
export const USABLE_DESIGN_STATUSES = [
  "uploaded",
  "analyzing",
  "qc_warned",
  "qc_passed",
  "approved",
] as const satisfies readonly DesignFileStatus[];

export type DesignFileStatusFilter = "all" | (typeof DESIGN_FILE_STATUS_VALUES)[number];

export const DESIGN_FILE_STATUS_META: Record<
  (typeof DESIGN_FILE_STATUS_VALUES)[number],
  { label: string; color: string; bg: string }
> = {
  uploaded: {
    label: "Yüklendi",
    color: "text-lacivert",
    bg: "bg-gri-100",
  },
  analyzing: {
    label: "AI işliyor",
    color: "text-pim-mercan",
    bg: "bg-pim-mercan-tint",
  },
  qc_passed: {
    label: "AI ✓",
    color: "text-yesil",
    bg: "bg-yesil-soft",
  },
  qc_warned: {
    label: "Uyarı",
    color: "text-sari-koyu",
    bg: "bg-sari-soft",
  },
  qc_failed: {
    label: "Sorunlu",
    color: "text-kirmizi",
    bg: "bg-gri-100",
  },
  approved: {
    label: "Onaylı",
    color: "text-yesil",
    bg: "bg-yesil-soft",
  },
};

export const DESIGN_FILE_STATUS_FILTERS: {
  id: DesignFileStatusFilter;
  label: string;
}[] = [
  { id: "all", label: "Tümü" },
  ...DESIGN_FILE_STATUS_VALUES.map((id) => ({
    id,
    label: DESIGN_FILE_STATUS_META[id].label,
  })),
];

/** Admin tasarim karti — AI kontrol ozeti */
export function formatAiCheckSummary(
  status: string,
  flags: Array<{ kind: string; message: string }>
): string | null {
  if (status === "uploaded" || status === "analyzing") return null;

  const errors = flags.filter((f) => f.kind === "error");
  const warnings = flags.filter((f) => f.kind === "warning");
  const ok = flags.filter((f) => f.kind === "ok");

  if (status === "qc_passed" || status === "approved") {
    const parts = ok.map((f) => f.message).filter(Boolean).slice(0, 2);
    return parts.length > 0 ? parts.join(" · ") : "Kontrol tamam";
  }

  if (errors.length > 0) return errors[0].message;
  if (warnings.length > 0) return warnings[0].message;
  if (status === "qc_failed") return "Sorun tespit edildi";
  if (status === "qc_warned") return "Uyarı var";
  return null;
}
