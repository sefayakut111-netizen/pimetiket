/**
 * Yeniden sipariş — eski siparişin item'larını sepete kopyalar.
 *
 * Mantık:
 *   - Order.items[] dolaş
 *   - Her item için cart_items'a yeni satır ekle (UUID yeni)
 *   - Tasarım alanları (designTempId, additionalDesigns vb.) top-level kopyalanır
 *   - Ekleme sonrası forceAll reprice — güncel tarife, ödeme doğrulaması geçer
 *
 * Akış:
 *   reorderFromOrder(orderId)
 *     ↓
 *   - fetchCustomerOrder(orderId) → CustomerOrder
 *   - cart_items.delete (mevcut sepeti temizleme YOK — items eklenir)
 *   - addToCustomerCart her item için
 *   - /sepet'e yönlendir
 */

import type { CustomerOrder } from "./customer-order";
import {
  addToCustomerCart,
  repriceCustomerCart,
  type CustomerCartItem,
} from "./customer-cart";

export interface ReorderResult {
  ok: boolean;
  added: number;
  skipped: number;
  reason?: string;
}

/**
 * Bir siparişin tüm item'larını sepete ekler.
 * Mevcut sepet temizlenmez — üzerine eklenir.
 *
 * @param order Eski sipariş (cache'den veya fetchCustomerOrder ile)
 * @returns added: kaç item eklendi, skipped: kaç item atlandı
 */
export async function reorderFromOrder(
  order: CustomerOrder
): Promise<ReorderResult> {
  let added = 0;
  let skipped = 0;
  let lastReason: string | undefined;

  // Tekrar baskı kuponu oluştur (fire-and-forget, sessionStorage'a yazsın)
  void fetch("/api/loyalty/reprint-coupon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceOrderId: order.id }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { code: string; value: number } | null) => {
      if (data && typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(
            "pim_pending_coupon",
            JSON.stringify({
              code: data.code,
              value: data.value,
              source: "reprint",
              sourceOrderId: order.id,
            })
          );
        } catch {
          /* sessionStorage dolu olabilir, görmezden gel */
        }
      }
    })
    .catch(() => {
      /* anonim kullanıcı olabilir, sessizce geç */
    });

  for (const item of order.items) {
    // CustomerCartItem shape — id + addedAt drop edilir (yeni id verilir)
    const payload: Omit<CustomerCartItem, "id" | "addedAt"> = {
      product: item.product,
      title: item.title,
      config: item.config,
      width: item.width,
      height: item.height,
      qty: item.qty,
      unit: item.unit,
      total: item.total,
      shape: item.shape,
      cut: item.cut,
      softCorners: item.softCorners,
      material: item.material,
      finish: item.finish,
      hediyeAdet: item.hediyeAdet,
      materialId: item.materialId,
      coatingId: item.coatingId,
      customizationId: item.customizationId,
      winding: item.winding,
      coreSize: item.coreSize,
      rollLabelCount: item.rollLabelCount,
      designCount: item.designCount,
      designTempId: item.designTempId,
      designPreviewUrl: item.designPreviewUrl,
      designFileName: item.designFileName,
      designMimeType: item.designMimeType,
      additionalDesigns: item.additionalDesigns,
      meta: item.meta,
    };

    const r = await addToCustomerCart(payload);
    if (r.ok) {
      added++;
    } else {
      skipped++;
      lastReason = r.reason;
    }
  }

  if (added > 0) {
    await repriceCustomerCart({ forceAll: true });
  }

  return {
    ok: added > 0,
    added,
    skipped,
    reason: skipped > 0 ? lastReason : undefined,
  };
}
