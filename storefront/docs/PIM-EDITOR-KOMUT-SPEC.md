# Pim Editör Komut Alanı — Kapsam & Sınır Spesifikasyonu

> Tasarım dokümanı (kod değil). Pim editörde **tasarım YAPMAZ** — yalnızca editörün ZATEN sahip olduğu
> aksiyonları doğal dille tetikler + sonucu önizler. "Sesli kumanda" modeli.
> Editör state envanteri gerçek koddan çıkarıldı (`EditorShell.tsx`).

---

## TEMEL İLKE (değişmez)

1. **Pim yeni piksel üretmez.** Görsel oluşturma, eleman/metin/logo ekleme, serbest renk boyama, AI image-gen → **YASAK**.
2. **Pim sadece mevcut editör fonksiyonlarını çağırır.** Her komut = editörde zaten buton/slider olan bir işlem.
3. **Her komut deterministik bir aksiyona map'lenir.** Pim → `{action, params}` (Zod) → editör fonksiyonu. Map dışı istek → kibarca reddet.
4. **Önizleme + onay.** Pim aksiyonu uygular, kullanıcı canvas'ta görür, isterse "geri al". Pim sonucu cümleyle özetler.
5. **Belirsizse sor, uydurma.** "Daha büyük yap" → "Kaç mm?" diye sorar; rastgele değer atamaz.

---

## ✅ İZİNLİ KOMUTLAR (8 aksiyon — editörde gerçek karşılığı var)

| # | Aksiyon | Pim'e söylenebilecek örnek | Map'lendiği editör fonksiyonu | Parametre |
|---|---|---|---|---|
| 1 | `set_size` | "5 santim yap", "genişlik 80mm" | `setWidthMm`/`setHeightMm` (+ oran kilidi) | `widthMm?`, `heightMm?` |
| 2 | `set_cut_offset` | "kesim payını 3mm yap", "biraz dışarıdan kes" | `setOffsetMm` | `offsetMm` (-2…+5 clamp) |
| 3 | `set_smoothness` | "kenarları yumuşat", "köşeleri biraz yuvarlat" | `setSmoothness` | `smoothness` (0…100) |
| 4 | `apply_auto_cut` | "otomatik bıçak çıkar", "şeklini takip eden kesim" | `bladeTab='auto'` + `applyContour` (contour/hull) | `mode: "contour"\|"hull"` |
| 5 | `apply_shape_cut` | "yuvarlak kes", "kare kesim", "köşeleri ovalle" | `bladeTab='shape'` + `setShapeMode` | `shape: "circle"\|"rect"`, `cornerRadiusMm?` |
| 6 | `apply_template` | "Ø50 yuvarlak şablon", "bumper şablonu" | `applyTemplate(DIE_CUT_BY_ID)` | `templateId` (yalnız mevcut 65 şablondan) |
| 7 | `toggle_layer` | "bleed çizgisini göster", "beyaz katmanı aç" | `setLayers` | `layer: cut\|bleed\|safe\|white`, `on: bool` |
| 8 | `remove_background` | "arka planı sil", "zemini kaldır" | `handleBgRemove` (mevcut bg-removal) | — |
| 9 | `fit_view` | "ortala", "ekrana sığdır" | `fitContain`/`fitCenter`/`fitCover` | `mode` |
| 10 | `center_blade` | "bıçağı ortala" | `setBladeTransform(DEFAULT)` | — |

> NOT: 10 aksiyon ama hepsi mevcut. Yeni editör yeteneği EKLENMİYOR — Pim sadece bunlara erişiyor.
> İstersen Faz 1'i 5 aksiyona indir (1,2,5,8,9) — en sık kullanılanlar.

---

## ⭐ PİM'İN ASIL DEĞERİ — Gerçek dünya ölçü referansı → mm + bıçak

Pim'in en faydalı işi: kullanıcı **mm bilmez ama günlük objeyi bilir**. "1 lira boyutu", "kartvizit kadar",
"bardak altı gibi" → Pim bunu somut mm + uygun şekle çevirir.

**Örnek akış:**
> Kullanıcı: "Logomu 1 lira boyutunda bastırmak istiyorum."
> Pim: `set_size {widthMm:26.15, heightMm:26.15}` + `apply_shape_cut {shape:"circle"}`
> Pim yanıt: "1 TL ≈ 26 mm çap. Yuvarlak kesim uyguladım, logon madeni para boyutunda. Uygun mu?"

### Ölçü çözümleme — 2 KATMANLI GÜVEN MODELİ

Her objeyi tabloya koymak imkansız. Çözüm: **tablo = kesin/güvenilir**, **LLM = tahmini ama görünür-işaretli**.
Riski yok etmeye çalışmıyoruz — **görünür kılıp kullanıcıya onaylatıyoruz**. Sessiz yanlış uygulama = tek gerçek tehlike.

**Katman 1 — Küratörlü tablo (`src/lib/editor/size-references.ts`, Sefa yönetir) → KESİN, güvenle uygula:**

Sık + tanınır + hata maliyeti yüksek objeler. Bunlar tam değer; "yaklaşık" denmez.

| Referans (anahtar kelimeler) | widthMm | heightMm | Şekil |
|---|---|---|---|
| 1 TL / madeni para | 26.15 | 26.15 | circle |
| 50 kuruş | 23.85 | 23.85 | circle |
| Kartvizit | 85 | 55 | rect (r3) |
| Kredi/banka kartı | 85.6 | 53.98 | rect (r3) |
| CD/DVD | 120 | 120 | circle |
| Bardak altı | 90 | 90 | circle |
| A6 / kartpostal | 148 | 105 | rect |
| A7 | 105 | 74 | rect |

→ Pim: *"1 TL = 26 mm çap, yuvarlak kesim uyguladım."* (kesin dil, onay opsiyonel)

**Katman 2 — LLM tahmini (tabloda yoksa) → YAKLAŞIK, işaretli + onay ZORUNLU:**

"Telefon arkası", "anahtarlık", "kupa yüzü" gibi tabloda olmayan ama LLM'in makul tahmin edebileceği objeler.
LLM `{widthMm, heightMm, confidence, isEstimate:true}` döndürür. Pim **asla sessiz uygulamaz** — her zaman:
1. "yaklaşık" der, 2. değeri gösterir, 3. onay/düzeltme ister.

→ Pim: *"Anahtarlık genelde ~40 mm olur, **tahmini** olarak 40×40 uyguladım. Gerçek ölçün farklıysa mm olarak yaz, düzelteyim."*

**Katman 3 — Belirsiz/saçma → tahmin etme, sor:**
- Soyut ("büyükçe", "orta boy") → `clarify`: "Kaç cm olsun?"
- LLM düşük güven (`confidence < 0.5`) → tahmini uygulamadan önce **mm sorar**.

### Guardrail'ler (her iki katmanda)

- **Clamp:** her ölçü `5mm ≤ x ≤ 500mm` aralığına sıkıştırılır. Dışı → `clarify` (baskı boyutu makul değil).
- **isEstimate bayrağı:** Katman 2 sonucu UI'da küçük "yaklaşık" rozetiyle gösterilir; kullanıcı görmeden geçemez.
- **Önizleme + gerçek dünya:** kullanıcı zaten canvas'ta boyutu görür + "1 TL kadar" dediği objeyi elinde tutabilir → tahmin kabaca doğruysa fark eder. Felaket senaryo sadece *sessiz* yanlış uygulama; onu kapattık.
- **Tablo büyür:** Katman 2'de sık çıkan objeler loglanır → Sefa periyodik olarak tabloya (Katman 1'e) taşır. Zamanla tahmin payı azalır.

### Aksiyon: `set_size_from_reference`

| Aksiyon | Pim'e söylenebilecek | Map | Parametre |
|---|---|---|---|
| `set_size_from_reference` | "1 lira boyutunda", "anahtarlık kadar" | tablo lookup → yoksa LLM tahmini → `setWidthMm/Height` (+şekil) | `referenceKey?` (tablo), `estimatedW/H?`, `confidence`, `isEstimate` |

**Kural özeti:** Tablo varsa kesin uygula. Yoksa LLM tahmin eder ama **"yaklaşık" + onay** zorunlu. Belirsizse mm sorar.
Her durumda 5–500mm clamp. Yani LLM serbest ama **sessiz yanlış basım imkansız**.

---

## ⭐⭐ PİM ÜRÜN & SINIR FARKINDALIĞI — sistemden okur, UYDURMAZ

Pim sadece ölçü çevirmez; **"bu ürünümüzde basılabilir mi, sınırları ne"** sorusunu da yanıtlamalı. Bu veri
**zaten sistemde tanımlı** (gerçek koddan çıkarıldı) — Pim'in context'ine **runtime'da enjekte edilir**,
LLM hafızasından DEĞİL.

### Gerçek ürün sınırları (koddan — Pim'e context olarak verilir)

| Ürün | Min/Max boyut | Min/Max adet | Kaynak (tek doğru) |
|---|---|---|---|
| **Sticker** | 25–400mm (W) × 25–650mm (H), min kenar 25mm | 25–1000 adet | `sticker-customer-pricing.ts:38-72` |
| **Etiket (rulo)** | pricebook W×H matrisi | 1000–10000 adet | `pricing-engine/constants.ts:142`, `pricing-pricebook-types.ts` |
| **Editör tuval** | 5–500mm | — | `editor/coords.ts:22-23` |
| **Malzemeler** | aktif malzeme listesi (kuşe, şeffaf, mat…) | — | `pricing_config.materials` (DB, canlı) |
| **Kesim şablonları** | 65 die-cut (yuvarlak/kare/oval/bumper) | — | `die-cut-templates.ts` |

> Bu değerler **sabit gömülmez** — Pim'in komut handler'ı çağrı anında `getLivePricingConfig()` +
> sabitlerden okur, system prompt'a "şu an geçerli sınırlar: ..." diye enjekte eder. Sefa admin'den
> qty/malzeme değiştirince Pim **otomatik güncel** olur (ayrı bakım yok).

### Pim'in sınır-farkında davranışı

**Senaryo A — ölçü ürün sınırını aşıyor:**
> Kullanıcı: "A4 boyutunda sticker istiyorum" (210×297mm)
> Pim: set_size'ı clamp'lemez, **uyarır**: "Sticker'da en büyük 400×650mm — A4 (210×297) sınır içinde, uyguladım. Ama 297mm uzun kenar; emin misin?"
> Kullanıcı: "2 metre olsun" → Pim: "Sticker'da maks 65cm. Bu boyut için bize ulaş, özel üretim bakarız." (reddetmez, yönlendirir)

**Senaryo B — yanlış ürün:**
> Kullanıcı: "Logomu 1 lira boyutunda, 50 adet etiket olarak istiyorum"
> Pim: "Etikette min 1000 adet. 50 adet için **sticker** daha uygun — 1 TL boyutu (26mm) sticker sınırları içinde. Sticker'a geçeyim mi?"

**Senaryo C — malzeme sorusu:**
> Kullanıcı: "Şeffaf zemine basabilir miyim?"
> Pim: aktif malzeme listesinden okur → "Evet, şeffaf malzememiz var. Editörde arka planı kaldırırsan şeffaf basılır."

### Yeni aksiyon: `suggest_product` (ürün yönlendirme)

| Aksiyon | Pim'e söylenebilecek | Yapar | Parametre |
|---|---|---|---|
| `suggest_product` | "bunu neye basayım", "etiket mi sticker mı" | Boyut+adet+şekli sistem sınırlarıyla karşılaştırır → uygun ürünü ÖNERİR (otomatik geçmez, "Sticker'a ekle"yi sunar) | `recommended: "sticker"\|"etiket"`, `reason` |

**Kural:** Pim **sınırı bilir ama kararı kullanıcıya bırakır.** Sınır aşımında: reddetme → açıkla + yönlendir
("bize ulaş" / "şu ürüne geç"). Sınır verisi her zaman canlı config'ten; Pim asla "galiba 1000 adettir" demez.

### Güvenlik — ürün verisi enjeksiyonu
- Sınırlar system prompt'a **server-side** enjekte edilir (kullanıcı manipüle edemez).
- LLM bir ürün/sınır "uydurursa" (context'te olmayan), handler validate eder → `clarify`/`reject`.
- Sefa kuralı korunur: cüzdan/puan YOK, "süresiz/garantili" YOK — Pim ürün konuşurken de bu kurallara tabi.

---

## 🟡 SINIRDA (yalnız vizyon onaylarsa — Faz 2)

| Aksiyon | Açıklama | Neden sınırda |
|---|---|---|
| `set_background_color` | "arka plana açık gri zemin koy" | Editörde HENÜZ YOK — düz renk dikdörtgen ekleme gerekir. Önce o özellik eklenmeli, sonra Pim'e bağlanır. |
| `suggest_product` | "bunu hangi ürüne basayım?" | Pim öneri verir (yuvarlak bıçak → yuvarlak sticker) ama otomatik geçiş YAPMAZ, sadece "Sticker'a ekle"yi önerir. |

---

## ❌ YASAK KOMUTLAR (Pim net reddeder)

Pim bu tip isteklere **kibar, kısa ret** verir ("Ben tasarım yapamam, sadece bıçak ve boyut ayarlarına yardım ederim"):

| Kategori | Örnek istek | Neden yasak |
|---|---|---|
| Görsel üretme | "kedili tasarım yap", "logo çiz" | Editör tasarım aracı değil; AI image-gen kapsam dışı |
| Eleman ekleme | "buraya metin yaz", "yıldız ekle", "çerçeve koy" | Serbest tasarım = kapsam patlaması |
| Serbest manipülasyon | "logoyu sola al", "rengi maviye çevir", "şunu büyüt şunu küçült" | Eleman-bazlı düzenleme yok; editör tek görsel + bıçak |
| Renk/efekt | "parlaklık artır", "filtre uygula", "gölge ekle" | Raster düzenleme kapsam dışı |
| Çoklu görsel | "ikinci bir resim ekle", "kolaj yap" | Tek tasarım akışı |
| Sipariş/ödeme | "siparişi tamamla", "ödemeyi yap" | Pim editörde aksiyon tetikler, checkout YAPMAZ (güvenlik) |
| Sistem dışı | "fiyatı indir", "kupon ver" | Editör Pim'i ≠ satış Pim'i; kapsam izole |

**Ret cümlesi örneği (marka sesine uygun, dalkavuk yok):**
> "Onu yapamam — ben sadece kesim bıçağı, boyut ve katman ayarlarında yardımcı olurum. Tasarımı sen hazırla, ben baskıya hazırlayayım."

---

## TEKNİK İSKELET (ai-llm danışman notu — Cursor'a sonra)

- **Model:** `gpt-4o-mini` (ucuz, strict JSON yeter — vision gerekmez, sadece metin→komut).
- **Yapı:** `generateObject` + Zod discriminated union schema (yukarıdaki 10 action).
- **System prompt:** "Sen Pim'sin. SADECE şu aksiyonları döndürebilirsin: [liste]. Kapsam dışı istek → `{action:'reject', reason}`. Belirsiz parametre → `{action:'clarify', question}`." Few-shot 3-4 örnek.
- **Akış:** kullanıcı yazar → mini LLM → `{action,params}` → editör fonksiyonu çağrılır → canvas güncellenir → Pim Türkçe özet ("Tamam, yuvarlak Ø50 kesim uyguladım."). Belirsizse `clarify` → soru sorar.
- **Maliyet:** komut başına ~$0.0002 (gpt-4o-mini, kısa). `ai_cost` auditor zaten izliyor.
- **Güvenlik:** LLM çıktısı whitelist'e karşı VALIDATE edilir — schema dışı action editöre ULAŞMAZ. Parametre clamp (offset -2…+5, smoothness 0…100, size makul mm aralığı) server/client iki tarafta.
- **UI:** editör sağ/alt panelde dar bir komut input'u (chat değil — tek satır komut + "Pim yapsın"). Sefa kuralı: bot menüsü/hazır chip YOK; serbest yazı + Pim yorumlar.

---

## ÖNERİLEN SIRA

1. **OpenCV fix otursun** (devam ediyor) — çekirdek çalışmadan üstüne komut katmanı koymak körlük.
2. **Bıçak→ürün handoff** (`suggest_product` temeli) — küçük, handoff'a `bladeShape`+`cutMode` ekle.
3. **Pim komut alanı Faz 1** — 5 aksiyon (size, offset, shape, bg-remove, fit). Whitelist + clamp + reject.
4. **Faz 2** — kalan aksiyonlar + (vizyon onaylarsa) düz renk arka plan → `set_background_color`.

---

## KARAR BEKLEYEN (Sefa)

- Faz 1'de **kaç aksiyon**? (10 hepsi mi, yoksa 5 çekirdek mi?)
- `set_background_color` editöre eklensin mi? (önce editör özelliği, sonra Pim komutu)
- Komut input UI: editörün neresinde? (sağ panel altı / alt bar / floating)
