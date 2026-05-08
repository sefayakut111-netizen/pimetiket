/**
 * Pim Etiket — order helpers (storefront-side).
 *
 * OrderStatus tipi PLAN.md §I'daki state machine'in basitleştirilmiş
 * hali. F+I adımında Medusa backend ile tam senkron olacak.
 *
 * Müşteri view (/siparislerim) ve admin view (/admin/siparisler) ortak
 * tip kullanır; STATUS_META label'ları her sayfada kendi konteksti
 * için tanımlanır (müşteri "Kontrolde" görür, admin "AI flag" gibi
 * daha teknik label görür).
 */

export type OrderStatus =
  | "paid" // Ödendi, dosya yüklenmesi bekleniyor
  | "qc_pending" // Dosya yüklendi, AI ön kontrol + operatör sırasında
  | "qc_flagged" // AI flag'ledi, manuel inceleme gerek
  | "operator_review" // Operatör inceliyor
  | "proof_pending" // Prova hazır, müşteri onayı bekleniyor
  | "in_production" // Fason atölyede üretimde
  | "shipped" // Kargoya verildi
  | "delivered" // Teslim edildi
  | "cancelled"; // İptal edildi
