/**
 * Customer profile + addresses + invoice info — Supabase wire.
 *
 * Hibrit: auth YOKSA hepsi no-op (UI default değer gösterir, kayıt
 * etmez). Auth VARSA DB CRUD.
 *
 * Tablolar:
 *   - profiles (display_name, phone, invoice_type, tc, vkn, ...)
 *   - addresses (id, label, name, addr, city, phone, is_default)
 */

import { createClient } from "./supabase/client";
import { getCurrentUser } from "./supabase/auth-bridge";

// ============================================================
// Profile
// ============================================================

export interface CustomerProfile {
  id: string;
  displayName: string | null;
  phone: string | null;
  invoiceType: "individual" | "corporate" | null;
  tc: string | null;
  vkn: string | null;
  companyName: string | null;
  taxOffice: string | null;
  invoiceFormat: "earchive" | "einvoice" | null;
  locale: "tr" | "en" | null;
  emailVerifiedAt: string | null;
}

interface DbProfileRow {
  id: string;
  display_name: string | null;
  phone: string | null;
  invoice_type: "individual" | "corporate" | null;
  tc: string | null;
  vkn: string | null;
  company_name: string | null;
  tax_office: string | null;
  invoice_format: "earchive" | "einvoice" | null;
  locale: "tr" | "en" | null;
  email_verified_at: string | null;
}

function rowToProfile(r: DbProfileRow): CustomerProfile {
  return {
    id: r.id,
    displayName: r.display_name,
    phone: r.phone,
    invoiceType: r.invoice_type,
    tc: r.tc,
    vkn: r.vkn,
    companyName: r.company_name,
    taxOffice: r.tax_office,
    invoiceFormat: r.invoice_format,
    locale: r.locale,
    emailVerifiedAt: r.email_verified_at,
  };
}

export async function getMyProfile(): Promise<CustomerProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error || !data) {
    console.error("[profile] getMyProfile error:", error);
    return null;
  }
  return rowToProfile(data as DbProfileRow);
}

export interface ProfileUpdatePayload {
  displayName?: string | null;
  phone?: string | null;
}

export async function updateMyProfile(
  payload: ProfileUpdatePayload
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth_required" };
  const supabase = createClient();
  const updates: Record<string, unknown> = {};
  if (payload.displayName !== undefined)
    updates.display_name = payload.displayName;
  if (payload.phone !== undefined) updates.phone = payload.phone;
  const { error } = await supabase
    .from("profiles")
    .update(updates as never)
    .eq("id", user.id);
  if (error) {
    console.error("[profile] update error:", error);
    return { ok: false, reason: error.message };
  }
  return { ok: true };
}

// ============================================================
// Invoice info
// ============================================================

export interface InvoiceInfo {
  type: "individual" | "corporate";
  tc?: string | null;
  vkn?: string | null;
  companyName?: string | null;
  taxOffice?: string | null;
  invoiceFormat?: "earchive" | "einvoice" | null;
}

export async function updateMyInvoiceInfo(
  info: InvoiceInfo
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth_required" };
  const supabase = createClient();
  const updates: Record<string, unknown> = {
    invoice_type: info.type,
    tc: info.type === "individual" ? info.tc ?? null : null,
    vkn: info.type === "corporate" ? info.vkn ?? null : null,
    company_name: info.type === "corporate" ? info.companyName ?? null : null,
    tax_office: info.type === "corporate" ? info.taxOffice ?? null : null,
    invoice_format: info.invoiceFormat ?? "earchive",
  };
  const { error } = await supabase
    .from("profiles")
    .update(updates as never)
    .eq("id", user.id);
  if (error) {
    console.error("[profile] updateInvoice error:", error);
    return { ok: false, reason: error.message };
  }
  return { ok: true };
}

// ============================================================
// Addresses
// ============================================================

export interface CustomerAddress {
  id: string;
  label: string | null;
  name: string;
  addr: string;
  city: string;
  phone: string;
  isDefault: boolean;
  createdAt: string;
}

interface DbAddressRow {
  id: string;
  user_id: string;
  label: string | null;
  name: string;
  addr: string;
  city: string;
  phone: string;
  is_default: boolean;
  created_at: string;
}

function rowToAddress(r: DbAddressRow): CustomerAddress {
  return {
    id: r.id,
    label: r.label,
    name: r.name,
    addr: r.addr,
    city: r.city,
    phone: r.phone,
    isDefault: r.is_default,
    createdAt: r.created_at,
  };
}

export async function listMyAddresses(): Promise<CustomerAddress[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[addresses] list error:", error);
    return [];
  }
  return (data as DbAddressRow[]).map(rowToAddress);
}

export interface AddressInput {
  label?: string | null;
  name: string;
  addr: string;
  city: string;
  phone: string;
  isDefault?: boolean;
}

export async function createMyAddress(
  payload: AddressInput
): Promise<CustomerAddress | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = createClient();
  // Default işaretliyse mevcut default'u kaldır
  if (payload.isDefault) {
    await supabase
      .from("addresses")
      .update({ is_default: false } as never)
      .eq("user_id", user.id);
  }
  const insertVals = {
    user_id: user.id,
    label: payload.label ?? null,
    name: payload.name,
    addr: payload.addr,
    city: payload.city,
    phone: payload.phone,
    is_default: payload.isDefault ?? false,
  };
  const { data, error } = await supabase
    .from("addresses")
    .insert([insertVals] as never)
    .select("*")
    .single();
  if (error || !data) {
    console.error("[addresses] create error:", error);
    return null;
  }
  return rowToAddress(data as DbAddressRow);
}

export async function updateMyAddress(
  id: string,
  payload: Partial<AddressInput>
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const supabase = createClient();
  if (payload.isDefault) {
    await supabase
      .from("addresses")
      .update({ is_default: false } as never)
      .eq("user_id", user.id);
  }
  const updates: Record<string, unknown> = {};
  if (payload.label !== undefined) updates.label = payload.label;
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.addr !== undefined) updates.addr = payload.addr;
  if (payload.city !== undefined) updates.city = payload.city;
  if (payload.phone !== undefined) updates.phone = payload.phone;
  if (payload.isDefault !== undefined) updates.is_default = payload.isDefault;
  const { error } = await supabase
    .from("addresses")
    .update(updates as never)
    .eq("id", id);
  if (error) {
    console.error("[addresses] update error:", error);
    return { ok: false };
  }
  return { ok: true };
}

export async function setDefaultAddress(id: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const supabase = createClient();
  // 2 step: önce hepsini false, sonra bu satırı true
  await supabase
    .from("addresses")
    .update({ is_default: false } as never)
    .eq("user_id", user.id);
  const { error } = await supabase
    .from("addresses")
    .update({ is_default: true } as never)
    .eq("id", id);
  return { ok: !error };
}

export async function deleteMyAddress(id: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const supabase = createClient();
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  return { ok: !error };
}
