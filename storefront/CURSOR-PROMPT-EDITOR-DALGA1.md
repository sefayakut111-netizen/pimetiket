# Editör Dalga 1 — Hızlı Kazanımlar (6 görev)

`cutline-imaging` + `frontend` domaini. Editör keşfinden (1 Haz) doğrulanmış, **değer/efor oranı en yüksek**
işler. Ortak özellik: **altyapı çoğu kodda HAZIR, sadece UI/bağlantı eksik.** file:line kanıtlı.

> Mimari: `docs/EDITOR-MIMARI-YOL-HARITASI.md`. Editör = baskı-öncesi araç, tasarım aracı DEĞİL.
> ÖN KOŞUL: OpenCV fix (`CURSOR-PROMPT-EDITOR-OPENCV-FIX.md`) uygulanmış olmalı — Görev 5 onu varsayar.
> Bu görevler çoğunlukla OpenCV'den bağımsız UI; paralel ilerleyebilir.

---

## GÖREV 1/6 — Bıçak türü → ürün yönlendirme CTA [high/S] 🎯 vizyon kalbi

#### Dosya: `src/components/editor/EditorShell.tsx` (~satır 592-609, `addToProduct`)

Şu an "Sticker'a ekle" + "Etiket'e ekle" butonları **eşit** duruyor; hangi bıçağın hangi ürüne gittiği
belirsiz. Vizyon: yuvarlak bıçak → yuvarlak sticker.

`bladeShape` (satır 185) ve `shapeMode` (satır 96) zaten var. Yönlendirme mantığı ekle:
- `shapeMode==='circle'` veya yuvarlak şablon (`selectedTpl.shape==='circle'`) → **Sticker'ı birincil vurgula** + küçük öneri metni: *"Yuvarlak kesim → Sticker önerilir"*
- Rulo/dikdörtgen + yüksek adet eğilimi → Etiket önerisi
- Belirsizse ikisi de eşit kalsın (zorlama yok)

Öneri metni butonların üstünde küçük, gri. Birincil buton `Button` primary, diğeri secondary.

**Doğrulama:** Yuvarlak şekil seçince Sticker vurgulu + öneri metni; dikdörtgen şablonda Etiket önerisi.

---

## GÖREV 2/6 — Köşe yarıçapı slider (dikdörtgen bıçak) [high/S]

#### Dosya: `src/components/editor/EditorShell.tsx` (shapeMode==='rect' dalı)

`BladeShapeConfig` zaten `cornerRadiusMm?` taşıyor (controller-types.ts:16) ve `PikasoEditorCanvas`
bunu `computeCutlineBundle`'a iletiyor (satır 344-345). Ama EditorShell hiç **set etmiyor** — kullanıcı
köşe yuvarlaklığını ayarlayamıyor.

- `shapeMode==='rect'` iken sağ panelde bir slider: "Köşe yuvarlaklığı: 0–20mm".
- State: `const [cornerRadiusMm, setCornerRadiusMm] = useState(0)`.
- `bladeShape` memo'sunda rect dalına `cornerRadiusMm` ekle (satır 199-200 civarı).
- Slider değişince cutline yeniden hesaplanır (mevcut recompute akışı tetiklensin).

**Doğrulama:** Dikdörtgen bıçakta slider → köşeler canlı yuvarlanır; 0=keskin, 20=çok yuvarlak.

---

## GÖREV 3/6 — Görsel döndür + çevir (flip) [high/S]

#### Dosyalar: `src/components/editor/PikasoEditorCanvas.tsx` + `EditorShell.tsx` + `controller-types.ts`

`placement.ts` zaten `rotationDeg` okuyor ama `imageAttrsForPreset` her preset'te `rotation:0` veriyor →
kullanıcı görseli döndüremiyor/çeviremiyor (yan duran logo düzeltilemiyor).

1. `PikasoEditorController`'a ekle: `rotateImage(deltaDeg: number)` + `flipImage(axis: "h"|"v")`.
2. `PikasoEditorCanvas` imperative handle'da implement et:
   - rotate: image shape `rotation(current + delta)` (90° adımlar ye터)
   - flip: `scaleX(-scaleX)` (yatay) / `scaleY(-scaleY)` (dikey), pozisyon kompanzasyonu ile
   - Sonra cutline recompute + `syncLabelWorkspace`.
3. EditorShell sağ panelde (Görsel düzenleme bölümünde) 3 buton: ↻ 90° döndür · ⇄ yatay çevir · ⇅ dikey çevir.

> OpenCV fix'inin getirdiği rotation→contour eşlemesi (placement rotationDeg) bununla tam çalışır.

**Doğrulama:** Yan logo → 90° döndür düz gelir; çevir aynalanır; kontur döndürülmüş görseli takip eder.

---

## GÖREV 4/6 — Bleed/Safe katman tooltip (jargon açıklama) [high/S]

#### Dosya: `src/components/editor/EditorPreviewToolbar.tsx` (~satır 7-12 `LAYER_LABELS`, satır 68-105 render)

"Bleed" ve "Safe" baskı jargonu, tasarımcı olmayan kullanıcı anlamıyor. `LAYER_LABELS`'a açıklama ekle:

```ts
export const LAYER_LABELS: { id: EditorLayer; label: string; hint: string }[] = [
  { id: "cut",   label: "Bıçak", hint: "Kesim çizgisi — etiketin kesileceği hat" },
  { id: "bleed", label: "Bleed", hint: "Taşma payı — baskı kayması için kenar fazlası" },
  { id: "safe",  label: "Safe",  hint: "Güvenli bölge — yazı/logo bu alanın içinde kalsın" },
  { id: "white", label: "Beyaz", hint: "Beyaz mürekkep katmanı — şeffaf/metalik zeminde" },
];
```
Her katman butonuna `title={hint}` + `aria-label`. (İstersen `InfoTooltip` primitive'i ile hover.)

**Doğrulama:** Katman butonuna hover → Türkçe açıklama görünür.

---

## GÖREV 5/6 — "Kontur hazır" bildirimi [high/S]

#### Dosya: `src/components/editor/EditorShell.tsx` (~satır 113 `contourRefining`, 827-839)

Otomatik bıçak sekmesi "Kesim hattı iyileştiriliyor…" gösteriyor ama bitince **sessizce** kayboluyor —
kullanıcı "bitti mi?" bilmiyor.

`contourRefining` `true→false` geçişinde: yeşil "Kesim hattı hazır ✓" mesajı göster, ~2sn sonra kaybolsun
(veya kalıcı küçük yeşil rozet). `useEffect` ile önceki değeri izle (`usePrevious` pattern veya ref).

> OpenCV fix sonrası `contourRefining` gerçekten `false`'a dönecek (önceden timeout'ta takılıyordu) — bu bildirim ancak o fix'le anlamlı.

**Doğrulama:** Otomatik bıçak → "iyileştiriliyor…" → birkaç sn sonra "hazır ✓" → kaybolur.

---

## GÖREV 6/6 — DPI baskı kalite uyarısı [high/S]

#### Dosya: `src/lib/editor/suggest-mm-from-pixels.ts` + `EditorShell.tsx` (boyut bölümü)

`suggestMmFromPixels` her zaman `DPI=300` varsayıyor (satır 5) — gerçek görsel DPI okunmuyor. 72dpi web
görseli + 200mm boyut → baskıda pikselleşir, editör **hiç uyarmıyor** (design-qc ödeme SONRASI çalışıyor, geç).

Etkin DPI hesabı = `pixelWidth / (widthMm / 25.4)`. Boyut değişince/görsel yüklenince:
- `effectiveDpi >= 150` → sorun yok
- `100 ≤ effectiveDpi < 150` → **sarı uyarı**: "Bu boyutta baskı kalitesi düşebilir (≈{dpi} DPI). Daha küçük boyut veya yüksek çözünürlüklü görsel öner."
- `effectiveDpi < 100` → **kırmızı uyarı**: "Çözünürlük baskı için düşük — pikselli çıkabilir."

`onDesignLoaded` zaten `{widthPx, heightPx}` veriyor (PikasoEditorCanvas:699). Boyut state'i ile DPI hesapla, sağ panelde boyut altında uyarı göster. (Engelleme değil, uyarı — kullanıcı yine de devam edebilir.)

**Doğrulama:** Küçük görseli (ör. 300px) 150mm yap → sarı/kırmızı DPI uyarısı; büyük görselde uyarı yok.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)

1. `rm -rf .next/dev/types` sonra `npx tsc --noEmit` → 0 hata (kalırsa push etme).
2. `git add -A`
3. `git commit -m "feat(editor-dalga1): urun yonlendirme CTA + kose yaricapi + dondur/cevir + katman tooltip + kontur-hazir + DPI uyarisi"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash + canlı URL (`/editor`) bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. Hepsi UI/editör — Sefa canlıda `/editor`'da 6 davranışı test edecek.
> Görev 3 (döndürme) + Görev 5 (kontur hazır) OpenCV fix'iyle tam çalışır — o fix canlıda olmalı.
