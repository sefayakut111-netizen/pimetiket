# Pim Etiket — Site Terimler Sözlüğü (TAM)

> Sitedeki tüm ürünler ve terimler neye karşılık geliyor. 3 domain'den (müşteri/UI, durum/enum/admin, fiyat/geometri) kapsamlı toplandı, kategoriye göre sıralandı.
> İşaret: **[m]** müşteriye görünür · **[iç]** iç/jargon (müşteriye GÖSTERİLMEZ).
> Kaynak: `product_cards` (mig 074+137), `tr.ts`, `order-summary.ts`, `pricing-engine/*`, `pricing-calc.ts`, `customer-status.ts`, `fason/status-labels.ts`, `admin-rbac.ts`, `types.ts`. Son güncelleme: 3 Haz 2026.

---

## 0) Çatı kavram — 3 AYRI ürün modülü
"tabaka" üç modülde farklı şey demek (en büyük karışıklık).
- **Sticker** [m, açık] — çıkartma; die-cut EN 1500 sabit × boy segment / sayfa rulo dizilim.
- **Rulo Etiket** [m, YAKINDA] — rulodan çıkan etiket; metrik/rulo fiyat.
- **Tabaka Etiket** [m, YAKINDA] — **33×45 cm SABİT** tabaka; sheet-based (tabaka × adet).

---

## 1) ÜRÜNLER

### Sticker kartları (`/sticker`) [m]
- **Özel Kesim Sticker** (`diecut`) — tasarım silüetine kesim
- **Yuvarlak / Dikdörtgen / Kare / Oval Sticker** (`circle/rectangle/square/oval`)
- **Bumper Sticker** (`bumper`) — uzun yatay
- **Yarı Kesim Sticker** (`kisscut`) — çevresi sağlam, tek tek çıkar
- **Şeffaf Sticker** (`clear`) — saydam zemin
- **Holografik Sticker** (`holo`) — gökkuşağı yansıma
- **Simli Sticker** (`glitter`) — parıltılı doku
- **Kartlı Sticker** (`kartli`) — dış tam + iç yarım kesim kart
- **Sticker Sayfası** (`sheet`) — **sayfa-boyutu modu** (A4 vb. hazır boyut)
- **Yuvarlak / Kare / Dikdörtgen Etiket Sayfası** (`*-sayfa`, kilit=tabaka) — tabaka dizilim
- **Hologram / Simli Sticker Sayfası** (`hologram-sayfa/simli-sayfa`) — tabaka dizilim

### Etiket kartları (`/etiket`) [m, YAKINDA]
- Rulo (6): **Özel Kesim · Şeffaf · Yuvarlak · Kare · Dikdörtgen · Oval Rulo Etiket**
- Tabaka (5): **Yuvarlak · Özel Kesim · Oval · Dikdörtgen · Kare Tabaka Etiket** (33×45, düşük adet)

---

## 2) KESİM TÜRLERİ (cut) [m]
- **Özel kesim / die-cut** (`diecut`) — tam kesim, her sticker tek tek
- **Yarı kesim / kiss-cut** (`kisscut`) — üst katman kesilir, arka kağıt sağlam
- **Kartlı** (`kartli`) — sticker kendi kartında (dış tam + iç yarım); kart = sticker + 10mm
- **Tabaka / Sayfa** (`tabaka`) — çok sticker tek sayfada, yarım kesimli

## 3) ŞEKİLLER + KÖŞE [m]
- **Kare** (`square`) · **Yuvarlak** (`circle`) · **Dikdörtgen** (`rectangle`) · **Oval** (`oval`)
- **Bumper** (`bumper`) — uzun yatay · **Özel form / Özel kesim** (`ozel`/`die`/`diecut`)
- Köşe: **Düz köşe** (`sharp`) · **Yumuşatılmış köşe** (`rounded`/`softCorners`)

## 4) MALZEMELER

### Sticker [m] (müşteri-görür ad / iç id / çarpan)
> Müşteri her yerde **"…Folyo"** görür (Sefa kuralı: "vinil" değil "folyo"). İç id'ler değişmez. SEO/arama metninde "vinil" terimi KORUNUR (arama trafiği).
- **Opak Folyo** (`vinil`) ×1.0 — standart parlak opak (SEO: "vinil")
- **Şeffaf Folyo** (`transparan`) ×1.1 — saydam zemin
- **Hologram Folyo** (`holo`) ×1.4 — gökkuşağı
- **Simli Hologram Folyo** (`simli`) ×1.3 — parıltılı

### Etiket [m, YAKINDA]
- **Kuşe** (`kuse`) — pürüzsüz standart kâğıt (varsayılan)
- **Kraft** (`kraft`) — doğal dokulu ekolojik kâğıt
- **Opak PP** (`beyaz`) — yırtılmaz, suya dayanıklı plastik
- **Şeffaf** (`seffaf`) · **Ultra Clear** (`ultra`) — saydam/görünmez film
- **Metalize** (`metalik`) — parlak metalik yüzey

## 5) KAPLAMA / LAMİNASYON / ÖZELLEŞTİRME [m]
- **Sticker laminasyon:** Yok (`yok`) ×0.95 · Parlak (`parlak`) ×1.0 · Mat (`mat`) ×1.05
- **Etiket kaplama:** Kaplamasız (`yok`) · Mat Selefon (`mat`) · Parlak Selefon (`parlak`) · Soft Touch (`soft`)
- **Etiket özelleştirme:** Yok · Kabartma/Emboss (`emboss`) · Sıcak Yaldız/Hot Foil (`yaldiz`) · Spot UV (`spotuv`)
- **Yaldız renkleri:** Altın · Gül Kurusu · Gümüş · Bakır · Siyah Krom · Yeşil · Lacivert · Holo

## 6) KONFİGÜRATÖR ADIMLARI + BUTONLAR [m]
- Adımlar: **Etiket türü · Malzeme · Kaplama · Yüzey · Özelleştirme · Şekil · Kesim Tipi · Boyut · Sayfa boyutu · Adet · Sayfa adedi · Tasarım · Sarım yönü/detayı**
- Rulo: **Sarım yönü** (Dışa/İçe), **Göbek çapı** (`coreSize` 25/40/76mm), **Rulo başına adet** (`rollLabelCount`)
- Butonlar: **Sepete ekle · Konfigüre et · Etiket/Sticker bastır · Ödemeye geç · Sepete git**
- Durum: Canlı önizleme · Hızlı (preset) · Önerilen · Popüler · Seçildi · Tamam · tasarruf (adet/sayfa indirimi)

## 7) "SAYFA" — iki ayrı iş [m]
- **Sayfa-boyutu modu** (`pageMode`, `?sayfa=1`) — SADECE "Sticker Sayfası"; hazır sayfa boyutu (A7…13×18…Kare20), fiyat sayfa alanından.
- **Tabaka dizilim** — diğer 5 "…Sayfası" kartı; şekil+boyut seç, sistem en az fireyle dizer, adete göre değişir.

---

## 8) SİPARİŞ DURUMLARI (`order_status` → müşteri / admin) 
16 enum → müşteri 4 faz: **1 İnceleme · 2 Onay · 3 Üretim · 4 Teslim**
- `paid` — [m] Ödeme alındı
- `awaiting_upload` — [m] Tasarım bekleniyor
- `qc_pending`/`qc_flagged`/`operator_review`/`human_review`/`human_review_failed` — [m] İnceleniyor / [iç] AI/operatör kontrol
- `proof_generating` — [m] Baskı provası hazırlanıyor / [iç] Bıçak hazırlanıyor
- `proof_validating` — [m] Düzenlemenizi kontrol ediyoruz
- `proof_pending` — [m] Onayını bekliyoruz (36 saat)
- `proof_approved`/`ready_to_ship`/`fason_assigned`/`in_production` — [m] **Üretimde**
- `shipped` — [m] Kargoda · `delivered` — [m] Teslim edildi · `cancelled` — [m] İptal

## 9) ÖDEME / PROVA / İADE / PARTNER DURUMLARI
- **Ödeme** (`payments.status`): success/pending/refunded/failed · `wallet_amount` [iç] her zaman 0 (cüzdan YASAK)
- **Prova akışı:** üret → onay (36s) → düzenleme kontrol → onaylandı; **Bıçak/cutline** [iç] = prova teknik adı
- **İade** (`return_status`): pending/approved/rejected/refunded · **Sebep** (`return_reason`): yanlış ürün · üretim hatası · kargo hasarı · kalite problemi · diğer
- **Partner/fason** (`assignment_status` — müşteri/admin/fason 3 dil): assigned · sent · acknowledged · in_production · ready · shipped · issue · cancelled
  - Müşteri etiketleri: Üretim hazırlanıyor → Basılıyor → Kargoya hazırlanıyor → Kargoda
  - Fason butonları: Aldım başlıyorum · Üretime aldım · Hazır kargoya · Kargoya verdim · Bir terslik var
  - Sorun (`IssueCategory`): dosya · malzeme · süre · diğer
  - **KURAL:** müşteri "fason" görmez → "anlaşmalı üretim ortağı" [iç→m çeviri]

## 10) ROLLER / YETKİLER [iç]
- `user_role`: customer · staff · admin · partner
- `admin_role_v2`: super_admin · operations · customer_service · production · content_editor · finance
- Eylemler: view (Görüntüle) · create (Oluştur) · update (Güncelle) · delete (Sil) · approve (Onayla)

## 11) ADMIN PANEL BÖLÜMLERİ (`AdminModule`) [iç]
Dashboard · Siparişler · Manuel sipariş · AI QC · Prova · Kargo · **Üretim Partnerleri (Fason)** · Müşteriler · Yorumlar · İadeler · Tasarımlar · Yardım Talepleri · İçerik/Ürünler · Aboneler · Galeri · Site Görselleri · Blog · Finans · Kuponlar · Fiyat yönetimi · Raporlar · Çalışanlar · Denetçiler · Denetim kaydı · KVKK talepleri · Yedekler · Arşiv · Ayarlar · Mail sağlığı · Trafik

---

## 12) FİYAT MOTORU KAVRAMLARI [iç]
- **scope** — fiyat profili: sticker / etiket_rulo / etiket_tabaka / global
- **pricing_mode** — area (alan×qty) / sheet (tabaka×adet) / pricebook (partner WxH matris)
- **calculatePrice** — TEK yetkili fiyat fonksiyonu (paralel formül yasak)
- **billable_m2** — faturalanabilir m² (geometriden fireli)
- **tier / kademe** — adet eşiğine göre çarpan; **referans tier** = çarpan 1.00 (sticker 250, etiket rulo 5000, tabaka 1000)
- **tier.multiplier** — kademe çarpanı (>1 zam, <1 indirim)
- **options / pct_add / pct_cost** — seçenek grupları, satış% / maliyet%
- **TOPLAMSAL çarpan** — `×(1 + Σlaminasyon% + (kesim çarpanı−1))` (çarpılmaz, toplanır)
- **operation** — setup + packaging_per_unit×qty + cargo
- **final / satış** [m] — KDV dahil müşteri fiyatı · **unit_price** — final/qty
- **cost_total / maliyet** — partner alacağı (sticker'da tier+kesim YOK, laminasyon VAR)
- **dual-price** — çift çıktı: final (satış) + cost_total (maliyet); sticker + tabaka
- **config / live_config** — tek otorite fiyat şeması (hardcode fiyat yasak) · **FALLBACK config** — config null iken yedek
- **reprice** — checkout server-side yeniden fiyatlama (`/api/cart/reprice`)
- **pricebook** — rulo etiket partner fiyat matrisi

## 13) GEOMETRİ KAVRAMLARI [iç]
- **computeGeometry / totalM2** — tek geometri kaynağı, fire dahil faturalanabilir m²
- **fire / wastePct** — boş/atık alan oranı (müşteri görmez)
- **gap / boşluk** — kesim aralığı: GAP_DIECUT 20mm · GAP_TABAKA 3mm · ETIKET_GAP 6mm
- **DIECUT_EN = 1500** — die-cut rulo EN SABİT; fatura = 1500 × Σ(yükseklik); enUsable 1390 (30 başı + 80 sonu pay)
- **segment / segmentHeights** — die-cut yükseklik dilimleri (250-600 esnek); **distributeDiecutSegments** (tam-önce, son eksik)
- **rollPlan / computeRollPlan** — tabakaların plotter rulosuna dizilimi · **column-major** dizgi
- **ROLL_W_MAX/MIN** 600/250 · **ROLL_L = 1520** (tabaka rulo) · **ETIKET_ROLL_L = 50000** (gerçek etiket rulosu)
- **TABAKA_OUTER** 230×310 · **TABAKA_USABLE** 210×290 · **edge margin** 10mm
- **perSheet/perRoll/perTabaka** — birim başına adet
- **overrun / hediye sticker** — üretilen − istenen (overage ≤ %10); müşteriye "hediye"
- **snapSizeUp** — ölçüyü 5mm katına yukarı yuvarla (38×48 → 40×50)
- **forcedDieCut / bigEtiketRedirect** — sığmama/çok büyük yönlendirme bayrakları

## 14) SAYFA-MODU + SHEET KAVRAMLARI [iç]
- **pageMode** — qty = sayfa adedi, billable = computeRollPlan m²
- **sheet mode** (`pricing_mode=sheet`) — tabaka etiket: sheet_cost × sheets_needed
- **calcTabakaSheets** — tabaka etiket (33×45 sabit) sayfa geometrisi

## 15) VERGİ / FİNANS [iç+m]
- **KDV / vat** = %20 [m: "KDV dahil"]
- **fee_pct / PSP / PayTR komisyonu** = %2.5; **gross-up** `/(1−fee%)` ile müşteriye yansıtılır
- **setup · packaging_per_unit · cargo** — operasyon kalemleri

## 16) GİZLİ ÇARPANLAR [iç]
- **kesim çarpanı** (CUT_MULT): diecut 1.10 · kisscut 1.00 · tabaka 1.00
- **malzeme çarpanı** (MATERIAL_MULT): vinil 1.0 · transparan 1.1 · simli 1.3 · holo 1.4
- **laminasyon çarpanı** (FINISH_MULT): parlak 1.0 · mat 1.05 · yok 0.95
- **etiket özelleştirme** ÇARPILIR (her biri ek kalıp/baskı pass'i)
- **GROUP_DISCOUNT** — aynı boyut çoklu tasarım indirimi (2→%3 … 10→%10)
- **LOT_PREFIX** — A=sticker, B=etiket

## 17) DİĞER ENUM'LAR [iç]
- **Tasarım dosya** (`design_file_status`): uploaded · analyzing · qc_passed · qc_warned · qc_failed · approved · superseded
- **Arşiv** (`archive_status`): hot · archiving · cold · restoring · deleted
- **Yorum** (`review_status`): pending · published · rejected · hidden
- **KVKK talep** (`kvkk_request_kind`): data_export · account_delete · partial_delete · correction · objection · restriction
- **Kupon** (`coupon_kind`): percent · fixed · free_ship (VIP/referans/reprint/yorum bonusu — cüzdan/puan DEĞİL)
- **Depolama** (`storage_provider`): supabase · r2

---

## 18) SÜREÇ / ÜRETİM TERİMLERİ — müşteriye nasıl denir
| İç terim | Müşteriye |
|---|---|
| fason / fason ortağı | "anlaşmalı üretim ortağı / baskı atölyesi" |
| `fason_assigned` / in_production | "Üretimde" |
| bıçak / cutline | "baskı provası / prova" |
| liner | "arka kağıt" |
| fire / dizilim / billable / tier / scope | (gösterilmez) |
| prova | "prova / onay" [m] |

## 19) YASAK İFADELER (sefaRules)
"Süresiz" (TKHK m.61) · "Bursa" (lokasyon) · dalkavuk/yapay empati · persona dropdown (tek Pim) · bot menüsü/hazır chip · cüzdan/puan/üyelik indirimi.
