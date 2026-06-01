# Editör — Kontur kalitesi + görsel ölçek + worker fix

`cutline-imaging` domaini. Sefa /editor'da 3 sorun bildirdi; kod okundu, kök nedenler kanıtlı.
file:line referanslı. Editör matematiği — doğrulama adımlarını atlama.

## TEŞHİS (3 sorun)

**A) Kontur dikenli/kalın, "hep böyle kalıyor" (OpenCV refine devreye girmiyor)**
Ekranda kalan çizgi aslında **fast-preview** (`hullFromImage` → `traceAlphaOuterBoundary`, kaba piksel-zinciri).
OpenCV worker sonucu hiç gelmiyor çünkü **worker mesaj tipi bozuk**:
`contour-worker-client.ts:9` → `import type { WorkerOut } from "./contour.worker"` ama `contour.worker.ts`
böyle bir tip **export ETMİYOR** (orada `ReadyOut/ComputeOkOut/ComputeErrOut/InitErrOut` var, birleşik
`WorkerOut` yok). Bu hem tsc hatası (TS2339 ×5) hem de `handleWorkerMessage`'ın `data.type`/`data.error`
narrowing'inin güvenilmez çalışması → worker sonucu düzgün resolve edilmiyor → fast-preview kalıcı kalıyor.

> NOT: Bu, `CURSOR-PROMPT-TSC-TEMIZLE.md` Görev 3 ile AYNI kök. O prompt henüz uygulanmadıysa bu görev onu da kapsar; uygulandıysa burada tekrar etme, sadece doğrula.

**B) Görsel label'dan küçük açılıyor**
`PikasoEditorCanvas.tsx:665-679`: ölçek `getOpaqueBoundsPx` (şeffaf kenarları KIRPILMIŞ içerik) +
`marginMm=2` üzerinden `contain` mantığıyla hesaplanıyor. PNG'de figür etrafında bol şeffaf alan → kırpılan
içerik label'ı dolduramıyor, küçük görünüyor.

**C) Kontur figür parçalarını ayrı ayrı sarıyor (top + uzuvlar kopuk)**
`contour-opencv-algorithms.ts:164` `minArea = totalArea * 0.003` çok düşük → küçük kopuk parçalar (top,
ayrık uzuv) ayrı kontur oluyor; sticker tek parça olması gerekirken çoklu dikenli hat çıkıyor.

---

## GÖREV 1/3 — Worker tip birliği (kontur refine'ı çalıştır) 🔴 EN KRİTİK

#### Dosyalar: `src/lib/editor/cutline/contour.worker.ts` + `contour-worker-client.ts`

`contour.worker.ts`'te birleşik `WorkerOut` tipini tanımla + **export** et (mevcut 4 alt-tipin union'ı):
```ts
export type WorkerOut =
  | { type: "ready" }
  | { type: "error"; error: string }
  | { id: number; paths: PathRing[][] }
  | { id: number; error: string };
```
`contour-worker-client.ts:9` zaten bunu import ediyor — export gelince TS2339 ×5 kapanır ve
`handleWorkerMessage` / `waitForWorkerReady` narrowing'leri (`data.type`, `"id" in data`, `data.error`)
doğru çalışır → **OpenCV sonucu artık resolve olur, fast-preview yerine net kontur gelir.**

> `canUseContourWorker()` ve CSP'yi de doğrula: OpenCV `docs.opencv.org` CDN'i CSP `script-src`/`connect-src`'de
> olmalı (next.config.ts'te var). Worker init fail ederse `console.error` logla (sessiz fallback yerine görünür).

**Doğrulama:** `/editor` → görsel yükle → "Otomatik bıçak" → birkaç sn sonra kontur **incelir + netleşir**
(dikenli fast-preview kalıcı kalmaz). DevTools Console'da worker hatası olmamalı. `npx tsc` bu 5 hatayı vermez.

---

## GÖREV 2/3 — Kopuk parçaları tek konturda topla (top + uzuv)

#### Dosya: `src/lib/editor/cutline/contour-opencv-algorithms.ts` → `generateOffsetPaths` (~satır 162-178)

`minArea = totalArea * 0.003` çok düşük → gürültü + kopuk parçalar ayrı kontur. İki iyileştirme:
1. `minArea` eşiğini yükselt: `Math.max(totalArea * 0.01, 200)` (küçük gürültüyü ele, ama topu kaybetme — 0.01 dengeli; test et).
2. **MORPH_CLOSE kernel'ini büyüt** ki yakın parçalar (top-ayak, uzuv-gövde) tek maskede birleşsin:
   `buildMask`'te `closeSize` formülünü güçlendir — `Math.round(minDim / 60)` (şu an /120) ile daha agresif kapatma. Bu, ince boşlukları kapatıp tek dış kontur üretir.

> Amaç: sticker **tek parça** kesim olsun. Hard-aralıklı gerçekten ayrı objeler (örn. logo + ayrı yazı)
> için çoklu kontur DOĞRU — ama figür+top gibi yakın parçalar birleşmeli. Dengeyi test görselleriyle ayarla.

**Doğrulama:** Futbolcu+top görselinde tek kapalı dış kontur (top figüre yakınsa dahil); dikenli iç çizgiler kaybolur.

---

## GÖREV 3/3 — Görsel açılışta label'ı doldursun (küçük açılma fix)

#### Dosya: `src/components/editor/PikasoEditorCanvas.tsx` (~satır 665-693, `loadDesign`)

İlk yüklemede görsel `contain` + 2mm margin + content-bbox ile küçük kalıyor. Sefa beklentisi:
"orijinal ölçüsü arkadaki koyu-sarı alanı doldursun".

**Fix seçeneği (öner + uygula):** İlk açılışta `imageAttrsForPreset(..., "contain")` yerine label'ı
**dolduran** ölçek kullan ama figürü taşırma:
- `marginMm`'i 2 → **0** yap (ilk açılışta label kenarına kadar) VEYA
- content-bbox yerine **görselin tam boyutunu** label'a `contain` et (şeffaf alan dahil) — böylece
  "orijinal ölçü" hissi korunur.

> En temiz: `loadDesign`'da preset'i `"contain"` ama `marginMm=0` ve content-bbox kırpmayı yalnızca
> cutline hesabında kullan, **görsel yerleşiminde değil**. Yani görsel doğal haliyle label'ı doldursun,
> kontur içeriği bbox'tan hesaplansın. Bu ikisini ayır.

Kullanıcı zaten sonradan elle ölçekleyebiliyor (drag/transform) — bu sadece **ilk açılış** ölçeği.

**Doğrulama:** Görsel ilk açıldığında koyu-sarı label alanını dolduracak şekilde (orijinal oranında) gelir; taşma yok. Sonra elle küçültme/büyütme çalışır.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)

1. `rm -rf .next/dev/types` sonra `npx tsc --noEmit` → 0 hata (kalırsa push etme).
2. `git add -A`
3. `git commit -m "fix(editor): worker tip birligi (OpenCV refine) + kopuk kontur birlestirme + ilk acilis label-fit olcek"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash + canlı URL (`/editor`) bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. Sefa /editor'da test edecek: (A) kontur inceliyor mu, (B) görsel label'ı dolduruyor mu, (C) tek parça kontur mu.
> Görev 1 worker fix'i `CURSOR-PROMPT-TSC-TEMIZLE.md` Görev 3 ile çakışıyorsa — hangisi önce uygulanırsa diğerinde "zaten yapıldı" diye geç.
