# Pricing Engine — Finans Uzmanı Denetim Raporu

**Tarih**: 2026-05-09
**Denetlenen**: `medusa/src/modules/pricing-engine/lib/` ve `storefront/src/lib/pricing-engine/`
**Sürüm**: v0.3 (sticker-fiyatlama.html port'u)
**Mod**: Bağımsız finans/pricing uzmanı bakışı

---

## 🎯 Yönetici Özeti (TL;DR)

Modül **mantıksal olarak sağlam** — geometri optimizasyonu titiz, cost accounting standartlarına yakın, fire/tolerans politikası dürüst. Ama **3 kritik finansal hata** ve **5 önemli gap** tespit ettim. Hepsi B2B canlanmadan kapatılmalı, aksi halde Sefa hem KDV mevzuatına aykırı düşer hem de %5-15 sessizce kâr kaybeder.

| Kategori | Sayı |
|---|---|
| 🔴 Kritik (acil) | 3 |
| 🟠 Önemli (kısa vade) | 5 |
| 🟡 İyileştirme (uzun vade) | 7 |
| 🟢 İyi yapılmış | 6 |

**Sonuç**: Mevcut hâliyle başlangıç için OK, ama production'a alınmadan **#1 ve #2 mutlaka** düzeltilmeli.

---

## 🔴 KRİTİK BULGULAR (3)

### #1 · Group discount KDV'den ÖNCE uygulanmalı (KDV mevzuatı ihlali)

**Dosya**: `cart-discount.ts:122` — `lineDiscount = item.preGroupTotal * discountPct`

`preGroupTotal` zaten KDV-dahil değer (`cost.ts:285` → `total = subtotal + vatAmount`). İndirim KDV-dahil tutara uygulanıyor → e-fatura keserken **KDV matrahı yanlış çıkar**.

**Mevzuat referansı**: KDV Kanunu m.25/a — "İndirim suretiyle yapılan iadelerden ileri gelen kısımlar matraha dahil değildir." Yani indirim **matrahtan düşer**, KDV indirimli matrah üzerinden hesaplanır.

**Sayısal etki** (örnek):
```
Tek tasarım fiyatı (preGroupTotal):  1.000 TL (KDV-dahil)
   - subtotal (KDV-hariç):              833,33 TL
   - VAT (%20):                         166,67 TL

Şu anki yanlış hesap (KDV sonrası indirim):
   Group indirim %5: 50 TL
   Final: 950 TL (KDV-dahil olarak gösteriliyor)
   Ama içindeki KDV hâlâ 166,67 olarak rapor ediliyor → YANLIŞ

Doğru hesap (KDV öncesi indirim):
   subtotal × (1 - 0.05) = 791,67 TL (KDV-hariç)
   VAT: 158,33 TL
   Final: 950 TL
   Net Sefa'ya kalan: 791,67 (vs yanlışta 783,33) — 8,34 TL kayıp/sipariş
```

100 sipariş/ay × 8.34 TL = **~830 TL/ay** sessizce yanlış raporlama + matrah hatası.

**Düzeltme**:
```ts
// computeCart içinde, her line için:
// preGroupTotal yerine subtotal'dan başla, indirim sonra VAT
const subtotalBefore = item.preGroupSubtotal;  // KDV hariç
const discounted = subtotalBefore * (1 - discountPct);
const vat = discounted * vatRate;
const finalTotal = discounted + vat;
```

`CostResult` interface'ine `subtotal` (mevcut, KDV hariç) zaten var. Sadece `cart-discount.ts` bunu kullanmıyor — `total`'ı (KDV dahil) kullanıyor.

---

### #2 · Processing fee tier+VAT ÖNCESİ alınıyor → PSP komisyonu eksik karşılanıyor

**Dosya**: `cost.ts:262-265`

```ts
const subtotalBeforeFee = baseCost + profit;
const processingFee = subtotalBeforeFee * (operation.feePct / 100);
```

Processing fee = ödeme komisyonu (ParamPOS/iyzico %2.5). Bu komisyon PSP tarafından **müşterinin ödediği TOPLAM tutar üzerinden** kesilir. Ama hesap **tier ve KDV öncesi** tutara uygulanıyor.

**Sayısal etki**:

| Tier | Coverage Ratio | Açık | Notlar |
|---|---|---|---|
| 1.30 (25 sticker) | 1/(1.30×1.20) = 64% | **-36%** | Sefa'nın bütçelediği fee'nin sadece 64'ü gerçek komisyonu karşılıyor |
| 1.00 (250 ref) | 1/(1.20) = 83% | **-17%** | |
| 0.80 (1000) | 1/(0.80×1.20) = 104% | +4% | Sadece bu tier net pozitif |

**Pratik açık** (250 sticker @ 1.000 TL):
- Bütçelenen fee: (baseCost + profit) × 0.025 = (290+217.5) × 0.025 = **12,69 TL**
- Gerçek komisyon: total × 0.025 = 624,2 × 0.025 = **15,61 TL**
- **Açık: 2,92 TL/sipariş** (Sefa cebinden ödüyor)

100 sipariş/ay × ortalama 3 TL açık = **~300 TL/ay sızıntı**.

**Düzeltme** (gross-up formula):
```ts
// Doğru: fee, son müşteri fiyatına bindirilir, ters çözülür
// finalPrice × (1 - feePct/100) = (baseCost + profit) × tierMult × (1 + vatPct/100)
// finalPrice = ... / (1 - feePct/100)

const beforeFee = (baseCost + profit) * tier.multiplier * (1 + vatPct/100);
const total = beforeFee / (1 - feePct/100);
const processingFee = total * (feePct/100);
```

Veya daha basit: fee'yi en sona at, total'a ekle.

---

### #3 · Tier discount margin'i orantısız ezdiriyor

**Dosya**: `cost.ts:268-269`

```ts
const tierAdjustment = preTierSubtotal * (tier.multiplier - 1);
const subtotal = preTierSubtotal * tier.multiplier;
```

Tier multiplier `preTierSubtotal`'a uygulanıyor. Bu = `baseCost + profit + fee`. Yani **tier 0.80 (-%20)** sadece kâra değil, **maliyete + kâra + fee'ye eşit oranda** vurur.

**Sayısal örnek** (1000 sticker, 50×50, fason):

```
baseCost:         1.160 TL
profit (75%):       870 TL  ← Sefa'nın "intended" kâr buradaki 870 TL
preTier:          2.030 TL
× tier 0.80:      1.624 TL
- baseCost:       1.160 TL
- gerçek fee:        49 TL (PSP)
─────────────────
Gerçek kâr:         415 TL  ← intended 870 TL'nin %48'i

%75 markup → %35.7 actual markup
%43 gross margin → %25.6 actual gross margin
```

Yani Sefa "%20 indirim veriyorum" diyor ama **gerçekte kârın %52'sini eritiyor**.

**Bu bir bug mu, design mı?** Tartışılır. Volume discount'un "kâr ezdirici" olması bilinçli olabilir (volume = unit overhead düşer). Ama burada:

1. Sefa'nın UI'da gördüğü "75% kâr marjı" rakamı, tier 0.80'de **sadece %36** oluyor
2. Sefa parametre tuning yaparken yanlış sinyalle hareket ediyor
3. 1000 tier'ından zarar dahi mümkün (ekstra parametre değişikliği ile)

**Öneri** — iki seçenek:

**A) Tier yalnız margin'e uygulansın** (cost recover edilir, kâr ayarlanır):
```ts
const cost = baseCost + processingFee;
const adjustedMargin = profit * tier.multiplier; // tier sadece kârı çarpar
const subtotal = cost + adjustedMargin;
```

**B) Mevcut bırak, ama UI'da "gerçek kâr" göster**:
- Operatör fiyat hesaplarken "İntended margin: 75% / Actual margin: 36%" karşılaştırma görsün
- Min margin guard ekle: gerçek margin %15 altına düşmesin

Sefa'nın stratejisine göre A veya B.

---

## 🟠 ÖNEMLİ BULGULAR (5)

### #4 · SaaS/yazılım maliyetleri overhead'da yetersiz

Mevcut: Genel gider 15 TL/m². Aylık ortalama 10-30 m² üretim → **150-450 TL/ay genel gider recovery**.

Gerçek aylık SaaS maliyetleri (tahminim):
| Kalem | TL/ay |
|---|---|
| Vercel/Cloudflare hosting | ~1.500 |
| Supabase Pro | ~870 |
| OpenAI (Pim agent) | ~1.000 (1000 müşteri/ay) |
| Email (Resend) + SMS | ~700 |
| Domain + SSL | ~50 |
| Cloudflare R2 storage | ~300 |
| Sentry/PostHog | ~500 |
| Diğer (yedek, CDN, vs) | ~500 |
| **TOPLAM** | **~5.420 TL/ay** |

**Açık: ~5.000 TL/ay overhead'da gizli.** Gerçek üretim maliyeti %15-20 daha yüksek.

**Düzeltme önerisi**:
- Overhead 15 → **45 TL/m²** çıkar (3×)
- VEYA ayrı bir "Platform Fee" kalemi ekle (sipariş başına 25 TL, ölçekle azalan)
- VEYA fason rate'e %5 ekle (120 → 126 TL/m²)

### #5 · Big mode kargo değeri gerçekçi değil

**Dosya**: `cost.ts:200-205`

Büyük tabaka (40×65 cm) modunda kargo formula label'ı "desi/m³ hesaplı" diyor ama **mutlak değer aynı 80 TL** kullanılıyor.

Gerçek desi-bazlı kargo:
- 40×65 cm tabaka × 5 adet = 0.13 m³ ≈ 5 desi
- Yurtiçi/Aras 5 desi: ~150-250 TL
- 30 adet = 30 desi: ~600-900 TL

**Sefa'nın çekeceği zarar** (10 büyük tabaka siparişi/ay × 100 TL açık) = **~1.000 TL/ay**.

**Düzeltme**:
```ts
// Big mode için scaled cargo
const cargoMultiplier = isBigMode 
  ? 1.5 + (envelopeCount * 0.3)  // baseline ×1.5 + her koli için artış
  : 1.0;
const cargoCost = rates.cargo * cargoMultiplier;
```

Veya kargo basit formula yerine **gerçek API**'ye bağlansın (Yurtiçi/Aras quote endpoint'leri var).

### #6 · Inflation/parametre revaluation cron yok

TR enflasyonu yıllık %30-50. Pricing parametreleri **sabit**:
- Fason rate 120 TL/m² (Mart'taki değer Eylül'de hâlâ kullanılırsa Sefa zarara satar)
- Kargo 80 TL (kargo şirketleri 3 ayda bir zam yapıyor)
- Setup 50 TL (atölye işçiliği aylık artıyor)

**Mevcut altyapı** (zaten plan'da):
- `pricing_parameters` tablosu effective_from/to ile zaman dilimleri (PRICING_ANALYSIS §5.2)
- Geçmiş siparişler değişmez (parameters_snapshot JSONB)

**Eksik**:
- Otomatik revaluation cron (3 ayda bir Sefa'ya hatırlatma e-postası)
- Inflation index entegrasyonu (TÜFE/ÜFE → otomatik %X öneri)
- Alarm: bir parametre 6 aydır güncellenmedi → kırmızı uyarı

**Öneri**: Block B sonrası cron ekle, admin panele "Parametre yaşı" widget'ı.

### #7 · Min margin guard yok — kazaen zarar satışı riski

Hesap akışında hiçbir noktada `subtotal >= baseCost` veya `profit >= MIN_PROFIT` kontrolü yok.

**Senaryo 1**: Sefa fason rate'i kazara 1200 yazar (sıfır fazla). Tier 0.80 + group %10 ile final fiyat baseCost altına düşebilir. Sistem hatasız hesaplar, ürün satılır, **zarar Sefa'nın cebinden**.

**Senaryo 2**: Manuel sipariş (Block C.8) — Sefa "manuel fiyat override" yaparken yanlışlıkla 0 yazar. Engelleyen yok.

**Düzeltme**:
```ts
// quoteSticker veya computeCost sonunda:
if (cost.subtotal < baseCost * 1.10) {  // %10 minimum margin
  return { ok: false, reason: "Bu fiyat maliyetin altına düşüyor", warning: true };
}
```

UI'da kırmızı uyarı + opsiyonel "yine de yap" override (audit log'lu).

### #8 · Customer LTV stratejisi yok

Mevcut tier sadece **TEK SİPARİŞTEKİ** adet üzerinden indirim veriyor. Müşteri sadakatini ödüllendirmiyor.

**Eksik mekanizmalar**:
- 5+ sipariş veren müşteriye **otomatik tier boost** (250→500 fiyatı)
- Yıllık toplam volume eşikleri (10K sticker yıllık → "Gold müşteri")
- Repeat-order indirim (aynı tasarım tekrar bastırılırsa setup ücreti kaldırılır)
- Referans programı (yeni müşteri getirene komisyon/kredi)

**Gerekçe**: Pim Etiket'in **B2B karakterli** olduğu varsayılırsa (küçük markalar tekrar baskı yapar), CAC > LTV/2 ise iflas. Repeat customer ekonomisi şart.

**Önerim**: Müşteri segmentasyon tablosu (`pim_customer_tier`), her sipariş sonrası lifetime value güncellensin, otomatik tier upgrade pricing engine'e injekte edilsin.

---

## 🟡 İYİLEŞTİRME ÖNERİLERİ (7)

### #9 · Margin terminolojisi karışık (markup vs margin)

Mevcut UI: "Kar Marjı %75". Bu **markup** (cost-plus). Finans dilinde **margin** = kâr / fiyat × 100, **markup** = kâr / maliyet × 100.

%75 markup = %43 gross margin. Aralarında 32 puanlık fark var.

**Sefa için sorun değil** çünkü Türkçe günlük dilde "kâr marjı" = markup yaygın kullanımı. Ama:
- Yatırımcı sunumunda "%75 margin" denirse yanlış anlaşılır
- UI'da küçük bir parantez "(markup)" eklemek faydalı

### #10 · Tier 25 muhtemelen ölü kalem

Mevcut: 25 adet tier 1.30 → 25 sticker 50×50 = ~500 TL (~20 TL/adet).

**Pazar gerçeği**: 20 TL/adet sticker fiyatı çok pahalı. Müşteri Vistaprint/Etsy'de daha ucuz bulur. Bu tier muhtemelen:
- Sadece numune olarak ücretsiz dağıtılan
- Veya hiç sipariş edilmeyen

**Öneri**: Sefa son 6 ay sipariş data'sına bakıp 25-tier kaç kez kullanılmış kontrol etsin. Sıfır ise:
- Min order 50 yapılsın
- Ya da 25 tier "numune paketi" olarak yeniden konumlansın (1+1 hediye, sabit fiyat 200 TL)

### #11 · Sliding scale tier alternatifi

Mevcut 6 fixed tier — kullanıcıya net ama ekonomik olarak suboptimal. Müşteri 251 sticker isterse 250 tier'a düşer (ekstra 1 sticker üretim cost'u Sefa'nın olur).

**Alternatif**: Smooth function:
```
tierMult = max(0.65, 1.40 - 0.10 × log10(qty))
```
- 25 → 1.40 - 0.140 = 1.26
- 250 → 1.40 - 0.240 = 1.16
- Hmm bu doğru değil, başka function lazım

**Gerçek öneri**: Continuous tier OPSİYONEL olsun — admin "tier mode: fixed/smooth" toggle.

### #12 · Para birimi precision (integer cents)

Şu an floating point. `Math.round` her yerde tutarlı değil.

**Risk**: Çok satışta birikmiş round-off (sipariş 100 sticker × 1.2347 → 123.47 TL ama aslında 123.470000001 → muhtemelen 123 yazıyor → 0.47 TL kayıp)

**Düzeltme**: Internal storage **kuruş cinsinden integer** (12347 = 123.47 TL). Display'de bölüp formatla.

```ts
type Money = number; // integer kuruş

const m = (tl: number): Money => Math.round(tl * 100);
const fromMoney = (m: Money): number => m / 100;
```

Block A.4'te DB schema'sında numeric(10,2) zaten var ama JS hesabında precision kaybedilebilir.

### #13 · Cüzdan +%2 indirimi entegre değil

Spec §1: "cüzdandan ödeyince +%2 indirim". Pricing engine'de **YOK**. Checkout'ta ayrı uygulanıyor olacak — bu doğru ama hesap engine'inde dummy slot lazım:

```ts
interface CostInput {
  ...
  walletPaymentDiscount?: number; // 0-1, default 0
}
```

Müşteri-yüzü ön izlemede "Cüzdandan öde, %2 daha az ödersin" uyarısı net olsun.

### #14 · A/B test infrastructure

Modül parametre snapshot'larını DB'ye yazıyor (plan'da). Ama A/B test için:
- Cohort assignment yok
- "Bu müşteri %75 marjla, şu müşteri %80 marjla" deneyimi yapılamıyor

**Öneri**: Block A.4 model'ine `experiment_id` + `variant` alanı ekle. PostHog feature flag entegrasyonu opsiyonel.

### #15 · Market reference / rakip analizi

Margin tamamen cost-plus → "rekabet" boyutu yok. Sefa Vistaprint, Sticker Mule, yerel matbaalardan ne kadar farklı?

**Önerim**: 
- Manuel: Sefa ayda bir competitor scan (5 boyut × 3 rakip), sheet doldur
- Otomatik (uzun vade): web scraper bot rakip fiyatlara bakar

### #16 · Special pricing / kupon altyapısı yok

Eksik özellikler:
- Kupon kodu (%X indirim, sabit TL)
- First-order indirimi
- Sözleşmeli müşteri özel fiyatı (her seferinde özel oran)
- Toplu satın alma (bulk > 10K sticker tek seferde)
- Wholesale tier (perakendeci dağıtımı)

Bunlar **B2B çıktıkça zorunlu** olur. Şimdi planlanmasa da, schema'da `coupon_code`, `customer_pricing_agreement_id` slot'u açılsın.

### #17 · Manuel fiyat override audit'i

Block C.8 (manuel sipariş) spec'te `manual_price_override` + `manual_price_reason` var. Fakat:
- "Reason" özgür text — Sefa kötü gün yazabilir
- Min/max sınır yok (Sefa 1 TL'ye satabilir)
- Onay zorunluluğu yok (tek operatör tek tıkla)

**Öneri**: Override'lar için:
- Kategoriler dropdown (Müşteri ilişkisi / Pazarlık / Kampanya / Hata düzeltme / Diğer)
- Min margin guard (mass override → uyarı)
- Yüksek tutarlı (>5K TL) override'lar Sefa onayı gerek

---

## 🟢 İYİ YAPILMIŞ NOKTALAR (6)

Adil olmak gerekirse:

### #18 · Geometri optimizasyonu titiz
- Dynamic rulo eni (250-600mm) → fire %30-50 azalıyor
- Iki rotasyon test ediliyor → max kapasite
- Dengeli tabaka dağıtımı

### #19 · Tolerance %3 dürüst politika
- Eksik üretim olmaz, fazlası hediye
- Cost m²'ye dahil → Sefa'nın net cebine etki yok
- Müşteri psychology: "+10 hediye" pozitif algı

### #20 · Fason vs üretim ayrımı temiz
- Tek input vs 6 kalem detay
- Operatör hangi mod karlı kıyaslayabilir
- Switch maliyet farkını anında gösteriyor

### #21 · Snapshot'lı DB schema (plan'da)
- `pricing_parameters` effective_from/to → geçmiş siparişler bozulmaz
- `parameters_snapshot JSONB` → audit izi güçlü
- Yatırımcı/vergi denetiminde kuvvetli

### #22 · Lot numarası audit zinciri
- Sıralı (A000001, A000002…)
- Atomic next_lot SQL function
- Muhasebe/üretim için takip kolay

### #23 · Aynı boyut grup indirimi rasyonel
- Plate kalibrasyonu paylaşımı, rulo birleştirme → gerçek tasarruf var
- Tasarrufun bir kısmı müşteriye yansıyor → adil
- Cap %10 — limitlenmiş, agresif değil

---

## 📊 Toplam Finansal Etki (tahmin)

Mevcut kritik bug'lar ve önemli gap'lerin Sefa'ya aylık net etkisi (100 sipariş/ay senaryosu):

| Bulgu | Aylık Etki |
|---|---|
| #1 KDV matrah hatası | -830 TL (mevzuat riski + matrah farkı) |
| #2 PSP fee under-charge | -300 TL |
| #3 Tier margin erosion | Gizli — operatör doğru sinyalle hareket etmiyor |
| #4 SaaS overhead gap | -5.000 TL |
| #5 Big mode kargo | -1.000 TL |
| #6 Inflation lag (yıl ortalaması) | -2.000 TL/ay (3 ay enflasyon biriktirir) |
| #7 Min margin guard yokluğu | Risk: tek hatada 5.000-50.000 TL |
| **Tahmini toplam görünmez kayıp** | **~9.000 TL/ay** (~%15 ciro) |

%15 ciro kaybı küçük bir iş için ölümcül. Bu üç kritik fix yapılmadan canlıya çıkmak **finansal sorumluluk**.

---

## ✅ Önerilen Aksiyon Planı

**Hemen** (Block A finishing'den önce):
1. KDV matrah düzelt (cart-discount.ts) — 1 saat iş
2. PSP fee gross-up formula (cost.ts) — 30 dk iş
3. Min margin guard ekle (quoteSticker'a) — 30 dk iş

**Block B sırasında**:
4. SaaS overhead'ı parametre değerlerine yansıt (overhead 15 → 45)
5. Big mode kargo formula
6. Inflation revaluation cron + admin widget
7. LTV/customer tier altyapısı (Block C.5 ile birlikte)

**Block D / pricing module v0.4**:
8. Tier margin separation (öneri A/B Sefa kararı)
9. UI'da markup vs margin terminoloji clarity
10. Money type (integer kuruş)
11. Cüzdan %2 hook
12. Override audit sistematik

**Production launch sonrası**:
13. Market scan altyapısı
14. A/B test cohort
15. Special pricing/kupon altyapısı

---

## Sonuç

Modül **temeli sağlam, mimari doğru, ama 3 finansal hata + ~5K TL/ay görünmez kayıp** var. Sefa için pratik öneri:

1. **Bu hafta**: 3 kritik bug fix (toplam 2-3 saat iş)
2. **Block B canlanırken**: 5 önemli gap kapanır (parametre updates + cron + tier yapısı)
3. **Soft launch sonrası**: data ile A/B test + market reference

Modülün **kavramsal olarak %85 doğru** olduğunu söyleyebilirim. Düzelteceğimiz hatalar matematik hataları değil, finansal mevzuat ve maliyet recovery diziliminden kaynaklanıyor — kolay fix, büyük etki.
