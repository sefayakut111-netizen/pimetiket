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
import type { Json, Tables, TablesInsert } from "./supabase/types";
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
  /** Sefa 21 May v68 Mig 073: Rulo göbek çapı mm (25, 40, 76) */
  coreSize?: number;
  /** Sefa 21 May v68 Mig 073: 1 rulodaki etiket sayısı */
  rollLabelCount?: number;

  // Pre-purchase tasarım — sepete eklemeden önce yüklenmiş tasarım dosyası
  // (design_temp_uploads.id). Ödeme sonrası design_files'a promote edilir.
  designTempId?: string;
  /** Render edilmiş preview PNG URL — Supabase Storage (auth) veya blob URL (guest).
   *  Sefa 20 May v68 Migration 072: PDF/AI → pdfjs, PSD → ag-psd, PNG/JPG → orijinal.
   *  null/undefined ise sepet UI fallback logo gösterir (PDF/AI/PSD/EPS rozeti). */
  designPreviewUrl?: string;
  /** Tasarım dosya adı — sepet kartında "marka-logo.pdf" göstermek için */
  designFileName?: string;
  /** Orijinal dosya MIME — preview yoksa hangi logo gösterileceğini belirler */
  designMimeType?: string;

  // Multi-design metadata (Sefa kuralı 15 May v4):
  // Kullanıcı 1 sipariş için N farklı tasarım yükleyebilir (max 50).
  // designTempId/PreviewUrl/FileName ANA tasarım (designs[0]).
  // Ek tasarımlar additionalDesigns'da, sepete eklemede backend
  // sipariş sonrası mail ile hepsi promote edilir (yakında).
  /** Kullanıcının seçtiği tasarım adedi (1-50) — fiyat iskonto için */
  designCount?: number;
  /** Ek yüklenen tasarımlar (primary hariç). Ödeme sonrası order_designs
   *  tablosuna promote edilir (sonraki commit'te DB sync). Şu an
   *  localStorage'da tutulur, order placement aşamasında mail/admin
   *  bildirimi olarak gönderilir. */
  additionalDesigns?: Array<{
    tempId: string;
    previewUrl: string;
    fileName: string;
    sizeBytes: number;
    mimeType: string;
  }>;

  /** Ek meta — checkout recalc için çoklu özelleştirme ID'leri */
  meta?: Record<string, unknown>;

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

// Kargo eşiği — 500 ₺ üzeri ücretsiz (Sefa kararı 18 May — KB ve SSS
// ile senkron). Eski 1000 ₺ değeri Pim AI + /sss'le tutarsızdı.
// Bu sabit varsayılan; admin /admin/ayarlar üzerinden site_settings
// tablosundan güncelleyebilir (Migration 029).
export const FREE_SHIPPING_THRESHOLD = 500;
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

type CartRow = Tables<"cart_items">;
type CartInsert = TablesInsert<"cart_items">;

function rowToItem(r: CartRow): CustomerCartItem {
  return {
    id: r.id,
    product: r.product as CustomerProduct,
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
    coreSize: r.core_size ?? undefined,
    rollLabelCount: r.roll_label_count ?? undefined,
    designTempId: r.design_temp_id ?? undefined,
    designCount: r.design_count ?? undefined,
    additionalDesigns:
      r.additional_designs &&
      Array.isArray(r.additional_designs) &&
      r.additional_designs.length > 0
        ? (r.additional_designs as CustomerCartItem["additionalDesigns"])
        : undefined,
    // Migration 072 (Sefa 20 May v68): design preview
    designPreviewUrl: r.design_preview_url ?? undefined,
    designFileName: r.design_file_name ?? undefined,
    designMimeType: r.design_mime_type ?? undefined,
    addedAt: new Date(r.added_at).getTime(),
  };
}

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
    // Sefa 20 May v68 (bug fix): cart_items.design_temp_id UUID kolonu.
    // PendingDesign local-only id "local-{uuid}" prefix ile gelir (henüz
    // upload yok) — UUID'yi bozar (22P02). Local id ise null gönder, gerçek
    // upload sonra additionalDesigns JSONB üzerinden bağlanır.
    design_temp_id:
      it.designTempId && !it.designTempId.startsWith("local-")
        ? it.designTempId
        : null,
    design_count: it.designCount ?? null,
    additional_designs: (it.additionalDesigns ?? null) as Json | null,
    design_preview_url: it.designPreviewUrl ?? null,
    design_file_name: it.designFileName ?? null,
    design_mime_type: it.designMimeType ?? null,
    core_size: it.coreSize ?? null,
    roll_label_count: it.rollLabelCount ?? null,
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
  return (data ?? []).map(rowToItem);
}

async function dbInsert(
  userId: string,
  item: Omit<CustomerCartItem, "id" | "addedAt">
): Promise<CustomerCartItem | null> {
  const supabase = createClient();
  const insertValues = itemToInsert(item, userId);
  const { data, error } = await supabase
    .from("cart_items")
    .insert(insertValues)
    .select("*")
    .single();
  if (error) {
    console.error("[cart] dbInsert error:", error, "payload:", insertValues);
    return null;
  }
  return rowToItem(data);
}

async function dbUpdateQty(id: string, qty: number, total: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("cart_items")
    .update({ qty, total })
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
  let dbCount = dbItems.length;
  for (const guest of guestItems) {
    if (dbCount >= MAX_ITEMS) {
      console.warn(
        `[cart] mergeGuestCartIntoDb: max ${MAX_ITEMS} items — kalan guest item atlandi`
      );
      break;
    }
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
      dbCount += 1;
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
  if (user && !cacheLoaded) {
    await refreshCustomerCart();
  }
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
