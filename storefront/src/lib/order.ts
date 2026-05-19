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

/**
 * Sefa 19 May v68 (su borusu denetimi):
 * DB enum 14 değer, TS önceden 9 değerde idi → 5 değer kayıp:
 *   proof_generating, fason_assigned, human_review,
 *   human_review_failed, ready_to_ship.
 * Bunlar /api/admin/ai-qc/decide ve /api/admin/orders/[id]/status
 * endpoint'lerinde DB'ye set ediliyordu ama TS tipi tanımıyordu.
 * Şimdi 14/14 tam senkron.
 */
export type OrderStatus =
  // Sipariş alındı
  | "paid" // Geçici state — paid trigger anında awaiting_upload veya proof_pending'e geçer

  // Ödeme sonrası dosya bekleyiş (Mig 061)
  | "awaiting_upload" // Ödeme yapıldı ama tasarım henüz yüklenmedi — müşteri /siparis/[id]/tasarim-yukle'ye

  // AI QC akışı
  | "qc_pending" // Dosya yüklendi, AI ön kontrol + operatör sırasında
  | "qc_flagged" // AI flag'ledi, manuel inceleme gerek
  | "operator_review" // Operatör inceliyor
  | "human_review" // İnsan incelemesinde (operator_review alias'ı, Mig 039)
  | "human_review_failed" // İnceleme reddetti — müşteriye düzeltme iste (Mig 039)

  // Prova / Baskı Onay (Mig 059 — POC entegrasyonu)
  | "proof_generating" // Prova hazırlanıyor (otomatik render, Mig 039)
  | "proof_pending" // Müşteri baskı önizleme onay sayfasında (/onay/[id])
  | "proof_approved" // Tüm itemler müşteri tarafından onaylandı (Mig 059)

  // Üretim
  | "ready_to_ship" // AI QC + prova geçti, üretime hazır (Mig 039)
  | "fason_assigned" // Fason atölyeye atandı (Mig 039)
  | "in_production" // Fason atölyede üretimde

  // Sevkiyat
  | "shipped" // Kargoya verildi
  | "delivered" // Teslim edildi

  // İptal
  | "cancelled"; // İptal edildi
