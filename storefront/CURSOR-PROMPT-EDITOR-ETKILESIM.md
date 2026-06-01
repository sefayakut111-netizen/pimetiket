# Editör Etkileşim + Kalite Turu

Analiz: `docs/EDITOR-ETKILESIM-FONKSIYONLARI.md`. UIUX turu (commit 777830c) bitti — boyut/layout/durum/CTA
çalışıyor. Bu tur: yerleştirme kontrolleri + bıçak seçimi doğrulama + DPI/resize/kesim-rengi + zoom-fit bug.

## MEVCUT DURUM (Claude canlı + grep teyit)
EditorShell ZATEN gönderiyor: `pim-editor-set-size`, `pim-editor-set-shape` (kesim modu butonları),
`pim-fit-contain`, `pim-request-design-file`, `pim-request-export`.
POC message handler (`poc.html:2028+`) destekliyor: yukarıdakiler + `pim-set-offset`, `pim-toggle-layer`,
`pim-set-view-zoom`, `pim-set-white-mode`, `pim-load-design`.
POC `applyPlacementPreset` 3 preset destekler: **center, cover, contain** — ama postMessage komutu sadece
`pim-fit-contain` var (center/cover EKSİK).

> POC iframe'i (kontur motoru) BOZMA. Dış React kabuğu (EditorShell ~587 satır) + poc.html message handler düzenle.
> Migration YOK. POC'un mevcut komut tiplerini grep'le doğrula, uydurma.

---

## GÖREV 1 — Zoom-fit bug 🔴 (Claude canlı test: 80mm'de %250 zoom, görsel taşıyor)
Görsel yükleyince + boyut değişince önizleme görseli ekrana SIĞDIRMIYOR (devasa, taşıyor).
#### `poc.html`
`pim-editor-set-size` handler'ında (satır ~2091) zaten `applyPlacementPreset('contain')` çağrısı VAR ama
koşullu (`!pimUserMovedImage && currentMode==='contour'`). Sorun: boyut değişince viewZoom çerçeveye göre
yeniden hesaplanmıyor → görsel sığmıyor.
**Fix:** `pim-editor-set-size` ve ilk yükleme sonrası, `applyPlacementPreset('contain')` + viewZoom'u
önizleme alanına oturacak şekilde yeniden hesapla (fit-to-frame). Görsel HER ZAMAN canvas'a sığsın.
**Doğrulama:** 50→80mm → görsel önizlemeye sığar (taşmaz), zoom otomatik ayarlanır.

## GÖREV 2 — Yerleştirme butonları: Ortala / Sığdır / Doldur
#### `poc.html` (2 komut ekle) + `EditorShell.tsx` (3 buton)
POC'a `pim-fit-contain` pattern'iyle 2 komut ekle (handler satır ~2112):
```js
} else if (msg.type === 'pim-fit-center') {
  if (PIM_PARAMS.standalone && currentMat) { pimUserMovedImage = false; applyPlacementPreset('center'); }
} else if (msg.type === 'pim-fit-cover') {
  if (PIM_PARAMS.standalone && currentMat) { pimUserMovedImage = false; applyPlacementPreset('cover'); }
}
```
EditorShell: önizleme toolbar'ına 3 buton grubu — **Ortala** (`pim-fit-center`) · **Sığdır** (`pim-fit-contain`) · **Doldur** (`pim-fit-cover`). İkon+label, görsel yokken disabled.
**Doğrulama:** 3 buton görseli ortala/sığdır/doldur şeklinde yeniden konumlar.

## GÖREV 3 — Bıçak/şekil seçimi DOĞRULA + düzelt
Kesim modu butonları (Kontur/Çevresel/Dikdörtgen/Yuvarlak) `pim-editor-set-shape` gönderiyor (satır 142).
**Doğrula:** Her butona tıklanınca POC'ta kontur GERÇEKTEN değişiyor mu (Kontur=silüet, Çevresel=hull,
Dikdörtgen=rect, Yuvarlak=circle). Çalışmıyorsa `pim-editor-set-shape` payload'unu POC handler'ıyla (satır 2138)
eşleştir — `{mode, shape, widthMm, heightMm}`. Aktif buton görsel olarak vurgulansın (hangi mod seçili belli olsun).
**Doğrulama:** 4 kesim modu tıklanınca kontur şekli değişir; aktif mod vurgulu.

## GÖREV 4 — El ile boyutlandırma (resize) — EKSİK
POC'ta görsel SÜRÜKLEME var (`canvas.pointerdown` satır 4387) ama köşeden BOYUTLANDIRMA yok.
**Fix (basit yol):** EditorShell sol panele "Görsel ölçek" slider'ı (%25–%200) → POC'a yeni komut
`pim-set-image-scale {scale}`. POC handler'da `imageTransform.scale` (veya eşdeğeri) güncelle + render.
> POC'ta görsel transform/scale değişkenini grep'le bul (`imageTransform`, `imageScale`); mevcut sürükleme
> aynı transform'u kullanıyor. Slider o değeri set etsin. Canvas köşe-handle'ı DAHA BÜYÜK iş — slider yeterli.
**Doğrulama:** Ölçek slider'ı görseli büyütüp küçültür (bıçak çerçevesi içinde konumlanır).

## GÖREV 5 — DPI / çözünürlük uyarısı 🔴 (baskı kalitesi)
Kullanıcı düşük çözünürlük + büyük boyut seçince baskıda pikselleşir — uyarı YOK.
#### `EditorShell.tsx` (Özet paneli) veya POC
Etkin DPI = `pixelWidth / (widthMm / 25.4)`. Görsel piksel boyutu POC'tan `pim-poc-loaded` ile geliyor
(dosya boyutu), baskı mm dış panelde. Hesapla + Özet'te göster:
- ≥150 DPI → yeşil "Baskı kalitesi iyi" · 100–150 → sarı "Kalite düşebilir" · <100 → kırmızı "Çözünürlük düşük, pikselli çıkabilir".
Boyut/görsel değişince güncelle. (Engelleme değil, uyarı.)
**Doğrulama:** Küçük görsel (300px) + 100mm → kırmızı/sarı DPI uyarısı; büyük görsel → yeşil.

## GÖREV 6 — Kesim rengi açıklaması görünür [küçük]
`CutColorNote.tsx` var ("Kesim çizgisi renkleri ne demek") ama collapse içinde gizli. Önizleme yanında
görünür legend yap: magenta = Bıçak (kesim hattı) · mavi = Beyaz plan · vb. Tasarımcı olmayan anlasın.
**Doğrulama:** Kullanıcı kontur renklerinin ne olduğunu görüp anlar.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)
1. `rm -rf .next/dev/types` + `npx tsc --noEmit` → 0 hata (kalırsa push etme).
2. `git add -A`
3. `git commit -m "feat(editor-etkilesim): ortala/sigdir/doldur + bicak secimi + olcek slider + DPI uyarisi + kesim rengi legend + zoom-fit bug"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. POC iframe kontur motorunu BOZMA. Claude canlıda test edecek:
> görsel yükle → sığdır → 4 kesim modu → ölçek slider → boyut değiştir (zoom taşmaz) → DPI uyarısı.
> SONRAKİ TUR (bu değil): hazır şablon seçici (die-cut 65), en son Pim komut alanı.
