# Editör OpenCV Fix #3 — ÇALIŞAN REFERANSA göre (POC pattern'i)

## REFERANS: pim_etiket_poc.html ZATEN DOĞRU ÇALIŞIYOR (onay ekranı)

Onay ekranındaki bıçak editörü (`public/poc.html`, iframe) OpenCV'yi **sorunsuz** yüklüyor — AYNI versiyon
(`docs.opencv.org/4.10.0/opencv.js`). Sefa: "o düzgün çalışıyordu, referans al." Claude POC kodunu okudu.

### POC'un çalışan pattern'i (kanıt — public/poc.html)
```js
// 1. ÖNCE Module global tanımlanır (satır 2280-2283):
var Module = {
  onRuntimeInitialized: onOpenCvReady   // OpenCV WASM hazır olunca BUNU çağırır
};

// 2. SONRA script yüklenir (satır 4686):
<script async src="https://docs.opencv.org/4.10.0/opencv.js"></script>
```
**POC `cv.then` / `Promise.resolve` HİÇ KULLANMIYOR.** Klasik Emscripten pattern'i: `Module` objesi
script yüklenmeden ÖNCE global'de hazır olur; OpenCV init bitince kendisi `Module.onRuntimeInitialized`'ı
tetikler. `cv.Mat` o callback'te hazırdır.

### Editör worker NEDEN bozuktu
`contour.worker.ts` yanlış sıra yapıyordu: önce `importScripts` edip SONRA `cv.then`/`Promise.resolve` ile
yakalamaya çalışıyordu. OpenCV 4.10'da `cv` thenable → `.catch` yok (FIX2 hatası) → `Promise.resolve`
sonsuz unwrap (FIX2.5 timeout). POC bu tuzağa HİÇ girmiyor çünkü `Module.onRuntimeInitialized` kullanıyor,
`cv` thenable'ına hiç dokunmuyor.

---

## GÖREV 1/1 — Worker'ı POC pattern'ine çevir (Module.onRuntimeInitialized)

#### Dosya: `src/lib/editor/cutline/contour.worker.ts` → `loadOpenCvInWorker` (~satır 19-80)

`cv.then` / `Promise.resolve` / thenable mantığını TAMAMEN KALDIR. POC gibi `Module` global'ini
**importScripts'ten ÖNCE** kur:

```ts
function loadOpenCvInWorker(): Promise<OpenCvModule> {
  const g = self as unknown as CvGlobal;
  if (g.cv?.Mat) return Promise.resolve(g.cv);
  if (cvPromise) return cvPromise;

  cvPromise = new Promise<OpenCvModule>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cvPromise = null;
      reject(new Error("OpenCV yükleme zaman aşımı"));
    }, OPENCV_INIT_TIMEOUT_MS);

    const finish = (cv: OpenCvModule) => { clearTimeout(timeout); resolve(cv); };
    const fail = (err: unknown) => {
      clearTimeout(timeout); cvPromise = null;
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    try {
      // POC pattern (public/poc.html:2280): Module global'i importScripts'ten ÖNCE kur.
      // OpenCV WASM init bitince Module.onRuntimeInitialized çağrılır; cv.Mat o an hazır.
      // cv.then / Promise.resolve KULLANMA — 4.10 thenable tuzağı (FIX2/FIX2.5 buradan patladı).
      const gg = self as unknown as { Module?: unknown; cv?: OpenCvModule };
      gg.Module = {
        onRuntimeInitialized: () => {
          // OpenCV global'i 'cv' olarak set eder; Module === cv (Emscripten)
          const cv = (gg.cv ?? (gg.Module as OpenCvModule)) as OpenCvModule;
          if (cv?.Mat) { g.cv = cv; finish(cv); }
          else fail(new Error("OpenCV init OK ama Mat yok"));
        },
      };

      importScripts(OPENCV_JS_URL);

      // Bazı build'lerde import senkron hazır olabilir (cache) — kontrol et:
      if (g.cv?.Mat) finish(g.cv);
    } catch (err) {
      fail(err);
    }
  });
  return cvPromise;
}
```

**Kritik noktalar:**
1. `self.Module = { onRuntimeInitialized }` **importScripts'ten ÖNCE** — POC ile birebir.
2. `cv.then` / `Promise.resolve(raw)` / `.catch` mantığı TAMAMEN SİLİNDİ.
3. Callback'te `cv` global'inden oku (`gg.cv`), `Mat` kontrolü ile finish/fail.
4. Senkron hazır-cache kontrolü (`if (g.cv?.Mat) finish`) — zararsız fallback.
5. `OPENCV_INIT_TIMEOUT_MS=12000` kalsın (POC ~2.5sn yüklüyor, bol pay).

> `CvGlobal` tipini gerekirse `{ cv?: OpenCvModule; Module?: unknown }` olacak şekilde genişlet.
> Worker dosyasının başındaki `import { OPENCV_JS_URL }` ve `computePathsFromBitmap` aynen kalsın.
> POC `4.10.0` kullanıyor; `OPENCV_JS_URL` de `4.10.0` olmalı (opencv-types.ts:3 zaten öyle — DOĞRULA).

---

## DOĞRULAMA (3. deneme — bu sefer çalışan referansa dayalı)
1. `rm -rf .next/dev/types` + `npx tsc --noEmit` → 0 hata.
2. **Canlı `/editor`** → PNG yükle → "Otomatik bıçak":
   - Console: NE `.catch is not a function` NE `zaman aşımı` — temiz.
   - **~1-3 sn içinde kontur incelir + silüete oturur** (kaba fast-preview kaybolur). ← HEDEF
3. Karşılaştırma: `/onay/[orderId]/duzenle/[itemId]` (POC iframe) zaten kontur netleştiriyor — editör artık aynı davranmalı.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)
1. `npx tsc --noEmit` → 0 hata.
2. `git add -A`
3. `git commit -m "fix(editor): OpenCV worker POC pattern (Module.onRuntimeInitialized) — thenable tuzagi tamamen kaldirildi"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. Bu fix ÇALIŞAN referansa (public/poc.html onay ekranı) dayalı — tahmin değil.
> POC `var Module = { onRuntimeInitialized }` + sonra script yüklüyor; worker da aynısını yapacak.
> Deploy sonrası Claude canlıda test edecek — kontur POC'taki gibi netleşmeli.
