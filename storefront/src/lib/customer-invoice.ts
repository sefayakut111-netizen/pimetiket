/**
 * Customer invoice profiles — Supabase wire.
 *
 * Migration 044: customer_invoice_profiles tablosu.
 * MAX 2 kurumsal fatura kaydı / kullanıcı (trigger enforced).
 *
 * Hibrit: auth YOKSA hepsi no-op.
 *
 * Sefa 17 May UX denetim:
 * Kullanıcının birden fazla kurumsal fatura profili kaydedebilmesi
 * (örn: kişisel şirketi + babasının şirketi).
 */

import { createClient } from "./supabase/client";
import { getCurrentUser } from "./supabase/auth-bridge";

// ============================================================
// Types
// ============================================================

export interface CustomerInvoiceProfile {
  id: string;
  label: string | null;
  vkn: string;
  companyName: string;
  taxOffice: string;
  companyAddress: string;
  isDefault: boolean;
  createdAt: string;
}

interface DbInvoiceProfileRow {
  id: string;
  user_id: string;
  label: string | null;
  vkn: string;
  company_name: string;
  tax_office: string;
  company_address: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

function rowToProfile(r: DbInvoiceProfileRow): CustomerInvoiceProfile {
  return {
    id: r.id,
    label: r.label,
    vkn: r.vkn,
    companyName: r.company_name,
    taxOffice: r.tax_office,
    companyAddress: r.company_address,
    isDefault: r.is_default,
    createdAt: r.created_at,
  };
}

// ============================================================
// CRUD
// ============================================================

export async function listMyInvoiceProfiles(): Promise<
  CustomerInvoiceProfile[]
> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customer_invoice_profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[invoice] list error:", error);
    return [];
  }
  return (data as DbInvoiceProfileRow[]).map(rowToProfile);
}

export interface InvoiceProfileInput {
  label?: string | null;
  vkn: string;
  companyName: string;
  taxOffice: string;
  companyAddress: string;
  isDefault?: boolean;
}

/**
 * Yeni kurumsal fatura profili oluştur.
 * MAX 2 limit DB trigger ile enforce edilir, hata code:
 * "invoice_profile_limit_reached"
 */
export async function createMyInvoiceProfile(
  payload: InvoiceProfileInput
): Promise<
  | { ok: true; profile: CustomerInvoiceProfile }
  | { ok: false; reason: "limit_reached" | "auth_required" | "unknown" }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth_required" };
  const supabase = createClient();

  const insertVals = {
    user_id: user.id,
    label: payload.label ?? null,
    vkn: payload.vkn,
    company_name: payload.companyName,
    tax_office: payload.taxOffice,
    company_address: payload.companyAddress,
    is_default: payload.isDefault ?? false,
  };

  const { data, error } = await supabase
    .from("customer_invoice_profiles")
    .insert([insertVals] as never)
    .select("*")
    .single();

  if (error) {
    if (error.message?.includes("invoice_profile_limit_reached")) {
      return { ok: false, reason: "limit_reached" };
    }
    console.error("[invoice] create error:", error);
    return { ok: false, reason: "unknown" };
  }
  if (!data) return { ok: false, reason: "unknown" };

  return { ok: true, profile: rowToProfile(data as DbInvoiceProfileRow) };
}

export async function updateMyInvoiceProfile(
  id: string,
  payload: Partial<InvoiceProfileInput>
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const supabase = createClient();
  const updates: Record<string, unknown> = {};
  if (payload.label !== undefined) updates.label = payload.label;
  if (payload.vkn !== undefined) updates.vkn = payload.vkn;
  if (payload.companyName !== undefined)
    updates.company_name = payload.companyName;
  if (payload.taxOffice !== undefined) updates.tax_office = payload.taxOffice;
  if (payload.companyAddress !== undefined)
    updates.company_address = payload.companyAddress;
  if (payload.isDefault !== undefined) updates.is_default = payload.isDefault;

  const { error } = await supabase
    .from("customer_invoice_profiles")
    .update(updates as never)
    .eq("id", id);
  if (error) {
    console.error("[invoice] update error:", error);
    return { ok: false };
  }
  return { ok: true };
}

export async function deleteMyInvoiceProfile(
  id: string
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const supabase = createClient();
  const { error } = await supabase
    .from("customer_invoice_profiles")
    .delete()
    .eq("id", id);
  return { ok: !error };
}

export async function setDefaultInvoiceProfile(
  id: string
): Promise<{ ok: boolean }> {
  // Trigger fn_invoice_profile_single_default zaten diğerlerini false yapar
  return updateMyInvoiceProfile(id, { isDefault: true });
}
