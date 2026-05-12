/**
 * Customer-facing cart store — /sticker ve /etiket'ten "Sepete Ekle" ile
 * eklenir, /sepet ve /odeme bu store'u okur.
 *
 * Hibrit strateji:
 *   - Auth YOKSA  → localStorage (guest cart)
 *   - Auth VARSA  → Supabase `cart_items` (multi-device sync, RLS)
 *   - Login OLDU  → localStorage cart DB'ye merge → localStorage temiz
 *
 * Async API'ler `await` gerektirir; sync API'ler local cache döner
 * (UI ilk paint için).
 *
 * Admin'in pricing-cart.ts'inden AYRI:
 *   - Admin sepeti operatör tool'u (max 50 item, baseCost/profit detay)
 *   - Customer sepeti müşteri çantası (max 20 item, sadece display alanları)
 */

import { createClient } from "./supabase/client";
import type { Database } from "./supabase/types";
import {
  getCurrentUser,
  isLoggedInSync,
  bindAuthEvents,
} from "./supabase/auth-bridge";

const STORAGE_KEY = "pim_customer_cart_v1";
const MAX_ITEMS = 20;

// ============================================================
// Types — DB row ile uyumlu
// ============================================================

export type CustomerProduct = "sticker" | "etiket";

export interface CustomerCartItem {
  /** Stable id (UUID — DB veya local) */
  id: string;
  /** Ürün tipi */
  product: CustomerProduct;
  /** Ürün başlığı — örn. "Sticker · Vinil + parlak" */
  title: string;
  /** Configürasyon özeti — örn. "60×60mm · Yuvarlak · Düz köşe" */
  config: string;
  /** Boyut */
  width: number;
  height: number;
  /** Adet (talep edilen) */
  qty: number;
  /** Birim fiyat — KDV dahil */
  unit: number;
  /** Toplam fiyat — KDV dahil */
  total: number;

  // Sticker-specific (opsiyonel)
  shape?: "square" | "circle" | "ozel" | "die";
  cut?: "tabaka" | "diecut";
  softCorners?: boolean;
  material?: "vinil" | "transparan" | "holo" | "simli";
  finish?: "parlak" | "mat" | "yok";
  /** Sticker overrun — hediye adet */
  hediyeAdet?: number;

  // Etiket-specific (opsiyonel)
  materialId?: string;
  coatingId?: string;
  customizationId?: string;
  /** Etiket sarım yönü 1-8 */
  winding?: number;

  // Pre-purchase tasarım — sepete eklemeden önce yüklenmiş tasarım dosyası
  // (design_temp_uploads.id). Ödeme sonrası design_files'a promote edilir.
  designTempId?: string;
  /** Mockup için signed URL — guest mode'da blob, auth'da Supabase 1h URL */
  designPreviewUrl?: string;
  /** Tasarım dosya adı — sepet kartında "marka-logo.pdf" göstermek için */
  designFileName?: string;

  /** Eklendi tarih (timestamp ms) */
  addedAt: number;
}

export interface CustomerCartSummary {
  items: CustomerCartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  itemCount: number;
}

// Kargo eşiği — 1000 TL üzeri ücretsiz (Sefa kararı 11 May)
// Bu sabit varsayılan; admin /admin/ayarlar üzerinden site_settings
// tablosundan güncelleyebilir (Migration 029).
export const FREE_SHIPPING_THRESHOLD = 1000;
export const SHIPPING_FEE = 49;

// ============================================================
// In-memory cache (sync API + UI ilk paint için)
// ============================================================

let cache: CustomerCartItem[] = [];
let cacheLoaded = false;

function notifyChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("pim_customer_cart_updated"));
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// localStorage helpers (guest mode)
// ============================================================

function readLocal(): CustomerCartItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomerCartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(items: CustomerCartItem[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage full — sessizce
  }
}

function clearLocal(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ============================================================
// DB helpers (auth mode)
// ============================================================

interface DbRow {
  id: string;
  user_id: string;
  product: CustomerProduct;
  title: string;
  config: string;
  width: number;
  height: number;
  qty: number;
  unit: number;
  total: number;
  shape: string | null;
  cut: string | null;
  soft_corners: boolean | null;
  material: string | null;
  finish: string | null;
  hediye_adet: number | null;
  material_id: string | null;
  coating_id: string | null;
  customization_id: string | null;
  winding: number | null;
  design_temp_id: string | null;
  added_at: string;
}

function rowToItem(r: DbRow): CustomerCartItem {
  return {
    id: r.id,
    product: r.product,
    title: r.title,
    config: r.config,
    width: r.width,
    height: r.height,
    qty: r.qty,
    unit: Number(r.unit),
    total: Number(r.total),
    shape: r.shape as CustomerCartItem["shape"] | undefined,
    cut: r.cut as CustomerCartItem["cut"] | undefined,
    softCorners: r.soft_corners ?? undefined,
    material: r.material as CustomerCartItem["material"] | undefined,
    finish: r.finish as CustomerCartItem["finish"] | undefined,
    hediyeAdet: r.hediye_adet ?? undefined,
    materialId: r.material_id ?? undefined,
    coatingId: r.coating_id ?? undefined,
    customizationId: r.customization_id ?? undefined,
    winding: r.winding ?? undefined,
    designTempId: r.design_temp_id ?? undefined,
    addedAt: new Date(r.added_at).getTime(),
  };
}

type CartInsert = Database["public"]["Tables"]["cart_items"]["Insert"];

function itemToInsert(
  it: Omit<CustomerCartItem, "id" | "addedAt">,
  userId: string
): CartInsert {
  return {
    user_id: userId,
    product: it.product,
    title: it.title,
    config: it.config,
    width: it.width,
    height: it.height,
    qty: it.qty,
    unit: it.unit,
    total: it.total,
    shape: it.shape ?? null,
    cut: it.cut ?? null,
    soft_corners: it.softCorners ?? null,
    material: it.material ?? null,
    finish: it.finish ?? null,
    hediye_adet: it.hediyeAdet ?? null,
    material_id: it.materialId ?? null,
    coating_id: it.coatingId ?? null,
    customization_id: it.customizationId ?? null,
    winding: it.winding ?? null,
    design_temp_id: it.designTempId ?? null,
  };
}

async function dbList(userId: string): Promise<CustomerCartItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: true });
  if (error) {
    console.error("[cart] dbList error:", error);
    return [];
  }
  return (data as DbRow[]).map(rowToItem);
}

async function dbInsert(
  userId: string,
  item: Omit<CustomerCartItem, "id" | "addedAt">
): Promise<CustomerCartItem | null> {
  const supabase = createClient();
  const insertValues = [itemToInsert(item, userId)];
  const { data, error } = await supabase
    .from("cart_items")
    .insert(insertValues as never)
    .select("*")
    .single();
  if (error) {
    console.error("[cart] dbInsert error:", error);
    return null;
  }
  return rowToItem(data as DbRow);
}

async function dbUpdateQty(id: string, qty: number, total: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("cart_items")
    .update({ qty, total } as never)
    .eq("id", id);
  if (error) console.error("[cart] dbUpdateQty error:", error);
}

async function dbDelete(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("cart_items").delete().eq("id", id);
  if (error) console.error("[cart] dbDelete error:", error);
}

async function dbClear(userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", userId);
  if (error) console.error("[cart] dbClear error:", error);
}

// ============================================================
// Cache hydration (DB veya local)
// ============================================================

/**
 * Cache'i DB veya localStorage'dan doldurur.
 * UI'da useEffect içinde 1 kez çağrılır + auth event'lerinde tekrar.
 */
export async function refreshCustomerCart(): Promise<CustomerCartItem[]> {
  const user = await getCurrentUser();
  if (user) {
    cache = await dbList(user.id);
  } else {
    cache = readLocal();
  }
  cacheLoaded = true;
  notifyChange();
  return cache;
}

/**
 * Login olduğunda guest localStorage cart'ı DB'ye merge et.
 * Çift kayıt olmasın diye benzer item'ı arar (config + product match);
 * varsa qty'leri toplar.
 */
export async function mergeGuestCartIntoDb(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const guestItems = readLocal();
  if (guestItems.length === 0) return;

  const dbItems = await dbList(user.id);
  for (const guest of guestItems) {
    const match = dbItems.find(
      (db) =>
        db.product === guest.product &&
        db.config === guest.config &&
        db.width === guest.width &&
        db.height === guest.height
    );
    if (match) {
      const newQty = match.qty + guest.qty;
      const newTotal = match.unit * newQty;
      await dbUpdateQty(match.id, newQty, newTotal);
    } else {
      const { id: _, addedAt: __, ...rest } = guest;
      void _; void __;
      await dbInsert(user.id, rest);
    }
  }
  clearLocal();
  await refreshCustomerCart();
}

// ============================================================
// Public API (sync — cache döner) + async helpers
// ============================================================

export function listCustomerCart(): CustomerCartItem[] {
  // Cache yüklenmediyse + browser'da localStorage'da varsa o dön (hızlı paint)
  if (!cacheLoaded) {
    if (!isLoggedInSync()) {
      cache = readLocal();
      cacheLoaded = true;
    }
  }
  return cache;
}

export async function addToCustomerCart(
  item: Omit<CustomerCartItem, "id" | "addedAt">
): Promise<
  | { ok: true; item: CustomerCartItem }
  | { ok: false; reason: string }
> {
  const user = await getCurrentUser();
  if (cache.length >= MAX_ITEMS) {
    return {
      ok: false,
      reason: `Sepet dolu — max ${MAX_ITEMS} ürün eklenebilir.`,
    };
  }

  if (user) {
    const inserted = await dbInsert(user.id, item);
    if (!inserted) return { ok: false, reason: "Kaydedilemedi, tekrar dene." };
    cache = [...cache, inserted];
  } else {
    const fresh: CustomerCartItem = {
      ...item,
      id: generateId(),
      addedAt: Date.now(),
    };
    cache = [...cache, fresh];
    writeLocal(cache);
  }

  notifyChange();
  // PostHog event — consent yoksa otomatik no-op
  try {
    const { track } = await import("@/lib/analytics/posthog-events");
    track("add_to_cart", {
      product: item.product,
      material: item.material ?? item.materialId ?? null,
      qty: item.qty,
      total: item.total,
    });
  } catch {
    /* silent — analytics opsiyonel */
  }
  return { ok: true, item: cache[cache.length - 1] };
}

export async function removeFromCustomerCart(id: string): Promise<void> {
  const user = await getCurrentUser();
  cache = cache.filter((i) => i.id !== id);
  if (user) {
    await dbDelete(id);
  } else {
    writeLocal(cache);
  }
  notifyChange();
}

export async function updateCustomerCartQty(
  id: string,
  newQty: number
): Promise<void> {
  const user = await getCurrentUser();
  const idx = cache.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const item = cache[idx];
  const safeQty = Math.max(1, Math.round(newQty));
  const newTotal = item.unit * safeQty;
  cache = [
    ...cache.slice(0, idx),
    { ...item, qty: safeQty, total: newTotal },
    ...cache.slice(idx + 1),
  ];

  if (user) {
    await dbUpdateQty(id, safeQty, newTotal);
  } else {
    writeLocal(cache);
  }
  notifyChange();
}

export async function clearCustomerCart(): Promise<void> {
  const user = await getCurrentUser();
  cache = [];
  if (user) {
    await dbClear(user.id);
  } else {
    clearLocal();
  }
  notifyChange();
}

// ============================================================
// Aggregation (sync — cache üzerinden)
// ============================================================

export function summarizeCustomerCart(): CustomerCartSummary {
  const items = listCustomerCart();
  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const shipping =
    subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_FEE;
  return {
    items,
    subtotal,
    shipping,
    total: subtotal + shipping,
    itemCount: items.length,
  };
}

export function customerCartCount(): number {
  return listCustomerCart().length;
}

export const CUSTOMER_CART_LIMIT = MAX_ITEMS;

// ============================================================
// Auth event binding — mount edilen ilk page setup yapar
// ============================================================

let authBound = false;
export function ensureAuthBindings(): void {
  if (authBound) return;
  authBound = true;
  bindAuthEvents();
  if (typeof window !== "undefined") {
    window.addEventListener("pim_auth_signed_in", () => {
      // Login olunca localStorage'daki guest cart'ı DB'ye merge et + refresh
      void mergeGuestCartIntoDb();
    });
    window.addEventListener("pim_auth_signed_out", () => {
      cache = [];
      cacheLoaded = false;
      notifyChange();
    });
  }
}
