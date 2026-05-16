/**
 * Customer-facing order store — /odeme submit'te cart snapshot alır,
 * /odeme-sonuc + /siparis/[id] + /siparislerim bu store'u okur.
 *
 * Hibrit strateji:
 *   - Auth YOKSA  → localStorage (mock akış, geriye uyumlu)
 *   - Auth VARSA  → Supabase RPC `fn_create_order` (atomik) +
 *                   `orders` + `order_items` + `order_events` SELECT
 *
 * Async cache: ilk `refreshCustomerOrders()` ile yüklenir.
 * Sync API'ler cache döner.
 */

import type { CustomerCartItem } from "./customer-cart";
import type { OrderStatus } from "./order";
import { createClient } from "./supabase/client";
import {
  getCurrentUser,
  isLoggedInSync,
} from "./supabase/auth-bridge";

const STORAGE_KEY = "pim_customer_orders_v1";
const MAX_ORDERS = 100;

// ============================================================
// Types
// ============================================================

export interface CustomerOrderAddress {
  label?: string;
  name: string;
  addr: string;
  city: string;
  phone: string;
}

export interface CustomerOrderInvoice {
  type: "individual" | "corporate";
  tc?: string;
  vkn?: string;
  companyName?: string;
  taxOffice?: string;
}

export interface CustomerOrderPayment {
  method: "card" | "transfer";
  /** Maskelenmiş kart no — son 4 hane */
  masked?: string;
}

export interface CustomerOrder {
  /** Sipariş id — `PE-2026-XXXX` formatı */
  id: string;
  status: OrderStatus;
  items: CustomerCartItem[];
  address: CustomerOrderAddress;
  invoice: CustomerOrderInvoice;
  payment: CustomerOrderPayment;
  /** Para tutarları (KDV dahil) */
  subtotal: number;
  shipping: number;
  total: number;
  /** Tarihler */
  createdAt: number;
  createdAtIso: string;
  /** Tahmini teslim tarihi (ISO) — display için */
  estimatedDelivery?: string;
}

// ============================================================
// In-memory cache + helpers
// ============================================================

let cache: CustomerOrder[] = [];
let cacheLoaded = false;

function notifyChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("pim_customer_orders_updated"));
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

// Sefa kuralı (12 May P0 audit): orderId 4-haneli random çakışma riski
// (doğum günü paradoksu ~110 sipariş sonra %50). nanoid 8-char (URL-safe
// alfabe) ile 218 trilyon kombinasyon — DB unique constraint zaten korur
// ama çakışma matematiksel olarak imkansız.
//
// Format: PE-2026-Xa3Bc7Pq (62^8 = 218 trilyon).
const NANOID_ALPHABET =
  "0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
// (I, O, l, o, 0 dahil değil — okuma/söyleme kolaylığı için ambiguity önlendi)

function nanoidLike8(): string {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < 8; i++) {
      out += NANOID_ALPHABET[bytes[i] % NANOID_ALPHABET.length];
    }
    return out;
  }
  // Fallback (server-side Node 18+'da crypto var, bu dal nadir)
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += NANOID_ALPHABET[Math.floor(Math.random() * NANOID_ALPHABET.length)];
  }
  return out;
}

/** PE-{YIL}-{8 char nanoid} formatında sipariş id üret. */
export function generateOrderId(): string {
  const year = new Date().getFullYear();
  return `PE-${year}-${nanoidLike8()}`;
}

/** Bugünden N gün sonrası ISO date (sadece tarih). */
export function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// localStorage helpers (guest mode)
// ============================================================

function readLocal(): CustomerOrder[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomerOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(orders: CustomerOrder[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // localStorage full
  }
}

// ============================================================
// DB helpers (auth mode)
// ============================================================

interface DbOrderRow {
  id: string;
  user_id: string;
  status: OrderStatus;
  subtotal: number;
  shipping: number;
  total: number;
  address: CustomerOrderAddress;
  invoice: CustomerOrderInvoice;
  payment: CustomerOrderPayment;
  estimated_delivery: string | null;
  created_at: string;
}

interface DbOrderItemRow {
  id: string;
  order_id: string;
  product: "sticker" | "etiket";
  title: string;
  config: string;
  width: number;
  height: number;
  qty: number;
  unit: number;
  total: number;
  meta: Record<string, unknown>;
}

function rowsToOrder(
  o: DbOrderRow,
  items: DbOrderItemRow[]
): CustomerOrder {
  const ts = new Date(o.created_at).getTime();
  const cartItems: CustomerCartItem[] = items.map((i) => {
    const meta = (i.meta ?? {}) as Partial<CustomerCartItem>;
    return {
      id: i.id,
      product: i.product,
      title: i.title,
      config: i.config,
      width: i.width,
      height: i.height,
      qty: i.qty,
      unit: Number(i.unit),
      total: Number(i.total),
      shape: meta.shape,
      cut: meta.cut,
      softCorners: meta.softCorners,
      material: meta.material,
      finish: meta.finish,
      hediyeAdet: meta.hediyeAdet,
      materialId: meta.materialId,
      coatingId: meta.coatingId,
      customizationId: meta.customizationId,
      winding: meta.winding,
      addedAt: ts,
    };
  });
  return {
    id: o.id,
    status: o.status,
    items: cartItems,
    address: o.address,
    invoice: o.invoice,
    payment: o.payment,
    subtotal: Number(o.subtotal),
    shipping: Number(o.shipping),
    total: Number(o.total),
    createdAt: ts,
    createdAtIso: o.created_at,
    estimatedDelivery: o.estimated_delivery ?? undefined,
  };
}

async function dbList(userId: string): Promise<CustomerOrder[]> {
  const supabase = createClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[orders] dbList error:", error);
    return [];
  }
  if (!orders || orders.length === 0) return [];

  const orderIds = (orders as DbOrderRow[]).map((o) => o.id);
  const { data: itemsRaw, error: itemsErr } = await supabase
    .from("order_items")
    .select("*")
    .in("order_id", orderIds);
  if (itemsErr) {
    console.error("[orders] dbList items error:", itemsErr);
    return [];
  }
  const items = (itemsRaw ?? []) as DbOrderItemRow[];
  return (orders as DbOrderRow[]).map((o) =>
    rowsToOrder(o, items.filter((i) => i.order_id === o.id))
  );
}

async function dbGet(orderId: string): Promise<CustomerOrder | null> {
  // Sefa 17 May P0-4: Order ID case-insensitive lookup. Eski kod
  // `eq("id", orderId)` direkt string match ile case-sensitive.
  // /siparis/PE-2026-PKTBJWFE (uppercase) → bulamıyordu çünkü DB'de
  // "PE-2026-pkTBJwFE" (mixed) duruyor. ilike ile case-insensitive
  // match yapıyoruz.
  const supabase = createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .ilike("id", orderId)
    .maybeSingle();
  if (error || !order) return null;

  // Gerçek (canonical) ID'yi DB row'undan al — order_items lookup için
  // bu ID kullanılmalı, kullanıcının yazdığı değil
  const canonicalId = (order as DbOrderRow).id;

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", canonicalId);
  return rowsToOrder(
    order as DbOrderRow,
    (items ?? []) as DbOrderItemRow[]
  );
}

/**
 * fn_create_order RPC çağrısı — atomik orders + items + ilk event.
 */
async function dbCreate(
  userId: string,
  payload: Omit<CustomerOrder, "id" | "status" | "createdAt" | "createdAtIso">
): Promise<CustomerOrder | null> {
  const supabase = createClient();
  const orderId = generateOrderId();
  const itemsJson = payload.items.map((i) => ({
    product: i.product,
    title: i.title,
    config: i.config,
    width: i.width,
    height: i.height,
    qty: i.qty,
    unit: i.unit,
    total: i.total,
    meta: {
      shape: i.shape,
      cut: i.cut,
      softCorners: i.softCorners,
      material: i.material,
      finish: i.finish,
      hediyeAdet: i.hediyeAdet,
      materialId: i.materialId,
      coatingId: i.coatingId,
      customizationId: i.customizationId,
      winding: i.winding,
    },
  }));

  const { error } = await supabase.rpc("fn_create_order" as never, {
    p_order_id: orderId,
    p_user_id: userId,
    p_subtotal: payload.subtotal,
    p_shipping: payload.shipping,
    p_total: payload.total,
    p_address: payload.address,
    p_invoice: payload.invoice,
    p_payment: payload.payment,
    p_estimated_delivery: payload.estimatedDelivery ?? null,
    p_items: itemsJson,
  } as never);
  if (error) {
    console.error("[orders] dbCreate error:", error);
    return null;
  }

  // Insert sonrası tek read ile dön
  return dbGet(orderId);
}

// ============================================================
// Cache hydration
// ============================================================

export async function refreshCustomerOrders(): Promise<CustomerOrder[]> {
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

// ============================================================
// Public API
// ============================================================

/**
 * Sync cache döner (UI ilk paint için). Hydration'dan önce eski local
 * cache veya boş liste olabilir; pages refreshCustomerOrders() ile
 * yenilemeli.
 */
export function listCustomerOrders(): CustomerOrder[] {
  if (!cacheLoaded && !isLoggedInSync()) {
    cache = readLocal();
    cacheLoaded = true;
  }
  return cache;
}

export async function createCustomerOrder(
  payload: Omit<CustomerOrder, "id" | "status" | "createdAt" | "createdAtIso">
): Promise<CustomerOrder> {
  const user = await getCurrentUser();
  let result: CustomerOrder;

  if (user) {
    const created = await dbCreate(user.id, payload);
    if (!created) {
      throw new Error("Sipariş oluşturulamadı, tekrar dene.");
    }
    cache = [created, ...cache];
    notifyChange();
    result = created;
  } else {
    // Guest mode → localStorage
    const now = Date.now();
    const order: CustomerOrder = {
      id: generateOrderId(),
      status: "paid",
      createdAt: now,
      createdAtIso: new Date(now).toISOString(),
      ...payload,
    };
    const orders = readLocal();
    orders.unshift(order);
    if (orders.length > MAX_ORDERS) orders.length = MAX_ORDERS;
    writeLocal(orders);
    cache = orders;
    notifyChange();
    result = order;
  }

  // PostHog purchase event — consent yoksa no-op
  try {
    const { track } = await import("@/lib/analytics/posthog-events");
    track("purchase", {
      order_id: result.id,
      total: result.total,
      subtotal: result.subtotal,
      shipping: result.shipping,
      item_count: result.items.length,
      payment_method: result.payment.method,
    });
  } catch {
    /* silent */
  }

  return result;
}

export function getCustomerOrder(id: string): CustomerOrder | null {
  // Sync — cache'den
  return cache.find((o) => o.id === id) ?? null;
}

export async function fetchCustomerOrder(id: string): Promise<CustomerOrder | null> {
  const user = await getCurrentUser();
  if (user) {
    return dbGet(id);
  }
  const orders = readLocal();
  return orders.find((o) => o.id === id) ?? null;
}

/**
 * Yerel mock için status update — backend tarafı service_role veya
 * admin endpoint'i kullanır, müşteri changeleyemez. Auth mode'da no-op.
 */
export function updateCustomerOrderStatus(
  id: string,
  status: OrderStatus
): void {
  if (isLoggedInSync()) {
    console.warn(
      "[orders] updateCustomerOrderStatus: auth mode'da no-op. Admin tarafı service_role ile yapmalı."
    );
    return;
  }
  const orders = readLocal();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return;
  orders[idx] = { ...orders[idx], status };
  writeLocal(orders);
  cache = orders;
  notifyChange();
}

export const CUSTOMER_ORDERS_LIMIT = MAX_ORDERS;
