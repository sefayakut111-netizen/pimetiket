/**
 * Customer-facing order store — /odeme submit'te cart snapshot alır,
 * /odeme-sonuc + /siparis/[id] + /siparislerim bu store'u okur.
 *
 * Backend swap'te (Block C/I) Medusa order API'sine bağlanır.
 *
 * Ödeme statü modeli — order.ts'teki OrderStatus enum'una uyumlu.
 */

import type { CustomerCartItem } from "./customer-cart";
import type { OrderStatus } from "./order";

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
  method: "card" | "wallet" | "transfer";
  /** Maskelenmiş kart no — son 4 hane */
  masked?: string;
}

export interface CustomerOrder {
  /** Sipariş id — `PE-2026-XXXX` formatı */
  id: string;
  /** Sipariş statüsü */
  status: OrderStatus;
  /** Sipariş satırları — cart snapshot */
  items: CustomerCartItem[];
  /** Adres */
  address: CustomerOrderAddress;
  /** Fatura */
  invoice: CustomerOrderInvoice;
  /** Ödeme */
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
// Storage
// ============================================================

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function listCustomerOrders(): CustomerOrder[] {
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

function writeCustomerOrders(orders: CustomerOrder[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent("pim_customer_orders_updated"));
  } catch {
    // localStorage full
  }
}

// ============================================================
// Helpers
// ============================================================

/** PE-2026-XXXX formatında sipariş id üret. */
export function generateOrderId(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(1000 + Math.random() * 9000);
  return `PE-${year}-${seq}`;
}

/** Bugünden N gün sonrası ISO date (sadece tarih). */
export function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// CRUD
// ============================================================

export function createCustomerOrder(
  payload: Omit<CustomerOrder, "id" | "status" | "createdAt" | "createdAtIso">
): CustomerOrder {
  const now = Date.now();
  const order: CustomerOrder = {
    id: generateOrderId(),
    status: "paid",
    createdAt: now,
    createdAtIso: new Date(now).toISOString(),
    ...payload,
  };

  const orders = listCustomerOrders();
  orders.unshift(order); // en yeni başta
  if (orders.length > MAX_ORDERS) orders.length = MAX_ORDERS;
  writeCustomerOrders(orders);
  return order;
}

export function getCustomerOrder(id: string): CustomerOrder | null {
  return listCustomerOrders().find((o) => o.id === id) ?? null;
}

export function updateCustomerOrderStatus(
  id: string,
  status: OrderStatus
): void {
  const orders = listCustomerOrders();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return;
  orders[idx] = { ...orders[idx], status };
  writeCustomerOrders(orders);
}

export const CUSTOMER_ORDERS_LIMIT = MAX_ORDERS;
