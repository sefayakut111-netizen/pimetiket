export interface FasonPartner {
  id: string;
  name: string;
  short_name?: string | null;
  city?: string | null;
  town?: string | null;
  status?: "active" | "paused" | "terminated";
  status_reason?: string | null;
  express_lead_time_days?: number | null;
  min_order_amount_try?: number | null;
  payment_term?: string | null;
  iban?: string | null;
  contract_pdf_url?: string | null;
  contract_uploaded_at?: string | null;
  contact_email: string;
  contact_whatsapp: string | null;
  contact_person: string | null;
  specialties: string[];
  default_lead_days: number;
  cached_score: number | null;
  score_updated_at: string | null;
  active: boolean;
  contract_signed_at: string | null;
  notes: string | null;
  created_at: string;
  active_order_count?: number;
  contacts?: Array<{
    role: string;
    name: string;
    email: string;
    phone_e164: string;
    auto_notification?: boolean;
  }>;
  capabilities?: Array<{
    id: string;
    capability_type: "product_type" | "material";
    capability_value: string;
    is_verified?: boolean;
  }>;
}

export interface AssignmentRow {
  id: string;
  order_id: string;
  fason_partner_id: string;
  status: string;
  assigned_at: string | null;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  sent_at?: string | null;
  acknowledged_at?: string | null;
  in_production_at?: string | null;
  ready_at?: string | null;
  shipped_at?: string | null;
  issue_category?: string | null;
  issue_description?: string | null;
  issue_reported_at?: string | null;
  tracking_number?: string | null;
  tracking_company?: string | null;
  tracking_url?: string | null;
  customer_name?: string;
  order_status?: string | null;
  order_total?: number | null;
}

export type JobsFilter = "active" | "all" | "completed" | "issue";
export type PartnerDetailTab = "jobs" | "partner" | "history";

export const CAPABILITY_LABEL: Record<string, string> = {
  roll_label: "Rulo",
  sheet_label: "Tabaka",
  sticker: "Sticker",
  paper: "Kağıt",
  transparent: "Şeffaf",
  metallic: "Metalize",
  holographic: "Holografik",
};

export const ACTIVE_ASSIGNMENT_STATUSES = new Set([
  "assigned",
  "sent",
  "acknowledged",
  "in_production",
  "ready",
  "issue",
]);

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function isAssignmentOverdue(a: AssignmentRow): boolean {
  if (!a.estimated_delivery || !ACTIVE_ASSIGNMENT_STATUSES.has(a.status)) {
    return false;
  }
  return new Date(a.estimated_delivery).getTime() < Date.now();
}

/** Yetkinlik chip renkleri — ürün tipi / malzeme tutarlılığı */
export function capabilityChipClassName(
  capabilityType: "product_type" | "material",
  capabilityValue: string
): string {
  const base =
    "inline-flex items-center h-[22px] px-2.5 rounded-full text-[11px] font-semibold";
  if (capabilityType === "material") {
    return `${base} bg-gri-100 text-lacivert`;
  }
  if (capabilityValue === "sticker") {
    return `${base} bg-pim-mercan-tint text-pim-mercan`;
  }
  return `${base} bg-lacivert/10 text-lacivert`;
}
