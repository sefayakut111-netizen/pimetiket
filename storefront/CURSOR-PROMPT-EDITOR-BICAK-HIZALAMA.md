# Editör Bıçak Hizalama Fix — kontur görselden kayıyor

## SORUN (kullanıcı-yüzü)

`/editor` (Bıçak & baskı hazırlama). "Otomatik bıçak oluştur" → Kontur/Otomatik modunda üretilen
magenta kesim çizgisi **görselin üzerine oturmuyor**, sağa + aşağı kaymış halde duruyor. Kayma miktarı
tam olarak **label (turuncu sayfa) sol-üst köşesi** kadar.

`rect` ve `circle` (Şekil/Şablon) modları **DOĞRU** çalışıyor — sadece `contour`/`hull` (Otomatik) bozuk.

## KÖK NEDEN (çift label-origin kayması) — değiştirme, anla

Koordinat çerçevesi çakışması var. Kontur yolları **board-mutlak** mm üretiliyor ama renderer onları
**label-local** sanıp bir kez daha label köşesine kaydırıyor:

1. `src/lib/editor/pikaso/placement.ts:36` — `placementFromPikasoImage` görselin konumunu **board-mutlak**
   mm döndürür: `x = shape.x() / EDITOR_PX_PER_MM` (shape.x() board/layer'a göre, label'a göre DEĞİL).
2. `src/lib/editor/cutline/contour.ts:14-19` — `mapPixelPathsToLabelMm` adına rağmen bu board-mutlak
   konumu içine gömer: `imagePlacementMm.x + px*sx` → çıktı **board-mutlak** mm.
3. `src/lib/editor/pikaso/render-cutline.ts:103-105` — `renderCutlineOverlays` grubu **bir kez daha**
   label köşesine kaydırır: `group.position({ x: labelX, y: labelY })`.

Sonuç: `son_x = labelX + board_görsel_x + silüet` → kontur görselden tam `(labelX, labelY)` kadar ötede.

**Neden rect/circle doğru:** `fixedFramePathsMm` koordinatları label-local (0…labelW) üretir; renderer'ın
grubu `{labelX,labelY}`'de olduğu için tam oturur. Yani **renderer'ın beklediği çerçeve = label-local**.
Bozuk olan tek şey: contour/hull yollarının board-mutlak gelmesi.

## MİMARİ KARAR (uygula, değiştirme)

- **Çözüm yönü:** Konturu da rect/circle gibi **label-local** yap. Renderer'a (`renderCutlineOverlays`)
  ve blade transform mantığına (`applyGroupTransform`, `bladeTransformFromGroup`) DOKUNMA — onlar
  zaten label-local çerçeveye göre tutarlı.
- **Tek değişiklik noktası:** `buildContourInput` içinde, görsel placement'ından label köşesini çıkar.
  Bu fonksiyon hem fast preview hem worker yolunu besler → tek fix iki yolu da düzeltir.
- rect/circle yolu `shape=null` ile çağrılır (placement `undefined`) → bu değişiklikten **etkilenmez**.
- CLAUDE.md sefaRules geçerli (cüzdan/puan/üyelik indirimi yok — bu görevle ilgisiz, sadece hatırlatma).

---

## ÇÖZÜM — 1 GÖREV

### GÖREV 1/1 — `buildContourInput`'ta placement'ı label-local'e çevir

#### Dosya: `src/components/editor/PikasoEditorCanvas.tsx` (~satır 326)

**Önce (mevcut):**
```ts
const placementMm = shape
  ? placementFromPikasoImage(shape).placementMm
  : undefined;
```

**Sonra:**
```ts
const placementMm = shape
  ? (() => {
      const p = placementFromPikasoImage(shape).placementMm;
      // Board-mutlak → label-local: renderer grubu zaten {labelX,labelY}'ye kaydırıyor,
      // yani kontur yolları label köşesine göreli olmalı (rect/circle ile aynı çerçeve).
      return {
        ...p,
        x: p.x - labelX / EDITOR_PX_PER_MM,
        y: p.y - labelY / EDITOR_PX_PER_MM,
      };
    })()
  : undefined;
```

#### Import kontrolü
`EDITOR_PX_PER_MM` bu dosyada import edilmiş mi kontrol et. Yoksa ekle:
```ts
import { EDITOR_PX_PER_MM } from "@/lib/editor/coords";
```
(`labelX` / `labelY` zaten dosyada tanımlı: `const labelX = LABEL_ORIGIN_X; const labelY = LABEL_ORIGIN_Y;`)

> NOT: Başka hiçbir dosyayı değiştirme. `mapPixelPathsToLabelMm`, `renderCutlineOverlays`,
> `blade-transform.ts`, `placement.ts` AYNEN kalır. Fix sadece bu tek yerde placement'ı doğru
> çerçeveye taşır.

---

## DOĞRULAMA (bitince)

1. `npx tsc --noEmit` → 0 hata.
2. `/editor`'da PNG yükle → "Otomatik bıçak oluştur" → magenta kontur **görselin tam üzerine** oturmalı
   (artık sağa/aşağı kaymıyor). Silüeti takip etmeli.
3. Görseli sürükle (farklı konuma taşı) → "Otomatik bıçak oluştur" tekrar → kontur yeni konumda da
   görselin üzerinde olmalı (board'ın her yerinde hizalı).
4. **Regresyon:** Şekil/Şablon → Daire ve Dikdörtgen modları hâlâ doğru (label sayfasına oturuyor) —
   bu modlar değişmemeli.
5. Bıçağı seç + sürükle/ölçeklendir (interactive blade) → transform sonrası kontur tutarlı kalmalı
   (`bladeTransform` çerçevesi de label-local olduğu için bozulmamalı).

## DEĞİŞECEK DOSYALAR
**Düzenlenecek (1):**
- `src/components/editor/PikasoEditorCanvas.tsx` — `buildContourInput` placement label-local + (gerekiyorsa) `EDITOR_PX_PER_MM` import.

**Yeni / silinecek:** YOK.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)

Görev bitince ve doğrulama geçince:
1. `npx tsc --noEmit` **TEMİZ** olmalı (kırıksa push ETME, önce düzelt — Vercel deploy fail eder).
2. `git add storefront/src/components/editor/PikasoEditorCanvas.tsx`
3. `git commit -m "fix(editor): kontur bıçağı label-local hizalama (çift origin kayması)"`
4. `git push origin main` → Vercel otomatik deploy
5. Deploy READY olunca **commit hash + canlı URL** (https://pimetiket.com/editor) bildir — Sefa canlıda kontrol edecek.

> Git kökü `pim-etiket/core/` (üst klasör değil). Bu fix sadece kod; migration YOK, ek apply gerekmez.
