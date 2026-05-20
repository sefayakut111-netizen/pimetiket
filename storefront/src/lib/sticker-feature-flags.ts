/**
 * Pim Etiket — /sticker/yapilandir feature flags
 *
 * Sefa 20 May v68 (Sticker reform Aşama S-B):
 * Etiket'tekiyle paralel pattern. /sticker grid sayfasından gelen URL
 * paramları konfigüratörde adımları gizler — kullanıcı çift seçim
 * yapmasın.
 *
 * Hiçbir kod silinmez. Yarın istenirse tek satır flag toggle ile geri
 * gelir. İleride DB-driven olabilir (Mig 072 customer_visible benzeri).
 */

// ============================================================
// KESİM TİPİ (Step 1) — Tabaka / Die-cut / Kiss-cut picker
// ============================================================

/**
 * Müşteri /sticker grid'den ?cut=tabaka|diecut|kisscut ile pre-fill
 * geldiği için konfigüratörde Step 1 (Kesim tipi) gereksiz. Yarın
 * istenirse flag aç → eski 2-3 kart seçici geri gelir.
 */
export const SHOW_STICKER_CUT_MODE_PICKER = false;

// ============================================================
// ŞEKİL (Step 2)
// ============================================================

/**
 * Şekil seçici — gridden ?shape=... ile pre-fill geliyor.
 * Yarın açılırsa kare/yuvarlak/oval/dikdörtgen/bumper kartları çıkar.
 */
export const SHOW_STICKER_SHAPE_PICKER = false;

// ============================================================
// MALZEME (Step 3)
// ============================================================

/**
 * Gizli sticker malzeme id'leri.
 * Şu an hiçbiri gizli — Vinil, Transparan, Holo, Simli hepsi açık.
 */
export const HIDDEN_STICKER_MATERIALS: readonly string[] = [];

// ============================================================
// YÜZEY/FINISH (Step 4)
// ============================================================

/**
 * Gizli finish id'leri. Şu an hiçbiri gizli — Parlak, Mat, Yok açık.
 */
export const HIDDEN_STICKER_FINISHES: readonly string[] = [];

// ============================================================
// KİSS-CUT — yeni cutMode (Sefa 20 May aktif)
// ============================================================

/**
 * Kiss-cut grid kartından gelirse cutMode='kisscut' set edilir.
 * Şu an pricing impact yok — fason iletilir, ürün operasyonel.
 * İleride pricing'e dahil edilecek (Mig 072 sonrası).
 */
export const ENABLE_KISSCUT = true;
