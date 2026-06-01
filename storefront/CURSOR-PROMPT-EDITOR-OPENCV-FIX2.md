# Editör OpenCV Fix #2 — thenable `.catch` hatası (kök nedenin son halkası)

## CANLI DEBUG İLE KANITLANDI (Claude, pimetiket.com/editor — version 574b57e)

Önceki OpenCV fix'i (Promise-API yönü) DOĞRUYDU ama **yanlış zincirlendi.** Canlı console:
```
[contour-worker] init error: t.then(...).catch is not a function
Error: t.then(...).catch is not a function
```

### Kök neden
`contour.worker.ts`'te OpenCV 4.10 yolu şöyle yazılmış:
```ts
(raw as Promise<OpenCvModule>).then((real) => {...}).catch(fail);
```
Ama OpenCV 4.10'da `importScripts` sonrası `cv` **gerçek Promise DEĞİL — bir "thenable"** (sadece `.then`
metodu olan Emscripten Module objesi). `cv.then(onOk)` çağrısının dönüş değeri standart Promise değil →
`.catch` metodu YOK → `t.then(...).catch is not a function` exception → worker init çöküyor →
**kontur hâlâ kaba fast-preview'da kalıyor** (Sefa'nın baştan beri gördüğü sorun).

Canlı testte teyit (önceki tur): `cv.then(real => real.Mat)` callback'i **resolve oluyor** (hasMat:true,
~1sn) — yani `.then(callback)` çalışıyor, SADECE `.catch` zinciri kırık.

---

## GÖREV 1/1 — thenable'ı Promise.resolve ile sar

#### Dosya: `src/lib/editor/cutline/contour.worker.ts` → `loadOpenCvInWorker` (OpenCV 4.10 dalı)

`.then(...).catch(...)` zincirini, thenable'ı **gerçek Promise'e saran** güvenli forma çevir.
`Promise.resolve(thenable)` thenable'ı yutar ve standart Promise döndürür — hem `.then` hem `.catch` garanti.

**Mevcut (BOZUK):**
```ts
if (raw && typeof (raw as { then?: unknown }).then === "function") {
  (raw as Promise<OpenCvModule>)
    .then((real) => {
      g.cv = real;
      if (real?.Mat) finish(real);
      else fail(new Error("OpenCV Promise resolved ama Mat yok"));
    })
    .catch(fail);   // ← OpenCV thenable'ında .catch YOK → patlıyor
  return;
}
```

**Düzeltilmiş (GÜVENLİ):**
```ts
if (raw && typeof (raw as { then?: unknown }).then === "function") {
  // OpenCV 4.10 cv bir thenable (gerçek Promise değil) — Promise.resolve ile sar.
  // Promise.resolve(thenable) standart Promise döndürür → .catch güvenli.
  Promise.resolve(raw as PromiseLike<OpenCvModule>).then(
    (real) => {
      g.cv = real;
      if (real?.Mat) finish(real);
      else fail(new Error("OpenCV resolved ama Mat yok"));
    },
    (err) => fail(err)   // ← reject handler ikinci argüman (.catch zinciri YOK)
  );
  return;
}
```

**İki kritik değişiklik:**
1. `(raw as Promise)` → `Promise.resolve(raw as PromiseLike<...>)` — thenable'ı gerçek Promise'e sarar.
2. `.then(onOk).catch(fail)` → `.then(onOk, onErr)` — iki-argümanlı then (reject ikinci param). `.catch` zincirine HİÇ güvenme (thenable'da yok).

> Tip: `raw as PromiseLike<OpenCvModule>` kullan (Promise değil, PromiseLike — thenable'ı doğru tipler).
> Mevcut legacy (`onRuntimeInitialized`) ve senkron (`g.cv?.Mat`) dalları AYNEN kalsın — sadece bu Promise dalı düzelir.
> `OPENCV_INIT_TIMEOUT_MS=12000` yeterli (gerçek yükleme ~1-2.5sn canlı ölçüldü). Dokunma.

---

## DOĞRULAMA (KRİTİK — bu turlarca süren sorun)
1. `rm -rf .next/dev/types` + `npx tsc --noEmit` → 0 hata.
2. **Canlı/preview `/editor`** → PNG yükle → "Otomatik bıçak":
   - Console'da **"`.catch is not a function`" ve "OpenCV yükleme zaman aşımı" OLMAMALI**.
   - Console'da worker `ready` mesajı gelmeli (init başarılı).
   - Birkaç saniye (~1-3sn) içinde kontur **incelir + silüete oturur** — kaba dikenli fast-preview KAYBOLUR.
3. Bu fix çalışınca önceki tüm kontur-kalite fix'leri (minArea, MORPH_CLOSE, RETR_CCOMP) İLK KEZ gerçekten devreye girer.

---

## GÖREV 2/2 (küçük) — Köşe yarıçapı clamp [Dalga 1 gözlem]

#### Dosya: `src/components/editor/EditorShell.tsx` (köşe yuvarlaklığı slider) veya cutline rect üretimi

Claude canlıda gördü: 9.9mm genişlikte köşe yuvarlaklığı 9mm yapılınca kontur dikdörtgen yerine
**baklava/elmas** şekline dönüşüyor (köşe yarıçapı genişliğin yarısını aşınca geometri bozuluyor).

**Fix:** Köşe yarıçapını boyutla clamp et: `cornerRadiusMm = Math.min(value, widthMm/2, heightMm/2)`.
Slider max'ı da dinamik olabilir (`min(20, widthMm/2, heightMm/2)`) ya da render anında clamp.

**Doğrulama:** Dar dikdörtgende (ör. 10mm) köşe slider'ı sonuna çekilince şekil yuvarlak-köşeli dikdörtgen kalır, baklava olmaz.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)

1. `npx tsc --noEmit` → 0 hata (kalırsa push etme).
2. `git add -A`
3. `git commit -m "fix(editor): OpenCV thenable Promise.resolve ile sar — .catch zinciri hatasi (kontur init kok neden)"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. Bu, editör kontur sorununun KÖK NEDENİNİN son halkası — Claude canlıda
> console ile teyit etti (`t.then(...).catch is not a function`). Deploy sonrası Claude tekrar canlıda
> test edecek: kontur gerçekten netleşiyor mu.
