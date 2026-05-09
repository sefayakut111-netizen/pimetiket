/**
 * Customer-facing cart store — /sticker ve /etiket'ten "Sepete Ekle" ile
 * eklenir, /sepet ve /odeme bu store'u okur.
 *
 * Admin'in pricing-cart.ts'inden AYRI:
 *   - Admin sepeti operatör tool'u (max 50 item, baseCost/profit detay)
 *   - Customer sepeti müşteri çantası (max 20 item, sadece display alanları)
 *
 * Auth + DB geldiğinde server-side cart'a swap olur.
 */

const STORAGE_KEY = "pim_customer_cart_v1";
const MAX_ITEMS = 20;

// ============================================================
// Types
// ============================================================

export type CustomerProduct = "sticker" | "etiket";

export interface CustomerCartItem {
  /** Stable id */
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

  /** Eklendi tarih (timestamp) */
  addedAt: number;
}

export interface CustomerCartSummary {
  items: CustomerCartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  itemCount: number;
}

// Kargo eşiği — 1500 TL üzeri ücretsiz
export const FREE_SHIPPING_THRESHOLD = 1500;
export const SHIPPING_FEE = 49;

// ============================================================
// Storage
// ============================================================

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listCustomerCart(): CustomerCartItem[] {
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

function writeCustomerCart(items: CustomerCartItem[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("pim_customer_cart_updated"));
  } catch {
    // localStorage full — silently
  }
}

// ============================================================
// CRUD
// ============================================================

export function addToCustomerCart(
  item: Omit<CustomerCartItem, "id" | "addedAt">
):
  | { ok: true; item: CustomerCartItem }
  | { ok: false; reason: string } {
  const items = listCustomerCart();
  if (items.length >= MAX_ITEMS) {
    return {
      ok: false,
      reason: `Sepet dolu — max ${MAX_ITEMS} ürün eklenebilir.`,
    };
  }

  const fresh: CustomerCartItem = {
    ...item,
    id: generateId(),
    addedAt: Date.now(),
  };

  items.push(fresh);
  writeCustomerCart(items);
  return { ok: true, item: fresh };
}

export function removeFromCustomerCart(id: string): void {
  const items = listCustomerCart().filter((i) => i.id !== id);
  writeCustomerCart(items);
}

export function updateCustomerCartQty(id: string, newQty: number): void {
  const items = listCustomerCart();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  const item = items[idx];
  const safeQty = Math.max(1, Math.round(newQty));
  // Birim fiyat kullanılarak yeni toplam hesaplanır (KDV dahil)
  const newTotal = item.unit * safeQty;
  items[idx] = { ...item, qty: safeQty, total: newTotal };
  writeCustomerCart(items);
}

export function clearCustomerCart(): void {
  writeCustomerCart([]);
}

// ============================================================
// Aggregation
// ============================================================

export function summarizeCustomerCart(): CustomerCartSummary {
  const items = listCustomerCart();
  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_FEE;
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
