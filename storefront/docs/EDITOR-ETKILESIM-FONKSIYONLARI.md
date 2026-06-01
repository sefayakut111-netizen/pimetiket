# Editör Etkileşim Fonksiyonları — Analiz (1 Haz)

Sefa tespiti: "sığdır/ortala yok, bıçak seçilemiyor." Claude POC motorunu + EditorShell köprüsünü inceledi.

## KÖK BULGU: POC'ta her şey VAR, dış panel ÇAĞIRMIYOR

POC (`public/poc.html`) bir **komut motoru** — `html.pim-editor-shell` CSS'i ile kendi panellerini gizler
(placement/material/action), dış React panelin postMessage komut göndermesini bekler. Ama `EditorShell.tsx`
sadece **1 postMessage** çağırıyor (satır 119) → POC'un zengin komut seti BOŞTA.

### POC'un HAZIR komutları (message handler, satır 2028+) — kanıtlı
| Komut | İşlev | Dış panelde buton? |
|---|---|---|
| `pim-fit-contain` | **Sığdır** (görseli çerçeveye oturt) | ❌ YOK |
| `pim-set-view-zoom` | Zoom (0.25–3×) | kısmen (zoom var) |
| `pim-editor-set-size` | Baskı boyutu (mm) | ❌ YOK (UIUX prompt'ta) |
| `pim-editor-set-shape` | **Bıçak şekli seç** (circle/rect/contour/ellipse) | ⚠️ belirsiz |
| `pim-set-offset` | Kesim payı (0–5mm) | slider var, bağlı mı? |
| `pim-toggle-layer` | Katman (cut/white/bleed/safe) | toggle var, bağlı mı? |
| `pim-set-white-mode` | Beyaz plan (off/full/smart/ai) | ❌ |

### POC'un placement preset'leri (applyPlacementPreset) — kanıtlı
`center` (Ortala), `cover` (Doldur/Kapla), `contain` (Sığdır) → **3'ü de motor düzeyinde VAR.**
AMA postMessage komutu sadece `pim-fit-contain` (=contain). **center/cover komutları EKSİK** (eklenmeli).

## İHTİYAÇ LİSTESİ — ne yapılmalı

### A) POC tarafı (küçük — 2 komut ekle)
`poc.html` message handler'a 2 komut ekle (mevcut `pim-fit-contain` pattern'i):
- `pim-fit-center` → `applyPlacementPreset('center')`
- `pim-fit-cover` → `applyPlacementPreset('cover')`
(contain zaten var.) ~10 satır.

### B) Dış panel tarafı (asıl iş — butonları bağla)
EditorShell'e POC'un mevcut komutlarını çağıran kontroller ekle:

1. **Yerleştirme butonları:** "Ortala / Sığdır / Doldur" → `pim-fit-center` / `pim-fit-contain` / `pim-fit-cover`.
   (Toolbar'da grup; ikon+label.)
2. **Bıçak seçimi (şekil):** Kontur/Dikdörtgen/Yuvarlak/Çevresel butonları → `pim-editor-set-shape {shape}`.
   Şu an dış panelde "Kesim modu" kartları VAR ama POC'a `pim-editor-set-shape` gönderiyor mu DOĞRULA —
   göndermiyorsa "bıçak seçilemiyor" şikayetinin kaynağı bu.
3. **Kesim payı slider** → `pim-set-offset {offsetMm}` (bağlı mı doğrula).
4. **Katman toggle** → `pim-toggle-layer {layer, on}` (bağlı mı doğrula).
5. **Boyut input** → `pim-editor-set-size` (UIUX prompt Görev 2 ile örtüşür — orada da var).

### C) Hazır şablon bıçağı (die-cut) seçimi — AYRI eksik
Memory'de "65 die-cut şablon" var ([[project-kesim-sablon-kutuphanesi]]). Kullanıcı hazır bıçak şablonu
(yuvarlak Ø50, kare vb.) seçebilmeli. POC `?sablon=` paramı + `pim-editor-set-shape` ile şablon ön-dolumu
destekliyor (EditorShell `?sablon=` okuyor). Ama dış panelde **şablon seçici UI** var mı? Yoksa eklenmeli:
"Hazır bıçak" sekmesi → 65 şablon grid → seçince `pim-editor-set-shape {shape, widthMm, heightMm}`.

## D) BASKI-ÖNCESİ KALİTE & KONTROL — ek eksikler (Claude doğruladı)

### D1. DPI / çözünürlük uyarısı 🔴 (kritik — baskı-öncesi aracın en önemli eksiği)
POC'ta `dpi` mantığı VAR ama `standalone-restricted` gizliyor; dış panelde de yok. Kullanıcı 72dpi web
görseli + büyük mm seçerse → baskıda pikselleşir, HİÇ uyarı yok. Etkin DPI = pixelWidth / (widthMm/25.4).
- ≥150 sorun yok · 100–150 sarı uyarı · <100 kırmızı.
- POC'un dpi hesabını standalone'da AÇ veya dış panelde Analiz'e göster. Boyut değişince güncelle.
**Etki:** Müşteri bozuk baskı alıp şikayet etmesin — en yüksek iş değeri.

### D2. El ile boyutlandırma (resize handle) — EKSİK
POC'ta görsel **sürükleme VAR** (`canvas.pointerdown` satır 4387, `imageTransform` + `pimUserMovedImage`)
ama **el ile boyutlandırma (köşe handle / scale) YOK** (kanıt: resizeHandle/scaleHandle 0 sonuç).
Kullanıcı görseli taşıyabilir ama köşeden büyütüp küçültemez. Eklenmeli: ya canvas köşe handle'ları
(Konva Transformer benzeri) ya da dış panelde "görsel ölçek %" slider'ı → POC'a postMessage.
**Not:** Sürükleme ZATEN çalışıyor — sadece resize eksik.

### D3. Kesim rengi açıklaması görünür olsun 🟢 (küçük)
`CutColorNote.tsx` VAR ("Kesim çizgisi renkleri ne demek") ama collapse içinde gizli. Tasarımcı olmayan
kullanıcı magenta(bıçak)/mavi(white) çizgileri anlamıyor. Önizleme yanında görünür ipucu/legend yap.

### D4. (varsa-iyi, düşük öncelik) Taslak resume + Geri al
- `editor_cutline_drafts` + `/api/editor/save` VAR — kullanıcı çıkıp dönünce devam UI'ı eksik olabilir (Panelim'den).
- POC'ta "Geri al" butonu VAR (satır 1737) — standalone'da görünür mü doğrula; yanlış offset/şekil sonrası undo.

## ❌ EKLENMEYECEK (vizyon dışı — tasarım aracı tuzağı)
Metin/eleman/logo ekleme · filtre/efekt · çoklu görsel kolaj · serbest çizim · multi-design (konfigüratörde var).
Sefa kuralı: editör TASARIM ARACI DEĞİL — baskı-öncesi hazırlık. Scope patlatma.

## E) ZOOM-FIT BUG (Claude canlı test 1 Haz, commit 777830c) 🔴
UIUX sonrası: görsel yükleyince ve boyut DEĞİŞİNCE önizleme zoom'u görseli ekrana SIĞDIRMIYOR —
80mm'de %250 zoom'a çıkıp görsel canvas'ı taşırıyor (devasa). `pim-fit-contain` boyut değişiminde
yeniden tetiklenmiyor.
**Fix:** `pim-editor-set-size` sonrası (ve ilk yükleme sonrası) `applyPlacementPreset('contain')` + viewZoom'u
çerçeveye göre yeniden hesapla. Görsel her zaman önizleme alanına sığsın. Bu, D2 (fit/resize) ile birlikte yapılır.

## EDİTÖR İŞ SIRASI (Sefa kararı 1 Haz — "önce elle kontrol bitsin, AI en son")
1. ✅ **UIUX** (boyut/layout/durum/CTA) — commit 777830c CANLI, Claude test etti (5/5 çalışıyor).
2. ⏳ **Etkileşim + Kalite (TEK TUR):** ortala/sığdır/doldur + bıçak/şekil seçimi bağla + D1 DPI uyarısı
   + D2 el-ile-resize + D3 kesim-rengi görünür + **E zoom-fit bug**. Hepsi EditorShell+poc.html.
3. ⏳ **Hazır şablon seçici** (die-cut 65) — ayrı tur, orta iş.
4. ⏳ **D4** (taslak resume + undo) — düşük öncelik.
5. ⏳ **Pim komut alanı** (sesli kumanda — `PIM-EDITOR-KOMUT-SPEC.md`) — **EN SON KATMAN.** Elle kontrol
   tam çalışınca eklenir (çalışmayan butonu doğal dille tetiklemek anlamsız). Pim = mevcut aksiyonları
   tetikler, tasarım YAPMAZ. Sağ-alt tek-satır komut çubuğu (chat değil, bot menüsü yok — Sefa kuralı).

## Pim AI editörde — ŞU AN DURUMU (Claude doğruladı)
Editörde Pim/AI **HİÇ YOK** (PimChat/pim-chat/komut grep=0). Kasıtlı boşluk. Müşteri-Pim chat editörde
KAPALI (memory: sticky CTA çakışması). Pim komut alanı (#5) gelecek katman. Sıra: elle kontrol → AI.

## NOT — neden ajan fan-out yapmadık
Bu bir "keşif" değil, tek-kaynak (POC motoru) inceleme işiydi. POC'un komut seti net; eksik olan dış panelin
onları çağırması. Fan-out israf olurdu — doğrudan kod okuması yeterli ve kesin sonuç verdi.
