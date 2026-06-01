# Editör KÖK NEDEN — OpenCV worker'a hiç yüklenmiyor 🔴🔴🔴

## CANLI DEBUG İLE KANITLANDI (Claude, pimetiket.com/editor üzerinde)

Editör konturu "hep kaba/dikenli kalıyor" çünkü **OpenCV worker'a HİÇ yüklenmiyor.** Canlı console:
```
[contour-worker] init error: OpenCV yükleme zaman aşımı
Error: Contour worker hazır değil (zaman aşımı)
```
Önceki tüm editör fix'leri (worker tip birliği, kontur birleştirme, ölçek) bu yüzden GÖRÜNMEDİ — kod hep
OpenCV'siz fast-preview fallback'inde kaldı.

### Kök neden: OpenCV 4.10.0 API değişikliği (Promise-based)

Canlı testte kanıtlandı — `importScripts("https://docs.opencv.org/4.10.0/opencv.js")` sonrası:
```
cv  →  bir PROMISE (cvIsPromise: true, hasMat: false, hasOnRuntime: false)
1sn sonra: cv.then(real => real.Mat var)  ✅
```
Yani **OpenCV 4.10.0'da `cv` artık bir Promise** — `cv.then(realCv => ...)` ile resolve olur.

Ama `src/lib/editor/cutline/contour.worker.ts` (satır 41-54) **eski (4.5.x) API** bekliyor:
```js
g.cv = { onRuntimeInitialized: () => { if (g.cv?.Mat) finish(g.cv); } };
importScripts(OPENCV_JS_URL);
if (g.cv?.Mat) finish(g.cv);
```
4.10.0'da:
- `onRuntimeInitialized` HİÇ tetiklenmez (cv artık callback-modülü değil, Promise),
- `importScripts` sonrası `g.cv.Mat` yok (cv = Promise),
- → ne `finish` ne `fail` çağrılır → 12sn timeout → "OpenCV yükleme zaman aşımı".

---

## GÖREV 1/1 — Worker OpenCV yüklemesini Promise + legacy uyumlu yap

#### Dosya: `src/lib/editor/cutline/contour.worker.ts` → `loadOpenCvInWorker` (satır ~19-56)

`importScripts` sonrası `self.cv`'yi şu sırayla ele al (her iki API'yi destekle):

```ts
function loadOpenCvInWorker(): Promise<OpenCvModule> {
  const g = self as unknown as CvGlobal;
  if (g.cv?.Mat) return Promise.resolve(g.cv);

  cvPromise ??= new Promise<OpenCvModule>((resolve, reject) => {
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
      importScripts(OPENCV_JS_URL);
      const raw = (g as { cv?: unknown }).cv;

      // 4.10.0+: cv bir Promise (cv.then ile resolve)
      if (raw && typeof (raw as { then?: unknown }).then === "function") {
        (raw as Promise<OpenCvModule>)
          .then((real) => {
            g.cv = real;
            if (real?.Mat) finish(real);
            else fail(new Error("OpenCV Promise resolved ama Mat yok"));
          })
          .catch(fail);
        return;
      }

      // Zaten hazır (senkron)
      if (g.cv?.Mat) { finish(g.cv); return; }

      // Legacy 4.5.x: onRuntimeInitialized callback
      const mod = g.cv as (OpenCvModule & { onRuntimeInitialized?: () => void }) | undefined;
      if (mod) {
        mod.onRuntimeInitialized = () => {
          if (g.cv?.Mat) finish(g.cv);
          else fail(new Error("OpenCV init başarısız"));
        };
      } else {
        fail(new Error("OpenCV global yok (importScripts başarısız?)"));
      }
    } catch (err) {
      fail(err);
    }
  });
  return cvPromise;
}
```

**Kritik noktalar:**
- `cv.then` kontrolü EN BAŞTA (4.10.0 yolu). Promise resolve olunca `g.cv = real` ata ki sonraki çağrılar senkron dönsün.
- Mevcut `OPENCV_INIT_TIMEOUT_MS = 12_000` yeterli (gerçek yükleme ~1-2.5sn, canlı ölçüldü). Dokunma.
- `OPENCV_JS_URL` = `4.10.0` doğru, erişilebilir (canlı doğrulandı). URL'i DEĞİŞTİRME.
- CSP zaten `docs.opencv.org`'a izin veriyor (doğrulandı). Dokunma.

#### Ek: init hata logu görünür olsun (zaten kısmen var)
`self.onmessage` init catch'inde `console.error("[contour-worker] init:", err)` zaten var — koru.

---

## DOĞRULAMA (Sefa + Cursor)

1. `npx tsc --noEmit` → 0 hata.
2. **Canlı/preview `/editor`** → görsel yükle → "Otomatik bıçak":
   - Console'da **"OpenCV yükleme zaman aşımı" OLMAMALI**.
   - Birkaç saniye (~1-3sn) içinde kontur **incelir + silüete oturur** (kaba dikenli fast-preview kaybolur).
3. Console'da `cv` resolve sonrası worker `ready` mesajı gelmeli (init error yok).
4. Futbolcu+top → tek dış kontur (Görev b1af3b8'deki minArea/kernel fix'i artık GÖRÜNÜR olur — OpenCV çalıştığı için).

> ÖNEMLİ: Bu fix OpenCV'yi çalıştırınca, önceki turlardaki kontur-kalite fix'leri (minArea, MORPH_CLOSE
> kernel) de İLK KEZ gerçekten devreye girer. Yani kontur kalitesini bu fix sonrası değerlendir.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)

1. `rm -rf .next/dev/types` sonra `npx tsc --noEmit` → 0 hata (kalırsa push etme).
2. `git add -A`
3. `git commit -m "fix(editor): OpenCV 4.10 Promise-API worker yukleme (timeout kok neden) — kontur artik netlesir"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash + canlı URL (`/editor`) bildir.

> Git kökü `pim-etiket/core/`. Migration YOK. Bu, editör kontur sorununun GERÇEK kök nedeni —
> Sefa canlıda "kontur birkaç saniyede netleşiyor mu" diye test edecek.
