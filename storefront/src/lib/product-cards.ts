/**
 * Product Cards — admin yönetimli grid kartları (Sefa 21 May v68 Mig 074)
 *
 * /etiket ve /sticker müşteri grid sayfaları artık DB'den okur.
 * /admin/urunler sayfası title_tr/title_en/desc_tr/desc_en/sort_order/
 * is_active alanlarını yönetir.
 *
 * - Etiket kartları için `image_src` (public SVG dosya yolu)
 * - Sticker kartları için `svg_id` (registry key — inline JSX SVG)
 */

export type ProductCardType = "etiket" | "sticker";

export interface ProductCard {
  id: string;
  product_type: ProductCardType;
  key: string;
  title_tr: string;
  title_en: string;
  desc_tr: string;
  desc_en: string;
  sort_order: number;
  is_active: boolean;
  query_params: Record<string, string>;
  image_src: string | null;
  svg_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductCardListParams {
  product_type?: ProductCardType;
  /** Admin: tüm kartlar (aktif + pasif). Public: sadece is_active=true. */
  includeInactive?: boolean;
}

/**
 * URL query string üretir: query_params {form, shape, cut, material}
 * → "?form=rulo&shape=diecut" formatına çevirir.
 */
export function buildCardQueryString(
  params: Record<string, string>
): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) return "";
  const qs = new URLSearchParams(entries).toString();
  return `?${qs}`;
}

/**
 * Etiket kartı için href: /etiket/yapilandir?form=rulo&shape=diecut
 * Sticker kartı için: /sticker/yapilandir?cut=diecut&shape=circle&material=...
 */
export function cardHref(card: Pick<ProductCard, "product_type" | "query_params">): string {
  const base =
    card.product_type === "etiket"
      ? "/etiket/yapilandir"
      : "/sticker/yapilandir";
  return `${base}${buildCardQueryString(card.query_params)}`;
}
