# Editör BG Removal Fix — publicPath yanlış host (Claude canlı debug)

UIUX Tur 3 (commit 28316ca) 5/6 çalışıyor. SADECE arka plan kaldır HÂLÂ çalışmıyor — önceki publicPath
fix'i YANLIŞ host'a işaret etti.

## KÖK NEDEN (Claude pimetiket.com'da kanıtladı)
`removeBackground(file, { publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/dist/' })`
→ HÂLÂ `TypeError: Failed to fetch`. Sebep:
- `@imgly/background-removal@1.5.5` paketinde MODEL DOSYALARI YOK (sadece kod + onnxruntime-web dependency).
  Kanıt: `jsdelivr/.../dist/resources.json` = boş `{}` (2 byte); `isnet.onnx`/`*.wasm` = 404.
- Model'ler AYRI pakette + AYRI host'ta: kütüphane kodundaki default →
  **`https://staticimgly.com/@imgly/background-removal-data/${VERSION}/dist/`** (Claude +esm kodundan çıkardı).
- publicPath'i jsdelivr KOD paketine verince model bulunamadı → boş resources.json → fetch fail.

## ÇÖZÜM — publicPath'i KALDIR + staticimgly.com'u CSP'ye ekle

### Adım 1: `poc.html` `performBackgroundRemoval` (~satır 4146)
publicPath satırını KALDIR → kütüphane kendi default host'unu (`staticimgly.com`) kullansın:
```js
const blob = await removeBackground(currentFile, {
  // publicPath KALDIRILDI — kütüphane default staticimgly.com'dan model çeker (CSP'ye eklendi)
  progress: (key, current, total) => { ... }  // mevcut progress kalsın
});
```
> Alternatif: publicPath'i DOĞRU host'a ver: `'https://staticimgly.com/@imgly/background-removal-data/1.5.5/dist/'`
> — ama default zaten bu, KALDIRMAK daha temiz. (data paketi versiyonu kütüphaneyle eşleşir.)

### Adım 2: CSP `connect-src`'e staticimgly.com ekle
#### `next.config.ts` (~satır 80, connect-src) + varsa `src/lib/security/csp.ts`
Mevcut connect-src'e ekle: `https://staticimgly.com`
```
connect-src 'self' data: https://*.supabase.co ... https://cdn.jsdelivr.net ... https://staticimgly.com
```
> Model ONNX/WASM `staticimgly.com`'dan `fetch` ile geliyor → connect-src'de olmalı. script-src'ye GEREK YOK
> (model asset, script değil). SADECE connect-src.

### Adım 3 (kontrol): worker-src / wasm
onnxruntime-web WASM worker kullanabilir. `Failed to fetch` connect-src ile çözülmeli ama eğer worker
hatası çıkarsa `worker-src 'self' blob:` + `script-src`'de `'wasm-unsafe-eval'` olduğunu doğrula (muhtemelen var).

---

## DOĞRULAMA (Claude canlıda test edecek)
1. `npx tsc --noEmit` → 0 hata.
2. Canlı `/editor` → beyaz arka planlı görsel yükle → "AI ile arka planı kaldır":
   - Console'da `Failed to fetch` OLMAMALI.
   - Model indirme progress (ilk sefer ~30sn) → arka plan kalkar (şeffaf olur).
3. Network: `staticimgly.com`'dan model (.onnx/.wasm) 200 döner.

## SON ADIM — commit + push + canlıya al (ZORUNLU)
1. `npx tsc --noEmit` → 0 hata.
2. `git add -A`
3. `git commit -m "fix(editor): bg-removal publicPath kaldir + staticimgly.com CSP connect-src (model host)"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. Önceki publicPath jsdelivr fix'i YANLIŞTI (model orada yok). Doğru host
> staticimgly.com — ya default'a bırak (publicPath kaldır) ya da o host'a ver; HER İKİSİNDE de CSP connect-src'e
> staticimgly.com ŞART. Claude canlıda network+console ile teyit etti.
