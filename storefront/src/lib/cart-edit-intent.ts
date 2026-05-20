/**
 * Cart Edit Intent — sepetten "Düzenle" butonu pattern (Sefa 20 May v68 test #3)
 *
 * Sorun: Sepette "Düzenle" tıklayınca konfigüratör boş açılıyor; kullanıcı
 * tüm seçimleri baştan yapmak zorunda kalıyor.
 *
 * Çözüm: Düzenle anında item snapshot'ı localStorage'a yazılır; konfigüratör
 * mount'ta okur, state'i yükler, intent'i temizler. Konfigüratörde "Sepete
 * ekle" tıklandığında eski item silinir → yeni item eklenir (replace).
 *
 * Kapsam:
 *   - Etiket konfigüratörü (material, coating, customization, width, height,
 *     qty, winding, coreSize, labelsPerRoll, designCount, designs)
 *   - Sticker konfigüratörü (material, finish, shape, cut, softCorners,
 *     width, height, qty, designCount, designs)
 *
 * Yaşam döngüsü:
 *   1. Sepette "Düzenle" → setEditIntent(item) → router.push("/.../yapilandir")
 *   2. Konfigüratör mount → loadEditIntent() → state yükle + clearEditIntent()
 *   3. Konfigüratörde "Sepete Ekle" → editIntentId varsa removeFromCart(id)
 *      → addToCustomerCart(newItem)
 */

import type { CustomerCartItem } from "./customer-cart";

const KEY = "pim_edit_intent";

export interface EditIntent {
  /** Düzenlenen cart item ID (Sepete Ekle'de silinecek) */
  editingItemId: string;
  /** Tam item snapshot — konfigüratör state'i bundan rehidrate olur */
  item: CustomerCartItem;
  /** Setlenme tarihi (TTL kontrolü için) */
  setAt: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 dk — kullanıcı /yapilandir'a geçmezse expire

export function setEditIntent(item: CustomerCartItem): void {
  if (typeof window === "undefined") return;
  try {
    const intent: EditIntent = {
      editingItemId: item.id,
      item,
      setAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(intent));
  } catch {
    /* localStorage full or disabled — sessiz */
  }
}

export function loadEditIntent(): EditIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EditIntent;
    if (!parsed.editingItemId || !parsed.item) return null;
    // TTL check
    if (Date.now() - parsed.setAt > TTL_MS) {
      clearEditIntent();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearEditIntent(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* sessiz */
  }
}
