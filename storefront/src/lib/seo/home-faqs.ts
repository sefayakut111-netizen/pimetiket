/** Anasayfa SSS — TR (JSON-LD için sabit teslim metni; UI site_settings'ten güncellenir).
 *  Üretim süreleri kanonik kaynaktan (site-facts → PIM_PRODUCTION_BUSINESS_DAYS). */
import { PIM_PRODUCTION_BUSINESS_DAYS } from "@/lib/pim/site-facts";

export const HOME_FAQ_ITEMS = [
  {
    q: "Pim Etiket'te minimum kaç adet sipariş verilebilir?",
    a: "Rulo etiket siparişleri 1.000 adetten, tabaka etiket siparişleri 250 adetten, sticker siparişleri ise 25 adetten başlamaktadır. Tabaka başına kaç ürün sığacağını konfigüratör ekranındaki canlı önizleme bölümünden görüntüleyebilirsiniz.",
  },
  {
    q: "Tasarım dosyam yok, nasıl bir yol izlemeliyim?",
    a: "Canva, Adobe Express ve Figma gibi ücretsiz online tasarım araçlarıyla tasarımınızı hazırlayıp PDF veya PNG formatında indirebilir, ardından sistemimize yükleyebilirsiniz. Sektörünüze uygun renk paleti ve font kombinasyonu önerileri için Pim Etiket sohbet asistanına sorularınızı yöneltebilirsiniz.",
  },
  {
    q: "Üretim ve teslimat süresi ne kadardır?",
    a: `Sticker siparişleri ${PIM_PRODUCTION_BUSINESS_DAYS.sticker} iş günü, tabaka etiket siparişleri ${PIM_PRODUCTION_BUSINESS_DAYS.tabaka} iş günü, rulo etiket siparişleri ${PIM_PRODUCTION_BUSINESS_DAYS.rulo} iş günü içinde üretilmektedir (tasarım onayından sonra; resmi tatiller hariç). Üretim tamamlandıktan sonra kargo süresi şehir bazında 1-3 iş günüdür. Tahmini teslim tarihi konfigüratör ve sepet ekranında otomatik olarak hesaplanıp gösterilir.`,
  },
] as const;
