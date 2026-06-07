/** Kademeli açılış: tabaka açık, rulo 29 Haziran 2026'da açılacak. */
export const ETIKET_ENABLED = true;
export const ETIKET_TABAKA_ENABLED = true;
export const ETIKET_RULO_ENABLED = false;
export const ETIKET_LAUNCH_LABEL = "29 Haziran 2026";

/**
 * Pim Etiket — /etiket/yapilandir feature flags
 *
 * Sefa 20 May v68 (Konfigüratör reform Aşama B):
 * Sefa "sistem oturana kadar kod silmeyelim, sadece gizleyelim" dedi.
 * Bu dosya hangi malzeme/kaplama/adımın müşteriye GÖSTERİLECEĞİNİ
 * kontrol eder. Yarın açmak isteyince bir satır değiştir, deploy et.
 *
 * Tasarım:
 *   - MATERIALS/COATINGS const'larındaki id'ler ile eşleşir
 *   - Bir id HIDDEN listesinde ise müşteri konfigüratörde göremez
 *   - Step bazında flag'ler de var (örn SHOW_CUSTOMIZATION_STEP)
 *
 * İleride (Aşama D): bu const'lar Mig 072 ile DB'ye taşınır,
 * admin /fiyatlar'dan toggle edilir. O zaman bu dosya default
 * değerleri sağlar (DB'deki customer_visible'ın fallback'i).
 */

// ============================================================
// ETİKET TÜRÜ (Step 0) — Rulo / Tabaka seçici
// ============================================================

/**
 * Etiket türü (Rulo / Tabaka) picker.
 *
 * Sefa kararı 20 May v68 (Aşama A+B sonrası): Müşteri /etiket grid
 * sayfasından zaten "form=rulo" veya "form=tabaka" parametresiyle
 * geliyor. Konfigüratörde tekrar Step 0 göstermek redundant —
 * gizledik. URL paramı state'i pre-fill eder, formFactor değişmesi
 * için müşteri /etiket'ten farklı kart seçer.
 *
 * Yarın istenirse: bu flag'i true yap, ADIM 1 olarak geri gelir.
 */
export const SHOW_ETIKET_FORM_FACTOR_PICKER = false;

// ============================================================
// MALZEME (Step 1)
// ============================================================

/**
 * Müşteriye gizlenmiş malzeme id'leri.
 *
 * Sefa kararı 20 May:
 *   - "kraft" — şu an üretim partneri yok; gözükmesin
 *   - "ultra" (Ultra Clear) — el ile yapıştırma zorluğu, partner şart
 *
 * NOT: Eğer kullanıcı eski URL/cookie ile bu malzemeleri seçmiş geliyorsa
 * konfigüratör yine de fiyatlandırma yapabilir — sadece grid'de gözükmez.
 */
export const HIDDEN_ETIKET_MATERIALS: readonly string[] = ["kraft", "ultra"];

// ============================================================
// KAPLAMA (Step 2)
// ============================================================

/**
 * Müşteriye gizlenmiş kaplama id'leri.
 *
 * Sefa kararı 20 May:
 *   - "soft" (Soft Touch) — partner yok, sonra açılacak
 */
export const HIDDEN_ETIKET_COATINGS: readonly string[] = ["soft"];

// ============================================================
// ÖZELLEŞTİRME (Step 3)
// ============================================================

/**
 * Özelleştirme adımı (Emboss / Yaldız / Spot UV).
 *
 * Sefa kararı 20 May: "komple kalkacak" — sistem oturana kadar.
 * false ise Step 3 hiç render edilmez; customs state ["yok"] kalır.
 */
export const SHOW_ETIKET_CUSTOMIZATION_STEP = false;

// ============================================================
// SARIM DETAY (Step 5) — göbek çapı
// ============================================================

/**
 * Göbek çapı seçici.
 *
 * Sefa kararı 20 May:
 *   - false → tek standart badge gösterilir (76mm)
 *   - 25/40mm seçenekleri gizli (partner endüstri standardı 76mm)
 */
export const SHOW_ETIKET_CORE_SIZE_PICKER = false;

/** Standart göbek çapı — picker kapalıyken sabit değer (mm). */
export const ETIKET_DEFAULT_CORE_SIZE = 76;

// ============================================================
// TABAKA ETİKET — koşullu gizleme (Aşama C ön-hazırlık)
// ============================================================

/**
 * Kraft seçildiyse kaplama adımı render etmesin
 * (kraft + selefon kombinasyonu üretilemez).
 *
 * NOT: HIDDEN_ETIKET_MATERIALS şu an "kraft"u zaten gizliyor →
 * tabakada kraft seçilemez, bu flag ileride kraft tabakaya açıldığında
 * devreye girer.
 */
export const HIDE_COATING_WHEN_KRAFT = true;
