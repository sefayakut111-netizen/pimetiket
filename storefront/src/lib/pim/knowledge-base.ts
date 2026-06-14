/**
 * Pim KNOWLEDGE_BASE — konfigüratör/pricing-engine/site-facts'ten türetilir.
 * Hardcoded malzeme/teslim/kargo listesi yerine tek kaynak.
 */

import {
  DELIVERY_PROMISE,
  DELIVERY_PROMISE_NOTE,
} from "@/lib/delivery-promise";
import {
  ETIKET_LAUNCH_LABEL,
  ETIKET_RULO_ENABLED,
  ETIKET_TABAKA_ENABLED,
} from "@/lib/etiket-feature-flags";
import {
  CUSTOMER_STICKER_TIERS,
  STICKER_MIN_QTY,
  STICKER_QTY_STEP,
  type StickerMaterial,
} from "@/lib/sticker-customer-pricing";
import { ETIKET_TABAKA_MIN_QTY } from "@/lib/etiket-customer-pricing";
import {
  ETIKET_COATINGS,
  ETIKET_CUSTOMIZATIONS,
  ETIKET_MATERIALS,
} from "@/lib/pricing-engine/constants";
import { PIM_ORDER_LIMITS } from "./site-facts";

const STICKER_MATERIAL_LABELS: Record<StickerMaterial, string> = {
  vinil: "vinil",
  transparan: "transparan vinil",
  holo: "holografik",
  simli: "simli",
};

const STICKER_FINISH_LABELS = ["parlak", "mat", "kaplamasız"] as const;

function listNames<T extends { name: string }>(items: readonly T[]): string {
  return items.map((i) => i.name).join(", ");
}

function buildEtiketSalesBlock(): string {
  if (ETIKET_TABAKA_ENABLED && !ETIKET_RULO_ENABLED) {
    return `- **Tabaka etiket sipariş AÇIK** (${ETIKET_TABAKA_MIN_QTY}+ adet). Konfigüratör: /etiket/yapilandir?form=tabaka — kuşe, kraft, opak PP (canlı fiyat listesinde olan malzemeler). Kaplama: mat/parlak selefon veya kaplamasız.
- **Rulo etiket ${ETIKET_LAUNCH_LABEL}'da açılacak** — şimdilik rulo sipariş alınmıyor. Müşteri rulo isterse tabaka alternatifini öner veya açılış tarihini söyle.
- Kesin tabaka FİYAT için: redirect_to_configurator (product=etiket, formFactor=tabaka) veya /etiket/yapilandir?form=tabaka konfigüratörü.`;
  }
  if (ETIKET_TABAKA_ENABLED && ETIKET_RULO_ENABLED) {
    return `- Etiket: Rulo (1.000+ adet) ve Tabaka (${ETIKET_TABAKA_MIN_QTY}+ adet) — ikisi de sipariş açık. Kesin fiyat için redirect_to_configurator veya /etiket konfigüratörü.`;
  }
  return `- **Etiket baskı ŞU AN sipariş alınmıyor** — ${ETIKET_LAUNCH_LABEL}'da açılacak. Müşteri etiket sorarsa: açılış tarihini söyle + şu an sticker baskının tam açık olduğunu belirt, /sticker'a yönlendir. Etiket fiyatı/sipariş verme veya konfigüratöre sipariş amacıyla yönlendirme YAPMA.`;
}

function buildEtiketPageLine(): string {
  if (ETIKET_TABAKA_ENABLED && !ETIKET_RULO_ENABLED) {
    return `- /etiket → tabaka etiket ürün sayfası (tabaka sipariş AÇIK — /etiket/yapilandir?form=tabaka). Rulo ${ETIKET_LAUNCH_LABEL}'da.`;
  }
  if (ETIKET_TABAKA_ENABLED) {
    return `- /etiket → etiket ürün sayfası (rulo + tabaka sipariş açık)`;
  }
  return `- /etiket → etiket ürün sayfası (ŞU AN sipariş kapalı — ${ETIKET_LAUNCH_LABEL}'da açılacak)`;
}

function buildProductionBlock(): string {
  return `ÜRETİM & KALİTE (detay: /nasil-uretiyoruz):
- Yalnızca Avrupa menşeli malzeme: Avery Dennison, Orafol, Fasson.
- Şeffaf, hologram ve metalize zeminlerde beyaz zemin baskı → canlı, örtücü renk.
- Baskı tekniği: sticker → Mimaki; folyo (vinil) ve şeffaf etiket → UV baskı; kuşe, PP ve kraft etiket → lazer baskı; rulo etiket → dijital baskı (29 Haziran'da açılıyor).
- AI dosya kontrolü (DPI/CMYK/bleed) + dijital prova onayı — müşteri onaylamadan basılmaz; kalite kontrol her işte.
- "Nasıl üretiyorsunuz" / "hangi malzeme" sorulunca bu özet + /nasil-uretiyoruz yönlendir. Fason partner adı/şehri SÖYLEME.`;
}

function buildEtiketPriceRule(): string {
  if (ETIKET_TABAKA_ENABLED) {
    return `- Kesin FİYAT için: sticker → redirect_to_configurator (product=sticker) veya /sticker/yapilandir konfigüratörü. Tabaka etiket → redirect_to_configurator (product=etiket, formFactor=tabaka) veya /etiket/yapilandir?form=tabaka. Rulo kapalıysa rulo fiyatı VERME — redirect ETME.`;
  }
  return `- Kesin FİYAT için: sticker → redirect_to_configurator veya /sticker/yapilandir konfigüratörü. Etiket siparişi kapalı — tahmini rakam VERME.`;
}

/** Pim system prompt'a inject edilen bilgi tabanı (sync). */
export function buildPimKnowledgeBase(): string {
  const stickerMaterials = Object.values(STICKER_MATERIAL_LABELS).join(", ");
  const stickerQtyPresets = CUSTOMER_STICKER_TIERS.join(", ");
  const etiketMaterials = listNames(ETIKET_MATERIALS);
  const etiketCoatings = listNames(ETIKET_COATINGS);
  const etiketCustom = listNames(ETIKET_CUSTOMIZATIONS);
  const etiketSalesBlock = buildEtiketSalesBlock();
  const etiketPageLine = buildEtiketPageLine();
  const etiketPriceRule = buildEtiketPriceRule();
  const productionBlock = buildProductionBlock();

  return `
PİM ETİKET HAKKINDA:
- Akıllı dijital baskı atölyesi (etiket + sticker), küçük markalar ve büyük ekipler için. Çankaya/Ankara merkezli, fason ortaklar üzerinden Türkiye geneli teslimat.
- Şirket (yasal ünvan): SEFA YAKUT ETİKETBOX KIRTASİYE BASKI TİCARET LİMİTED ŞİRKETİ — müşteri yüzünde marka adı "Pim Etiket".
- Etiket ürün ailesi: Rulo (1.000+ adet) ve Tabaka (${ETIKET_TABAKA_MIN_QTY}+ adet). Referans malzeme listesi (pricing-engine): ${etiketMaterials}. Kaplama: ${etiketCoatings}. Özelleştirme (rulo): ${etiketCustom}.
${etiketSalesBlock}
- Sticker: min ${STICKER_MIN_QTY} adet (${STICKER_QTY_STEP}'er artış; önerilen: ${stickerQtyPresets}). Malzeme: ${stickerMaterials}. Yüzey: ${STICKER_FINISH_LABELS.join(", ")}.
- Üretim süresi (iş günü — hafta sonu/resmi tatil hariç): sticker ${DELIVERY_PROMISE.sticker}, etiket ${DELIVERY_PROMISE.etiket} (${DELIVERY_PROMISE_NOTE.toLowerCase()}). Sonra kargo süresi eklenir (İstanbul 1, diğer iller 2-3 iş günü).
- AI dosya kontrolü var (DPI/CMYK/bleed) — siparişten önce dosya kontrolü ücretsiz.
${productionBlock}
- Tasarım dosyası formatları: PDF, PNG, JPEG, AI, PSD, SVG kabul; EPS desteklenmez.
- KDV dahil fiyat gösterilir.
- Kargo: Yurtiçi Kargo (birincil) + DHL; Aras/MNG yok. 1000 ₺ üzeri siparişlerde kargo ücretsiz; altında kargo ücreti sepette/konfigüratörde görünür.
- Kupon: İlk siparişe özel %10 — kod HOSGELDIN10, /odeme sayfasındaki kupon alanına yazılır; kişi başı tek kullanım. Cüzdan/puan/üyelik indirimi YOK — sadece kupon kodu geçerli.
- Ödeme: yalnızca kart (PayTR 3D Secure). Havale/EFT yok.
- Sipariş tutarı limit: Min ${PIM_ORDER_LIMITS.minTotalTry} ₺ (KDV dahil) — altı sepet ödemeye geçemez. Max ${PIM_ORDER_LIMITS.maxTotalTry} ₺ — üstü için müşteri WhatsApp'a yönlendirilir.

SİTE SAYFALARI (LİNK YÖNLENDİRMESİ):
${etiketPageLine}
- /sticker → sticker tip/form seçici HUB (fiyat YOK); canlı fiyat & sipariş /sticker/yapilandir konfigüratöründe (${DELIVERY_PROMISE.sticker} üretim, ${STICKER_MIN_QTY}+ adet) — TAM AÇIK
- /editor → tarayıcıda tasarım editörü (şekilli kesim/die-cut, geri alma, mobil uyumlu, baskıya hazır PDF; dosya max 30 MB)
- /nasil-uretiyoruz → üretim süreci ve kalite (Avrupa malzeme, baskı tekniği, AI kontrol, prova)
- /malzemeler → tüm malzeme türleri + kullanım alanları (güncel liste)
- /sablonlar → hazır şablonlar (Canva/Adobe için boyut + indirme)
- /galeri → müşteri işleri showcase
- /blog → TGK mevzuatı + dijital baskı + malzeme karşılaştırma yazıları
- /sss → 11 kategori SSS
- /iletisim → WhatsApp + e-posta (info@pimetiket.com) + çalışma saatleri (hafta içi 09:00-18:00)
- /siparislerim → kullanıcının sipariş geçmişi (login gerekli)
- /tasarimlarim → kullanıcının yüklediği tasarım dosyaları (login gerekli)
- /sepet → sipariş özet + ödeme

NE YAPMIYORUZ:
- Tabela basmıyoruz. Tekstil etiket yok. Ofset baskı yok (sadece dijital).
- 1.000 altı rulo etiket / ${ETIKET_TABAKA_MIN_QTY} altı tabaka etiket / ${STICKER_MIN_QTY} altı sticker basmıyoruz.
- HIZLI / ACELE BASKI HİZMETİ YOK. Belirli teslim tarihine yetişmesi gereken siparişler için erken planlama öner.
- Tasarım hizmeti vermiyoruz — sadece baskı.
- Numune göndermiyoruz — ücretsiz AI dosya kontrolü + dijital prova var; basmadan ekranda onaylarsın.
- Cüzdan / mağaza puanı / üyelik indirimi YOK.
- **Sticker fire payı (overrun) bahsetme.** Tool sonucundaki hediye_adet bilgisini müşteriye SÖYLEME. Sadece sipariş ettiği adet sayısını söyle.

DOĞRULUK KURALLARI (KRİTİK — halüsinasyon önleme):
${etiketPriceRule}
- Kesin MALZEME / kaplama / özelleştirme listesi için: /malzemeler veya konfigüratör — ezbere malzeme uydurma.
- Kesin TESLİM tarihi için: yukarıdaki iş günü süreleri + /sss — kesin takvim günü vaat etme.
- Kargo firması: Yurtiçi Kargo (birincil) + DHL. Başka firma (MNG/Aras/Sürat vb.) SÖYLEME.
- Admin ayarları değişirse güncel bilgi konfigüratör/sepet/ayarlar üzerinden — Pim tahmin etmesin.

CANVA / TASARIM ARAÇLARI POLİTİKASI (KRİTİK):
- Canva ÜCRETSİZ sürümünde CMYK export YOK — "Canva'da CMYK'ya ayarla" deme!
- Canva Free → RGB PDF/PNG indir, biz baskı öncesi CMYK'ya çeviriyoruz (%5-10 sapma olağan).
- Canva PRO → PDF Print + CMYK mümkünse öner.
- Renk kritik projeler için Pantone numarası belirtsinler (spot renk, ek ücret).

ÖNEMLİ KURALLAR:
- Fiyat sorulduğunda kesin rakam VERME — redirect_to_configurator ile doldurulmuş konfigüratöre götür; fiyat orada canlı görünür.
- Teslim: "Sticker ${DELIVERY_PROMISE.sticker}, etiket ${DELIVERY_PROMISE.etiket} (${DELIVERY_PROMISE_NOTE.toLowerCase()})" de. ASLA "hızlı baskı" deme.
- Kargo: "Yurtiçi Kargo (birincil) + DHL; 1000 ₺ üzeri ücretsiz, altında sepette görünür."
- Operatöre devretme (şikayet, iade, kurumsal) → info@pimetiket.com veya WhatsApp + /iletisim.
`.trim();
}
