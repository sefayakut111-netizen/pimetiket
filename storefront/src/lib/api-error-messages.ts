/**
 * API hata kodlarını kullanıcıya gösterilecek Türkçe/İngilizce mesajlara çevirir.
 */

type Locale = "tr" | "en";

const MESSAGES: Record<string, { tr: string; en: string }> = {
  order_status_not_uploadable: {
    tr: "Bu aşamada tasarım yüklenemez. Sipariş durumunu kontrol et.",
    en: "Design upload is not allowed at this stage.",
  },
  mime_mismatch: {
    tr: "Dosya türü desteklenmiyor. PDF, PNG veya JPG yükle.",
    en: "Unsupported file type. Upload PDF, PNG, or JPG.",
  },
  invalid_body: {
    tr: "Geçersiz istek. Sayfayı yenileyip tekrar dene.",
    en: "Invalid request. Refresh and try again.",
  },
  forbidden: {
    tr: "Bu işlem için yetkin yok.",
    en: "You don't have permission for this action.",
  },
  order_not_found: {
    tr: "Sipariş bulunamadı.",
    en: "Order not found.",
  },
  Unauthorized: {
    tr: "Oturum açman gerekiyor.",
    en: "You need to sign in.",
  },
  open_help_requests: {
    tr: "Açık destek talebi vardı. Operatör yanıtını bekle veya talebi kapat.",
    en: "There is an open support ticket. Wait for a reply or close it.",
  },
  pending_items: {
    tr: "Tüm kalemleri onaylamadan devam edemezsin.",
    en: "Approve all items before continuing.",
  },
  paytr_refund_rejected: {
    tr: "İade banka tarafından reddedildi. Destek ile iletişime geç.",
    en: "Refund was rejected by the bank. Contact support.",
  },
  refund_init_failed: {
    tr: "İade başlatılamadı. Biraz sonra tekrar dene.",
    en: "Refund could not be started. Try again later.",
  },
  refund_already_in_progress: {
    tr: "Bu sipariş için iade işlemi zaten devam ediyor.",
    en: "A refund is already in progress for this order.",
  },
  total_mismatch: {
    tr: "Sepet tutarı güncellendi. Sepeti yenileyip tekrar dene.",
    en: "Cart total changed. Refresh your cart and try again.",
  },
  pricing_validation_failed: {
    tr: "Fiyat doğrulaması başarısız. Sepeti yenileyip tekrar dene.",
    en: "Price validation failed. Refresh your cart and try again.",
  },
  coupon_invalid: {
    tr: "Kupon geçersiz veya kullanılamıyor. Kodu kontrol edip tekrar dene.",
    en: "Coupon is invalid or cannot be used. Check the code and try again.",
  },
  subtotal_mismatch: {
    tr: "Sepet tutarı güncellendi. Sepeti yenileyip tekrar dene.",
    en: "Cart subtotal changed. Refresh your cart and try again.",
  },
  shipping_mismatch: {
    tr: "Kargo ücreti güncellendi. Sepeti yenileyip tekrar dene.",
    en: "Shipping fee changed. Refresh your cart and try again.",
  },
  min_order_not_met: {
    tr: "Minimum sipariş tutarına ulaşılmadı.",
    en: "Minimum order amount not met.",
  },
  max_order_exceeded: {
    tr: "Maksimum sipariş tutarı aşıldı.",
    en: "Maximum order amount exceeded.",
  },
  checkout_in_progress: {
    tr: "Devam eden bir ödeme oturumun var. Diğer sekmeyi kapat veya birkaç dakika bekle.",
    en: "You already have a checkout in progress. Close the other tab or wait a few minutes.",
  },
  return_not_eligible: {
    tr: "Bu sipariş için iade talebi oluşturulamaz.",
    en: "A return cannot be created for this order.",
  },
  return_already_pending: {
    tr: "Bu sipariş için zaten incelenen bir iade talebi var.",
    en: "A pending return already exists for this order.",
  },
  payment_failed: {
    tr: "Ödeme tamamlanamadı.",
    en: "Payment could not be completed.",
  },
  amount_mismatch: {
    tr: "Ödeme tutarı uyuşmadı. Destek ile iletişime geç — kartından çekim olmuş olabilir.",
    en: "Payment amount mismatch. Contact support — your card may have been charged.",
  },
  rpc_finalize_failed: {
    tr: "Ödemen alındı ama sipariş oluşturulamadı. Destek ekibimiz bilgilendirildi — kısa sürede dönüş yapacağız.",
    en: "Payment received but order could not be created. Support has been notified.",
  },
};

export function mapApiError(
  code: string | undefined | null,
  locale: Locale = "tr",
  fallback?: string
): string {
  if (!code) {
    return (
      fallback ??
      (locale === "tr" ? "Bir hata oluştu." : "Something went wrong.")
    );
  }

  const normalized = code.trim();
  const entry = MESSAGES[normalized];
  if (entry) return entry[locale];

  if (normalized.startsWith("HTTP ")) {
    return locale === "tr"
      ? "Sunucu hatası. Biraz sonra tekrar dene."
      : "Server error. Try again later.";
  }

  if (normalized.includes("init_failed_")) {
    return locale === "tr"
      ? "Yükleme başlatılamadı. Dosyayı kontrol edip tekrar dene."
      : "Upload could not be started. Check the file and try again.";
  }

  return (
    fallback ??
    (locale === "tr"
      ? "İşlem tamamlanamadı. Tekrar dene veya destek ile iletişime geç."
      : "Action failed. Try again or contact support.")
  );
}
