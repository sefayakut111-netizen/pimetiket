# Spec — Cutline 2b: PDF/AI spot-color CutContour PATH çıkarımı

> Durum: **kod için BLOKLU** — gerçek bir CutContour-spot PDF/AI örnek dosyası gelmeden yazılmaz.
> Yanlış geometri = yanlış fiziksel kesim = ıskarta malzeme. Önce örnekle doğrula, sonra ship.
> Hazırlayan: Cowork (Claude), 4 Haz 2026.

## Bağlam (mevcut durum)
- `src/lib/proof/cutline-detect.ts` — 5 tespit metodu: `magenta_spot_color`, `named_layer`, `pdf_annotation`, `psd_layer`, `alpha_channel`. `cutline_source` mig 115 ile izleniyor.
- **2a (DONE, 103c4f1):** SVG'de magenta stroke tespiti genişletildi (`#FF0080/#f0f/rgb%/style stroke` + `parseColorToRgb`/`isMagentaStroke`). Bu yalnız **SVG** içindi.
- **2b (BU SPEC):** Müşteri **print-ready PDF veya AI** yüklediğinde, içindeki **spot color "CutContour"** (Esko/sektör standardı) ya da magenta spot ile çizilmiş **vektör kesim yolunu** çıkar → otomatik contour üretmek yerine **kullanıcının kendi bıçağını** cutline olarak kullan. (Sefa: "kullanıcı kendi bıçağını spot renkler ile iletirse sistem bunu tanımalı — ÇOK ÖNEMLİ.")

## Yaklaşım
1. **Dosya tipi:** AI = PDF-uyumlu (PGF private data + PDF içerik akışı). AI'yı PDF gibi parse et.
2. **Separation tespiti:** PDF içindeki `/Separation` color space sözlüğünde spot adı ara — öncelik sırası:
   `CutContour` → `Cut` → `Thru-cut` → `Kiss-cut` → `Stans` → `Die` → ham magenta (`#FF00FF`/`#ED1C24`/`#EC008C`). Ad eşleşmesi case-insensitive + boşluk-toleranslı.
3. **Path çıkarımı:** PDF content stream operator listesinden (`pdf.js` `page.getOperatorList()`), o separation ile **stroke/fill** edilen path op'larını topla (`moveTo/lineTo/curveTo/closePath` → `m/l/c/h`).
4. **Koordinat dönüşümü (EN RİSKLİ ADIM):** PDF user space (pt) → cutline mm. Hesaba kat:
   - MediaBox/CropBox offset + boyut.
   - PDF Y-ekseni alttan yukarı (flip gerek).
   - Artwork yerleşim transform matrisi (cm operatörleri / form XObject `Matrix`).
   - 1 pt = 1/72 inch = 0.3528 mm.
5. **Çıktı:** `buildEmbeddedCutlineSvg` formatında embedded SVG path (`#FF0080` stroke) + `cutline_source = 'pdf_spot_path'`.

## Kütüphane seçimi
- **Öncelikli aday: `pdf.js` (Mozilla)** — `getOperatorList()` + color space erişimi var, serverless-uyumlu (saf JS). Separation color space op'larını ve path geometrisini verir.
- Alternatif: MuPDF/Ghostscript (ağır, serverless'ta zor) — yalnız pdf.js yetmezse.
- Repo'da pdf.js zaten kullanılıyor mu? → entegrasyondan önce kontrol et (`package.json` + mevcut PDF işleme).

## Entegrasyon noktası
- `cutline-detect.ts`'e yeni metot: `detectPdfSpotPath(buffer): { svgPath, sourceUnit, bbox } | null`.
- Upload/proof pipeline: PDF/AI yüklemesinde önce bu metot denenir; spot path bulunursa otomatik-contour'u **atlar**, kullanıcının yolunu kullanır. Bulunamazsa mevcut akışa (otomatik contour) düşer.
- `shape-to-poc-mode` ile etkileşim: spot path bulunduğunda mode = kullanıcı yolu (contour değil); POC engine'e gömülü path olarak ver.

## Riskler / dikkat
- **Koordinat dönüşümü** en kritik hata kaynağı — yanlış offset/flip → kesim kayar. Sample ile mm-doğrulaması ŞART.
- Spot ad varyasyonu (yukarıdaki liste genişleyebilir) — tanınmazsa **bloklama, otomatik contour'a düş + operatör uyarısı** (2a'daki `operator_warnings` paterni).
- Overprint/separation pdf.js'te nasıl görünüyor — operator list'te test gerek.
- AI dosyasında PDF-uyumlu içerik akışı yoksa (eski AI/sadece PGF) → path bulunamaz, fallback.
- Çok parçalı kesim (birden çok kapalı yol) → hepsini topla, tek cutline SVG'de birleştir.

## Doğrulama planı (sample gelince)
1. Sefa gerçek bir CutContour-spot **PDF + AI** örneği versin (tercihen ölçüsü bilinen basit bir die-cut).
2. `detectPdfSpotPath` çıkışını POC önizlemede göster → fiziksel ölçüyle (mm) karşılaştır.
3. Köşe/eğri sadakati + ölçek + offset doğru mu kontrol → ancak sonra ship.
4. Kartlı runner 556.85 (regresyon yok), `tsc` 0, mevcut SVG/auto-contour akışı bozulmadı.

> ÖZET: Mimari + kütüphane + entegrasyon noktası hazır. Tek eksik **gerçek örnek dosya** — gelince `detectPdfSpotPath`'i yazıp sample ile doğrularız.
