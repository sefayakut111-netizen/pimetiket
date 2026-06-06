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
import type { Json } from "./supabase/types";
import type { Tables } from "./supabase/types";
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
  /** Admin/staff hesabından verilen test siparişi */
  adminTestOrder?: boolean;
  source?: string;
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
  /** Prova SLA son tarihi (ISO) — kuyruk/prova/siparişler ile aynı metrik */
  slaProofDeadline?: string;
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

// Sefa kuralı (19 May v68): Sipariş ID = DDMMYYYY + 4 random rakam.
// Önceki tüm formatlar (PE-YIL-XXX, 8 rakam) kaldırıldı.
// Format: 12 hane saf rakam — operatör görür görmez tarih okur.
//
// Yapı:  [GG][AA][YYYY][rand4]
// Örnek: 190520264837  → 19 Mayıs 2026, random 4837
// Görsel grup: 1905 2026 4837 (DB'de bitişik tutulur)
//
// Çakışma: günlük 10K kombinasyon. Yıl başına 100K sipariş varsayımı
// (~270/gün) → %2.7 birim çakışma — DB unique constraint zaten korur.
// Çakışma olursa fn_finalize_paid_order RPC yeniden ID üretir
// (retry payment-callback dışında problem değil).
function dateStampedId(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  let rand = "";
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 4; i++) rand += String(bytes[i] % 10);
  } else {
    rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  }
  return `${dd}${mm}${yyyy}${rand}`;
}

/** 12 haneli tarih damgalı sipariş id üret. Örn: 190520264837 */
export function generateOrderId(): string {
  return dateStampedId();
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

type DbOrderRow = Tables<"orders">;
type DbOrderItemRow = Tables<"order_items">;

function rowsToOrder(
  o: DbOrderRow,
  items: DbOrderItemRow[]
): CustomerOrder {
  const ts = new Date(o.created_at).getTime();
  const cartItems: CustomerCartItem[] = items.map((i) => {
    const meta = (i.meta ?? {}) as Partial<CustomerCartItem>;
    return {
      id: i.id,
      product: i.product as CustomerCartItem["product"],
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
      // Sefa 21 May v68 Mig 073: rulo + design alanları meta'dan geri yüklenir
      coreSize: meta.coreSize,
      rollLabelCount: meta.rollLabelCount,
      designCount: meta.designCount,
      designTempId: meta.designTempId,
      designPreviewUrl: meta.designPreviewUrl,
      designFileName: meta.designFileName,
      designMimeType: meta.designMimeType,
      additionalDesigns: meta.additionalDesigns,
      meta:
        i.meta && typeof i.meta === "object" && !Array.isArray(i.meta)
          ? (i.meta as Record<string, unknown>)
          : undefined,
      addedAt: ts,
    };
  });
  return {
    id: o.id,
    status: o.status,
    items: cartItems,
    address: o.address as unknown as CustomerOrderAddress,
    invoice: o.invoice as unknown as CustomerOrderInvoice,
    payment: o.payment as unknown as CustomerOrderPayment,
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

  const orderIds = orders.map((o) => o.id);
  const { data: itemsRaw, error: itemsErr } = await supabase
    .from("order_items")
    .select("*")
    .in("order_id", orderIds);
  if (itemsErr) {
    console.error("[orders] dbList items error:", itemsErr);
    return [];
  }
  const items = itemsRaw ?? [];
  return orders.map((o) =>
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
  const canonicalId = order.id;

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", canonicalId);
  return rowsToOrder(order, items ?? []);
}

/**
 * fn_create_order RPC çağrısı — KALDIRILDI (Mig 114 güvenlik).
 * Authenticated kullanıcılar client'tan ücretsiz "paid" sipariş açamaz.
 * Ödeme akışı: /api/payment/init → PayTR → callback (fn_finalize_paid_order).
 * Admin/dev bypass: /api/admin/orders/bypass-checkout veya /api/dev/mock-checkout.
 */
async function dbCreate(
  _userId: string,
  _payload: Omit<CustomerOrder, "id" | "status" | "createdAt" | "createdAtIso">
): Promise<CustomerOrder | null> {
  console.error(
    "[orders] dbCreate: client-side fn_create_order devre dışı. Ödeme akışını kullanın."
  );
  return null;
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
    const { ga4Purchase } = await import("@/lib/analytics/ga4-events");
    track("purchase", {
      order_id: result.id,
      total: result.total,
      subtotal: result.subtotal,
      shipping: result.shipping,
      item_count: result.items.length,
      payment_method: result.payment.method,
    });
    ga4Purchase(result.id, result.total);
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
