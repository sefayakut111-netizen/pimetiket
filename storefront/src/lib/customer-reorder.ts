/**
 * Yeniden sipariş — eski siparişin item'larını sepete kopyalar.
 *
 * Mantık:
 *   - Order.items[] dolaş
 *   - Her item için cart_items'a yeni satır ekle (UUID yeni)
 *   - Tasarım dosyası varsa (design_files'tan order_item_id'ye bağlı)
 *     yeni cart_item.designTempId YOK — order_id'yi cart'a not düş,
 *     müşteri /sticker veya /etiket konfigüratöründe görsel olarak
 *     tasarımı seçebilir (Faz 2'de "Saved designs" library)
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
import { addToCustomerCart, type CustomerCartItem } from "./customer-cart";

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
      // Tasarım — eski sipariş tasarımı yeni siparişe otomatik bağlanmaz
      // (storage path değişti, design_files başka order'a ait).
      // Müşteri /sepet'te yeniden yükleyebilir veya konfigüratörden
      // /tasarımlarım üzerinden seçebilir.
    };

    const r = await addToCustomerCart(payload);
    if (r.ok) {
      added++;
    } else {
      skipped++;
      lastReason = r.reason;
    }
  }

  return {
    ok: added > 0,
    added,
    skipped,
    reason: skipped > 0 ? lastReason : undefined,
  };
}
