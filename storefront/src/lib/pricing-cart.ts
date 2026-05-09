/**
 * Pricing cart store — admin tool için lokalstorage sepet.
 *
 * Kullanım:
 *   - Operatör fiyat hesaplar → "Sepete Ekle" → Cart'a düşer
 *   - Cart hem sticker hem etiket item'ları tutabilir
 *   - Aynı boyut + aynı ürün grubuna girer → grup indirimi (cart-discount.ts)
 *   - Toplu PDF iş emri (combined work order)
 *
 * Auth + DB geldiğinde server-side cart'a swap olur (Block C.3).
 */

import {
  computeCart,
  type CartLineInput,
  type CartResult,
} from "./pricing-engine";

const STORAGE_KEY = "pim_pricing_cart_v1";
const MAX_CART_ITEMS = 50;

// ============================================================
// Types — full snapshot per item
// ============================================================

export interface CartItem {
  id: string;
  product: "sticker" | "etiket";
  /** Display name — Tasarım N (default) veya Sefa override */
  name: string;
  /** Notlar (opsiyonel) */
  notes?: string;
  /** Boyut */
  width: number;
  height: number;
  /** Müşteri talep adedi */
  requestedQty: number;
  /** Üretilen adet (sticker overrun varsa) */
  producedQty: number;
  /** KDV hariç matrah (cart-discount için) */
  preGroupSubtotal: number;
  /** KDV oranı */
  vatPct: number;
  /** Tier multiplier */
  tierMultiplier: number;
  /** Total KDV dahil — referans (display için) */
  preGroupTotal: number;
  /** Üretim modu */
  mode: "fason" | "uretim";
  /** Sticker özel */
  cut?: "tabaka" | "diecut";
  layoutMode?: "small" | "big";
  /** Etiket özel */
  materialId?: string;
  coatingId?: string;
  customizationId?: string;
  /** Geometri özet */
  rollsNeeded: number;
  totalM2: number;
  /** Cost detayları (PDF için tam snapshot) */
  baseCost: number;
  intendedProfit: number;
  actualProfit: number;
  vatAmount: number;
  total: number; // = preGroupTotal
  unitPrice: number;
  /** Eklendi tarih */
  addedAt: number;
}

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
  return `cart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listCart(): CartItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    // CustomEvent — diğer pencereler/sayfalar refresh etsin
    window.dispatchEvent(new CustomEvent("pim_cart_updated"));
  } catch {
    // localStorage dolu — silently
  }
}

// ============================================================
// CRUD
// ============================================================

export function addToCart(
  item: Omit<CartItem, "id" | "addedAt" | "name"> & { name?: string }
): { ok: true; item: CartItem } | { ok: false; reason: string } {
  const items = listCart();
  if (items.length >= MAX_CART_ITEMS) {
    return { ok: false, reason: `Sepet dolu (max ${MAX_CART_ITEMS})` };
  }

  // Default name: "Tasarım N" (sticker T1, etiket T1 etc.)
  const sameProductCount = items.filter((i) => i.product === item.product).length;
  const defaultName =
    item.name ?? `${item.product === "sticker" ? "Sticker" : "Etiket"} ${sameProductCount + 1}`;

  const newItem: CartItem = {
    ...item,
    name: defaultName,
    id: generateId(),
    addedAt: Date.now(),
  };

  items.push(newItem);
  writeCart(items);
  return { ok: true, item: newItem };
}

export function removeFromCart(id: string): void {
  const items = listCart().filter((i) => i.id !== id);
  writeCart(items);
}

export function clearCart(): void {
  writeCart([]);
}

export function updateCartItemName(id: string, name: string): void {
  const items = listCart();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx], name: name.trim() || items[idx].name };
  writeCart(items);
}

// ============================================================
// Aggregation — cart-discount.ts ile entegrasyon
// ============================================================

export interface CartSummary {
  result: CartResult;
  items: CartItem[];
  productCounts: { sticker: number; etiket: number };
}

export function summarizeCart(): CartSummary {
  const items = listCart();
  const cartLines: CartLineInput[] = items.map((item) => ({
    id: item.id,
    product: item.product,
    width: item.width,
    height: item.height,
    requestedQty: item.requestedQty,
    preGroupSubtotal: item.preGroupSubtotal,
    vatPct: item.vatPct,
  }));
  const result = computeCart(cartLines);

  return {
    result,
    items,
    productCounts: {
      sticker: items.filter((i) => i.product === "sticker").length,
      etiket: items.filter((i) => i.product === "etiket").length,
    },
  };
}

export const CART_LIMIT = MAX_CART_ITEMS;
