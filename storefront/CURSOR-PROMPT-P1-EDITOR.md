# P1 Fix — Tema 1: Editör & Cutline (4 görev)

Denetim (1 Haz) doğrulanmış P1'leri. Hepsi `cutline-imaging` domaini. file:line kanıtlı.
**DİKKAT:** OpenCV Mat yönetimi + PDF koordinat matematiği — doğrulama adımlarını atlama.

---

## GÖREV 1/4 — buildMask: alpha Mat leak [bug, conf 0.99]

#### Dosya: `src/lib/editor/cutline/contour-opencv-algorithms.ts` (~satır 44-55)

`const alpha = ch.get(3)` (satır 44) yeni Mat referansı döndürür (ayrı WASM belleği). Kullanım
sonrası `alpha.delete()` HİÇ çağrılmıyor; `ch.delete()` (satır 55) iç Mat'i temizlemiyor. Her
contour/hull işleminde bir Mat sızıyor → uzun oturumda Worker OOM çöker.

**Fix:** `ch.delete()` öncesi `alpha.delete()` ekle. Her iki dalda da (meanAlpha<250 ve else) garanti için `try/finally` kullan.

**Doğrulama:** `/editor`'da 15+ kez "Otomatik bıçak oluştur" → DevTools Memory sabit kalmalı.

---

## GÖREV 2/4 — computePathsFromBitmap: hata yolunda Mat leak [bug, conf 0.96]

#### Dosya: `src/lib/editor/cutline/contour-opencv-algorithms.ts` (~satır 205-230)

`src` ve `mask` normal akışta (227-228) delete ediliyor ama `generateOffsetPaths` (.map içinde, 218-225)
`cv.dilate/erode/findContours` exception fırlatırsa delete HİÇ çağrılmıyor. Worker catch'i (worker.ts 96-119)
sadece error mesajı gönderiyor, Mat temizlemiyor.

**Fix:** `computePathsFromBitmap`'e `try/finally`: `finally { try { mask.delete(); } catch {} try { src.delete(); } catch {} }`.

**Doğrulama:** Bozuk/çok küçük görselde "Otomatik bıçak" → hata toast'ı çıkar ama bellek sızmaz (tekrar dene çalışır).

---

## GÖREV 3/4 — Crop mark yönü yanlış [bug, conf 0.92]

#### Dosya: `src/lib/proof/print-ready.ts` → `drawCropMarks` (~satır 47-81)

Her köşe için SABİT yön çiziliyor (yatay hep sola, dikey hep yukarı). pdf-lib'de y=0 ALT kenar.
Sağ-üst, alt-sol, alt-sağ köşelerde 3/8 crop mark **bleed içine** işaret ediyor → matbaa kırpma referansı bozuk.

**Fix:** Yönü dinamik hesapla:
```ts
const isRight = cx > w / 2;
const isTop = cy > h / 2;
// yatay: isRight ? cx → cx+markLen : cx-markLen → cx
// dikey: isTop  ? cy → cy+markLen : cy-markLen → cy
```

**Doğrulama:** Print-ready PDF üret → 4 köşedeki crop mark çizgileri hepsi DIŞARI işaret etmeli (bleed dışı).

---

## GÖREV 4/4 — CutContour gerçek spot renk değil [bug, conf 0.91] — MİNİMAL FIX

#### Dosya: `src/lib/proof/print-ready.ts` → `drawCutlineAsSpotColor` (~satır 258-311)

`CUTCONTOUR_COLOR = rgb(1,0,1)` düz RGB magenta. RIP sistemleri (Caldera/ONYX/Fiery) `CutContour`'ı
**PDF Separation (spot)** olarak bekler; RGB magenta'yı kesim kanalı saymaz → operatör elle düzeltir.
pdf-lib spot color API'si yok, tam çözüm büyük iş (ghostscript/sharp post-process).

**ŞİMDİLİK MİNİMAL (Sefa onayı gelene kadar):** Tam spot-renk dönüşümü YAPMA. Sadece print-ready PDF
meta'sına/`order_events`'e bir işaret koy: `cutcontour_is_rgb_fallback: true` + operatör manifestinde
"⚠️ Kesim kanalı RGB magenta — RIP'te CutContour spot'a manuel çevir" notu göster.

> Tam çözüm (ghostscript ile spot kanal veya ayrı SVG katmanı) ayrı iş — `cutline-imaging` danışmanına bırak. Bu görevde sadece "yanlış üretim riskini operatöre görünür kıl".

**Doğrulama:** Print-ready PDF üretiminde meta'da `cutcontour_is_rgb_fallback` görünür; operatör ekranında uyarı çıkar.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)

1. `npx tsc --noEmit` TEMİZ (kırıksa push etme).
2. `git add -A`
3. `git commit -m "fix(editor-p1): OpenCV Mat leak x2 + crop mark yönü + CutContour operatör uyarısı"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash + canlı URL (`/editor`) bildir. Migration YOK, apply gerekmez.

> Git kökü `pim-etiket/core/`. Görev 1-2 bellek (DevTools ile test), 3-4 print-ready PDF çıktısıyla test.
