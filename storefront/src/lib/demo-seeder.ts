/**
 * Demo seeder — Sefa'nın sistemde dolaşması için mock veri yükler.
 *
 * Yüklenen storage key'leri:
 *   - pim_customer_cart_v1      (1 ürün ekli sepet)
 *   - pim_customer_orders_v1    (4 sipariş, farklı statülerde)
 *   - pim_customer_returns_v1   (1 iade talebi)
 *   - pim_audit_log_v1          (5 admin işlem kaydı)
 *   - pim_design_files_v1       (PE-2026-DEMO1'e yüklenmiş tasarım)
 *
 * "Sıfırla" butonu tüm key'leri siler, /demo'ya geri dönmez.
 */

import type { CustomerCartItem } from "./customer-cart";
import type { CustomerOrder } from "./customer-order";
import type { ReturnRequest } from "./customer-return";
import type { AuditEntry } from "./audit-log";

export const DEMO_CUSTOMER_NAME = "Defne Karaca";
export const DEMO_CUSTOMER_PHONE = "+90 532 555 12 34";
export const DEMO_CUSTOMER_EMAIL = "defne@olea.com.tr";

const STORAGE_KEYS = {
  cart: "pim_customer_cart_v1",
  orders: "pim_customer_orders_v1",
  returns: "pim_customer_returns_v1",
  audit: "pim_audit_log_v1",
  designs: "pim_design_files_v1",
  reviews: "pim_reviews_v1",
  coupons: "pim_coupons_v1",
  // Demo mode flag
  demo: "pim_demo_mode_v1",
} as const;

const ADDRESS = {
  label: "Atölye",
  name: DEMO_CUSTOMER_NAME,
  addr: "Caferağa Mh. Mühürdar Cd. No:12 D:3",
  city: "İstanbul / Kadıköy",
  phone: DEMO_CUSTOMER_PHONE,
};

const INVOICE = {
  type: "individual" as const,
  tc: "11111111111",
};

const PAYMENT = {
  method: "card" as const,
  masked: "**** **** **** 4242",
};

function dayMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

function isoDate(daysFromNow: number): string {
  return new Date(Date.now() + dayMs(daysFromNow))
    .toISOString()
    .slice(0, 10);
}

// ============================================================
// Demo orders — 4 farklı statüde
// ============================================================

const DEMO_ORDERS: CustomerOrder[] = [
  // 1. Yeni — paid (bugün ödendi)
  {
    id: "PE-2026-DEMO1",
    user_id: "demo-user",
    status: "paid",
    items: [
      {
        id: "demo-item-1a",
        product: "etiket",
        title: "Etiket · Kraft + Mat selefon",
        config: "60×80mm · 2.000 adet · Eklenti yok · Sarım 1",
        width: 60,
        height: 80,
        qty: 2000,
        unit: 2.85,
        total: 5691,
        materialId: "kraft",
        coatingId: "mat",
        customizationId: "yok",
        winding: 1,
        addedAt: Date.now() - dayMs(0),
      },
    ],
    address: ADDRESS,
    invoice: INVOICE,
    payment: PAYMENT,
    subtotal: 5691,
    shipping: 0,
    total: 5691,
    estimatedDelivery: isoDate(10),
    createdAt: Date.now() - dayMs(0) - 60 * 60 * 1000, // 1 saat önce
    createdAtIso: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  } as unknown as CustomerOrder,

  // 2. Prova bekliyor — proof_pending (3 gün önce)
  {
    id: "PE-2026-DEMO2",
    user_id: "demo-user",
    status: "proof_pending",
    items: [
      {
        id: "demo-item-2a",
        product: "etiket",
        title: "Etiket · Beyaz semi-glos + Parlak selefon",
        config: "70×100mm · 5.000 adet · Sıcak yaldız (altın) · Sarım 1",
        width: 70,
        height: 100,
        qty: 5000,
        unit: 3.45,
        total: 17250,
        materialId: "beyaz",
        coatingId: "parlak",
        customizationId: "yaldiz",
        winding: 1,
        addedAt: Date.now() - dayMs(3),
      },
    ],
    address: ADDRESS,
    invoice: INVOICE,
    payment: PAYMENT,
    subtotal: 17250,
    shipping: 0,
    total: 17250,
    estimatedDelivery: isoDate(7),
    createdAt: Date.now() - dayMs(3),
    createdAtIso: new Date(Date.now() - dayMs(3)).toISOString(),
  } as unknown as CustomerOrder,

  // 3. Üretimde — in_production (1 hafta önce)
  {
    id: "PE-2026-DEMO3",
    user_id: "demo-user",
    status: "in_production",
    items: [
      {
        id: "demo-item-3a",
        product: "sticker",
        title: "Sticker · Holografik + Parlak",
        config: "75×75mm · 250 adet · Die-cut · Yumuşatılmış köşe",
        width: 75,
        height: 75,
        qty: 250,
        unit: 15.92,
        total: 3980,
        shape: "square",
        cut: "diecut",
        softCorners: true,
        material: "holo",
        finish: "parlak",
        hediyeAdet: 2,
        addedAt: Date.now() - dayMs(7),
      },
      {
        id: "demo-item-3b",
        product: "sticker",
        title: "Sticker · Vinil + Mat",
        config: "50×50mm · 500 adet · Die-cut · Düz köşe",
        width: 50,
        height: 50,
        qty: 500,
        unit: 8.5,
        total: 4250,
        shape: "square",
        cut: "diecut",
        softCorners: false,
        material: "vinil",
        finish: "mat",
        hediyeAdet: 5,
        addedAt: Date.now() - dayMs(7),
      },
    ],
    address: ADDRESS,
    invoice: INVOICE,
    payment: PAYMENT,
    subtotal: 8230,
    shipping: 0,
    total: 8230,
    estimatedDelivery: isoDate(3),
    createdAt: Date.now() - dayMs(7),
    createdAtIso: new Date(Date.now() - dayMs(7)).toISOString(),
  } as unknown as CustomerOrder,

  // 4. Teslim edildi — delivered (3 hafta önce)
  {
    id: "PE-2026-DEMO4",
    user_id: "demo-user",
    status: "delivered",
    items: [
      {
        id: "demo-item-4a",
        product: "etiket",
        title: "Etiket · Kraft + Soft touch",
        config: "55×85mm · 3.000 adet · Kabartma (emboss) · Sarım 2",
        width: 55,
        height: 85,
        qty: 3000,
        unit: 3.12,
        total: 9360,
        materialId: "kraft",
        coatingId: "soft",
        customizationId: "emboss",
        winding: 2,
        addedAt: Date.now() - dayMs(21),
      },
    ],
    address: ADDRESS,
    invoice: INVOICE,
    payment: PAYMENT,
    subtotal: 9360,
    shipping: 0,
    total: 9360,
    estimatedDelivery: isoDate(-11), // 11 gün önce teslim
    createdAt: Date.now() - dayMs(21),
    createdAtIso: new Date(Date.now() - dayMs(21)).toISOString(),
  } as unknown as CustomerOrder,
];

// ============================================================
// Demo cart — 1 ürün ekli ("alışveriş yapıyorsunuz" simülasyonu)
// ============================================================

const DEMO_CART: CustomerCartItem[] = [
  {
    id: "demo-cart-1",
    product: "sticker",
    title: "Sticker · Simli + Parlak",
    config: "Yuvarlak · 60×60mm · Die-cut",
    width: 60,
    height: 60,
    qty: 100,
    unit: 12.5,
    total: 1250,
    shape: "circle",
    cut: "diecut",
    softCorners: false,
    material: "simli",
    finish: "parlak",
    hediyeAdet: 1,
    addedAt: Date.now() - 30 * 60 * 1000, // 30 dk önce ekledi
  },
];

// ============================================================
// Demo return — DEMO4'e bağlı 1 iade talebi
// ============================================================

const DEMO_RETURNS: ReturnRequest[] = [
  {
    id: "demo-return-1",
    orderId: "PE-2026-DEMO4",
    customerName: DEMO_CUSTOMER_NAME,
    customerEmail: DEMO_CUSTOMER_EMAIL,
    reason: "kalite_problemi",
    description:
      "Etiketlerin yaklaşık %5'inde emboss baskısı net değil — bazı bölgelerde kabartma yarım kalmış. Üretimden çıkmış görünüyor, müşteriye gönderemiyoruz.",
    attachments: ["foto_1234.jpg", "foto_1235.jpg"],
    status: "pending",
    createdAt: Date.now() - dayMs(2),
    createdAtIso: new Date(Date.now() - dayMs(2)).toISOString(),
    updatedAt: Date.now() - dayMs(2),
    updatedAtIso: new Date(Date.now() - dayMs(2)).toISOString(),
  },
];

// ============================================================
// Demo audit log — 5 admin aksiyonu
// ============================================================

const DEMO_AUDIT: AuditEntry[] = [
  {
    id: "aud-demo-1",
    action: "order.status_change",
    actor: "Sefa",
    targetId: "PE-2026-DEMO3",
    summary: "Sipariş durumunu Üretimde olarak güncelledi",
    detail: "operator_review → in_production",
    ip: "85.108.x.x",
    createdAt: Date.now() - dayMs(2),
    createdAtIso: new Date(Date.now() - dayMs(2)).toISOString(),
  },
  {
    id: "aud-demo-2",
    action: "settings.update",
    actor: "Sefa",
    targetId: "site_settings",
    summary: "Kargo ücreti 49 TL olarak güncellendi",
    ip: "85.108.x.x",
    createdAt: Date.now() - dayMs(5),
    createdAtIso: new Date(Date.now() - dayMs(5)).toISOString(),
  },
  {
    id: "aud-demo-3",
    action: "coupon.create",
    actor: "Sefa",
    targetId: "HOSGELDIN10",
    summary: "Yeni kupon oluşturuldu: %10 indirim, sınırsız kullanım",
    ip: "85.108.x.x",
    createdAt: Date.now() - dayMs(8),
    createdAtIso: new Date(Date.now() - dayMs(8)).toISOString(),
  },
  {
    id: "aud-demo-4",
    action: "review.approve",
    actor: "Sefa",
    targetId: "r3",
    summary: "Ezgi Kaplan'ın 5 yıldızlı yorumu onaylandı",
    ip: "85.108.x.x",
    createdAt: Date.now() - dayMs(10),
    createdAtIso: new Date(Date.now() - dayMs(10)).toISOString(),
  },
  {
    id: "aud-demo-5",
    action: "auth.login",
    actor: "Sefa",
    summary: "Admin paneline giriş yaptı",
    ip: "85.108.x.x",
    createdAt: Date.now() - dayMs(0),
    createdAtIso: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
];

// ============================================================
// Demo design files — DEMO1 siparişine yüklenmiş tasarım
// ============================================================

const DEMO_DESIGN_FILES: Record<
  string,
  Array<{
    name: string;
    size: number;
    uploadedAt: number;
    flags: Array<{ kind: "ok" | "warning" | "error"; message: string }>;
  }>
> = {
  "PE-2026-DEMO1": [
    {
      name: "olea_etiket_v3.pdf",
      size: 2_456_789,
      uploadedAt: Date.now() - 30 * 60 * 1000,
      flags: [
        { kind: "ok", message: "Çözünürlük 320 DPI — baskı için yeterli" },
        { kind: "ok", message: "CMYK renk uzayı tespit edildi" },
        { kind: "ok", message: "Yazım kontrolü: tipo bulunamadı" },
      ],
    },
  ],
  "PE-2026-DEMO2": [
    {
      name: "olea_yeni_seri.pdf",
      size: 4_123_456,
      uploadedAt: Date.now() - dayMs(2),
      flags: [
        { kind: "ok", message: "Çözünürlük 350 DPI — premium kalite" },
        { kind: "ok", message: "CMYK renk uzayı tespit edildi" },
        {
          kind: "warning",
          message: "Yaldız bölgesi sadece bir tarafta — simetri kontrolü öner",
        },
      ],
    },
  ],
};

// ============================================================
// Public API
// ============================================================

export interface DemoSeedResult {
  ordersCount: number;
  cartCount: number;
  returnsCount: number;
}

/** Tüm demo veriyi yükler. Mevcut store'lar üzerine yazar. */
export function seedDemoData(): DemoSeedResult {
  if (typeof window === "undefined") {
    return { ordersCount: 0, cartCount: 0, returnsCount: 0 };
  }

  localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(DEMO_CART));
  localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(DEMO_ORDERS));
  localStorage.setItem(STORAGE_KEYS.returns, JSON.stringify(DEMO_RETURNS));
  localStorage.setItem(STORAGE_KEYS.audit, JSON.stringify(DEMO_AUDIT));
  localStorage.setItem(
    STORAGE_KEYS.designs,
    JSON.stringify(DEMO_DESIGN_FILES)
  );
  localStorage.setItem(STORAGE_KEYS.demo, "true");

  // Event'leri tetikle — açık tab'lar refresh etsin
  window.dispatchEvent(new CustomEvent("pim_customer_cart_updated"));
  window.dispatchEvent(new CustomEvent("pim_customer_orders_updated"));
  window.dispatchEvent(new CustomEvent("pim_customer_returns_updated"));
  window.dispatchEvent(new CustomEvent("pim_audit_log_updated"));

  return {
    ordersCount: DEMO_ORDERS.length,
    cartCount: DEMO_CART.length,
    returnsCount: DEMO_RETURNS.length,
  };
}

/** Tüm demo veriyi temizler. Demo flag de kalkar. */
export function clearDemoData(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(STORAGE_KEYS.cart);
  localStorage.removeItem(STORAGE_KEYS.orders);
  localStorage.removeItem(STORAGE_KEYS.returns);
  localStorage.removeItem(STORAGE_KEYS.audit);
  localStorage.removeItem(STORAGE_KEYS.designs);
  localStorage.removeItem(STORAGE_KEYS.demo);
  // Coupons + reviews sample data tabloları kalsın (sıfırlamak istemiyorsa)

  window.dispatchEvent(new CustomEvent("pim_customer_cart_updated"));
  window.dispatchEvent(new CustomEvent("pim_customer_orders_updated"));
  window.dispatchEvent(new CustomEvent("pim_customer_returns_updated"));
  window.dispatchEvent(new CustomEvent("pim_audit_log_updated"));
}

/** Demo modunda mı? */
export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEYS.demo) === "true";
}
