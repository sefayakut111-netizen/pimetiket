# Cursor Görev Notları — Editör Hafriyatı (12 Haziran 2026)

> **Amaç:** Bu dosya, editör (poc.html + CV worker + üretim bıçak geometrisi) üzerinde yapılan
> derin analiz sonucu çıkan **hata ve verimlilik** bulgularını içerir. Her bulgu Cursor'a
> doğrudan görev olarak verilebilecek formattadır: konum (`dosya:satır`), sorun, somut düzeltme.
> Satır numaraları commit `323943b` itibarıyladır.
>
> **İncelenen dosyalar:** `storefront/public/poc.html` (6375 satır, tamamı),
> `storefront/public/vendor/pim-cv-worker.js` (446 satır, tamamı),
> `storefront/scripts/editor-bridge-contract.runner.ts`,
> `storefront/scripts/editor-export-geometry-*.runner.ts`,
> `storefront/src/lib/print/extract-cutline-rings.ts`, `build-print-pdf.ts`, `production-pdf.ts`,
> `storefront/src/lib/editor/cutline/*`.

---

## Önerilen PR sıralaması (paketleme)

| PR | Kapsam | Bulgular |
|---|---|---|
| **PR-1** | Worker köprüsü sağlamlaştırma (timeout + crash + stale render) | K1, K2, K9 |
| **PR-2** | OpenCV bellek sızıntıları (worker içi) | K3, Y5 |
| **PR-3** | Üretim bıçak geometrisi (fiziksel kesim hataları!) | K4, K5, Y8 |
| **PR-4** | Güvenlik (origin + XSS) | K6, Y12 |
| **PR-5** | Yükleme yarışları (tek jenerasyon-token deseni) | Y6, Y8b, Y15, O18 |
| **PR-6** | Verimlilik (transferable + cache + çift tarama) | Y11, Y7w, O13, O21 |
| **PR-7** | UX hataları (hata görünürlüğü + preflight) | K7, K8, O16, O19 |
| **PR-8** | Test kapsamı genişletme | Y10, O17 |

---

## 🔴 KRİTİK

### K1. Worker köprüsünde timeout yok; crash'te bekleyen promise'ler sonsuza kadar askıda → kalıcı "İşleniyor..." spinner'ı
- **Konum:** `storefront/public/poc.html:2645-2655` (`pimCvRequest`), `:2657-2671` (`pimInitCvMainThreadFallback`), `:2699-2704` (`onerror`)
- **Sorun:** `pimCvRequest` promise'i yalnızca worker yanıt verirse çözülür. Worker çökerse `onerror` sadece fallback'i başlatır; `pimCvWorkerRequests` Map'indeki bekleyen `{resolve, reject}` çiftleri asla reject edilmez → `generateCutline`/`processImage` içindeki `await` dönmez, `hideLoading()` çağrılmaz, kullanıcı kalıcı spinner'da kilitlenir. Worker `terminate()` da edilmiyor.
- **Düzeltme:**
  1. `pimCvRequest`'e 15 sn'lik `setTimeout` ile reject ekle (Map'ten silerek).
  2. `pimInitCvMainThreadFallback` başında Map'teki tüm pending kayıtları `reject(new Error('cv_worker_unavailable'))` ile boşalt, Map'i temizle, `pimCvWorker.terminate()` çağır.

### K2. `generateCutline` async oldu ama çağrı yerleri senkron `render()` yapıyor → ekranda ESKİ bıçak (worker taşımasının doğrudan regresyonu)
- **Konum:** `poc.html:5679-5681` (cut mode değişimi), `:2307-2309` (`pim-editor-set-size`), `:5740-5741` (malzeme), `:5756-5762` (beyaz plan modu), `:3394-3414` (`resetEditorSettings`); `generateCutline` sonu `:4145-4150` — render çağrısı yok
- **Sorun:** Bu çağrı yerlerinde `void generateCutline(); render();` deseni var — `render()` worker yanıtından ÖNCE çalışır. Worker yanıtı `currentPaths`/`whitePlanPaths`'i günceller ama render tetiklemez. Mod/malzeme değişikliğinde kanvas eski bıçağı gösterir; ancak sonraki bir etkileşim (drag/zoom) yenisini çizer. Main-thread fallback'te senkron olduğu için maskelenir — bu yüzden CI'da görünmez.
- **Düzeltme:** Bu çağrı yerlerini `await generateCutline(); await generateWhitePlan(); render();` yapan tek bir async yardımcıya yönlendir; veya `generateCutline`'ın worker-başarı dalının sonunda `render()` çağır.

### K3. OpenCV bellek sızıntısı: `MatVector.get()` dönüşleri hiç `delete()` edilmiyor — her slider hareketinde birikir
- **Konum:** `storefront/public/vendor/pim-cv-worker.js:65` (alphaChannel), `:132`, `:153`, `:184`, `:206`, `:387` (contours.get)
- **Sorun:** `matVector.get(i)` yeni Mat sarmalayıcı döndürür; `channels.delete()`/`contours.delete()` çağrılsa bile get edilen Mat'ler delete edilmediğinden alttaki veri serbest kalmaz. `alphaChannel` her alpha'lı istekte ~1MB sızdırır. Worker uzun ömürlü → her slider hareketinde WASM heap büyür, sonunda OOM.
- **Düzeltme:** Her `channels.get(3)` ve `contours.get(i)` dönüşünü değişkene al, iş bitince `.delete()`: döngülerde `const c = contours.get(i); try {...} finally { c.delete(); }`.

### K4. Üretim bıçak çıkarımı TÜM `d=` path'lerini topluyor — beyaz plan path'leri CutContour spot çizgisi olarak BASILIR
- **Konum:** `storefront/src/lib/print/extract-cutline-rings.ts:319-322` (`extractSvgPathDs`); kaynak SVG `poc.html:6127-6138` (White grubu `<path d=...>` içerir); tüketici `build-print-pdf.ts:279-290`
- **Sorun:** Regex SVG'deki bütün `d` özniteliklerini alır; `data-pim-white` grubundaki beyaz plan path'leri üretim PDF'inde bıçak çizgisi olarak basılır ve `normalizeRingsToLabelMm` bbox hesabını kirletir. **Fiziksel kesim hatası.**
- **Düzeltme:** Önce `<g ... data-pim-cutline="true">...</g>` bloğunu yakala, `d`'leri sadece o gruptan topla.

### K5. `normalizeRingsToLabelMm` bıçak bbox'unu etiket boyutuna ZORLUYOR — 2mm ofset siliniyor + daire elipse dönüşüyor
- **Konum:** `extract-cutline-rings.ts:291-317`; tüketici `production-pdf.ts:87,98`
- **Sorun (commit 9cbd3c6'da eklendi):**
  - (a) mm-sözleşmeli SVG'de ofsetli cut ring `minX=-eff`'ten başlar; eff > 0.5mm veya bbox farkı > %3 ise "alreadyMm" tespiti düşer → ring etiket boyutuna küçültülüp 0'a ötelenir → **bıçak ofseti yok olur, bıçak baskı kenarına oturur**.
  - (b) `sx = labelW/bw`, `sy = labelH/bh` bağımsız ölçekler → aspect farklıysa **daire elipse dönüşür**.
  - (c) `production-pdf.ts:87` hedef olarak hep `width_mm` (etiket) kullanır; `cutline_width_mm` hiç kullanılmaz.
- **Düzeltme:** Normalize hedefini `cutline_width_mm/height_mm` yap (yoksa `label + 2×offset_mm`); tek üniform ölçek `s = min(sx, sy)`; mm-SVG tespitini `width="..mm"` + viewBox eşitliğiyle yap, negatif min koordinat "mm değil" sayılmasın.
- ⚠️ **Önce doğrula:** `save-cutline-edit.ts` / EditorShell save akışının `cutline_designs.svg_url`'e ne yazdığına bak — "sipariş boyutu = kesim boyutu" kasıtlı sözleşme olabilir. `cutline_width_mm`'in DB'de dolu geldiğini teyit et.

### K6. postMessage köprüsünde origin doğrulaması yok + `'*'` hedefi + credential'lı fetch → tasarım dosyası sızdırma vektörü
- **Konum:** `poc.html:2200` (origin kontrolsüz `message` listener), `:2142-2144` (`postMessage(full, '*')`), `:2239-2255` (`pim-request-design-file` dosyayı base64 döner), `:2550-2553` (`credentials: 'include'`)
- **Sorun:** Kötü niyetli sayfa `poc.html?designUrl=/api/...&embed=1` iframe'i açar; auto-load çerezlerle müşteri dosyasını çeker, `pim-request-design-file` ile tamamını base64 geri alır. `pim-upload-file` ile dosya enjeksiyonu da mümkün.
- **Düzeltme:** Listener başında `e.origin` beyaz listesi (kendi origin + bilinen parent origin'ler); `pimPostToParent`'ta `'*'` yerine doğrulanmış parent origin — en azından hassas tipler (`pim-design-file`, `pim-cutline-saved`) için.

### K7. Hata mesajları görünmez: `statusBox` gizli `#infoPanel` içinde — ilk dosyası reddedilen kullanıcı hiçbir şey görmüyor
- **Konum:** `poc.html:1744-1747` (`#infoPanel display:none`), `:6281-6293` (`showStatus`), `:2762-2768, 2877-2886` (erken hatalar)
- **Sorun:** "Dosyan çok büyük", "Desteklenmeyen tip" gibi tüm erken hatalar `statusBox`'a yazılır ama panel ancak ilk başarılı `processImage`'da (`:3972`) görünür olur. Spinner kapanır, ekran boş kalır.
- **Düzeltme:** `showStatus` içinde panel gizliyse görünür yap; veya hataları upload-zone altında her zaman görünür bir banner'a yaz.

### K8. `showStatus`'un 3sn timer'ı `runPreflight`'ı `imageMetadata=null` iken çağırıyor → uncaught TypeError
- **Konum:** `poc.html:6291` (`setTimeout(() => runPreflight(), 3000)`), `:5118-5120` (null guard yok)
- **Düzeltme:** `runPreflight` başına `if (!imageMetadata) return;`; showStatus timer'ını tek değişkende tut, üst üste binmesin.

---

## 🟠 YÜKSEK

### Y5. Worker'da hiçbir compute fonksiyonunda try/finally yok — hata anında tüm Mat'ler sızar
- **Konum:** `pim-cv-worker.js:56-103` (buildMask), `:105-171`, `:271-313`, `:315-354`, `:356-412`; catch `:417-445`
- **Sorun:** `onmessage` catch'i hatayı postlar ama o ana kadar ayrılan `mat`, `mask`, `contours`, `hierarchy`, kernel'lar serbest kalmaz. OOM fırlarsa istek başına 3-8MB WASM heap sızar → kademeli çökme.
- **Düzeltme:** Ayrılan Mat'leri listeye kaydet, `try {...} finally { allocated.forEach(m => m.delete()) }` deseni — en azından `computeCutline`/`computeWhitePlan`/`computeRadialMetrics` giriş noktalarında. (K3 ile aynı PR'da yap.)

### Y6. Dosya yükleme yarışı — jenerasyon token'ı yok; hızlı ardışık yüklemede eski dosya yenisini ezer
- **Konum:** `poc.html:2928-2950` (FileReader+img.onload), `:3128-3136` (selectPdfPage), `:2992-3004` (PSD), `:3855` (processImage)
- **Sorun:** Tüm decode yolları async callback'le bitiyor; A yüklenip hemen B yüklenirse A'nın `onload`'u sonra tetiklenip B'nin state'ini ezebilir. `processImage` da async — iki paralel çalışma `sourceImage`/`currentPaths`/`imageMetadata`'yı karıştırır.
- **Düzeltme:** Global `let pimLoadGeneration = 0;` — `handleFile` başında `const gen = ++pimLoadGeneration;`, tüm async devam noktalarında `if (gen !== pimLoadGeneration) return;`. **Aynı desen şunları da çözer:** Y8b, Y15, O18.

### Y7w. Aynı görüntü için maske defalarca sıfırdan kuruluyor; her istekte tam ImageData kopyası, transferable yok
- **Konum:** Ana thread: `poc.html:2639-2643`, `:4114-4131`, `:4294-4305`, `:3519-3526`; Worker: `pim-cv-worker.js:339-349` (×3 dilate+findContours), `:272`, `:317`, `:358` (her istekte buildMask); yanıt `:420-427`
- **Sorun:** 960×960 RGBA ≈ 3.7MB; cutline + white-plan + radial üçlüsü ana thread'de ~11MB klon (taşımanın amacının tersi). Worker tarafında her istek maskeyi sıfırdan kurar; tek slider hareketi = buildMask + 3 büyük kernel'li dilate + 3 findContours.
- **Düzeltme (kademeli):**
  1. Hızlı kazanım: `postMessage(msg, [imageData.data.buffer])` ile transfer et (her seferinde taze `getImageData` alındığı için detach sorun değil); worker trim yanıtını da `[out.buffer]` ile döndür.
  2. Kalıcı çözüm: `set-image` mesajıyla görüntüyü worker'a BİR KEZ gönder, temizlenmiş maskeyi `imageVersion` anahtarıyla cache'le; ofset ringlerini `cv.distanceTransform` + eşikleme ile tek geçişte üret.

### Y8. Kübik Bézier (`C`/`c`) örneklenmiyor — üretimde kavisler köşeli poligona dönüyor
- **Konum:** `extract-cutline-rings.ts:144-156`
- **Sorun:** 9cbd3c6 `A` komutunu 8 örnekle çözdü ama `C`'yi bıraktı — sadece uç nokta alınıyor. Illustrator/Inkscape bıçak SVG'leri yuvarlatmaları `C` ile yazar. **Fiziksel kesim hatası.**
- **Düzeltme:** Kübik Bézier'i 8-16 t örneğiyle örnekle (kontrol noktaları zaten parse ediliyor, sadece atılıyor) — `sampleSvgEllipticalArc` deseniyle aynı.

### Y8b. `generateWhitePlan`'da job koruması yok — eski worker yanıtı yeni sonucu ezebilir
- **Konum:** `poc.html:4284-4319`; karşılaştır `:4102, 4132` (`pimCutlineComputeJob` deseni)
- **Düzeltme:** Aynı jobId desenini uygula: başta sayaç artır, yanıt geldiğinde sayaç değiştiyse sonucu at.

### Y9. Worker crash → fallback'te `currentMat` stub kaldığı için main-thread fallback ÇALIŞAMIYOR (sessiz ölü durum)
- **Konum:** `poc.html:3926` (stub atama), `:4154` (stub'ta erken return), `:2657-2671`
- **Sorun:** Görüntü worker modunda yüklendiyse `currentMat = {_pimStub:true}`. Oturum ortasında fallback'e geçilirse stub gerçek Mat'e dönüştürülmez; `generateCutlineMainThreadSync` sessizce return eder — UI hata da göstermez.
- **Düzeltme:** Fallback'te main-thread OpenCV hazır olunca `pimPaddedCanvas`'tan `cv.imread` ile `currentMat`'i yeniden kur ve `generateCutline()` tetikle. (K1 ile aynı PR.)

### Y10. Köprü sözleşme testi worker protokolünü hiç çalıştırmıyor
- **Konum:** `scripts/editor-bridge-contract.runner.ts:64-131`
- **Sorun:** Tek senaryo sentetik `bridgeTest=zero-path` hook'u; gerçek `compute-cutline` round-trip, `requestId` eşleşmesi, `cutline-result` şeması, `trim-image`, `worker_error`, 45sn fallback test edilmiyor. Statik denetimler string araması — yanıt tipi adı değişse test yine geçer.
- **Düzeltme:** Küçük PNG fixture ile gerçek worker'ı yükleyip `compute-cutline` yanıt şemasını assert eden senaryo; worker'ı 404'leyerek fallback'in `pim-cutline-auto-failed` ürettiğini doğrulayan senaryo ekle.

### Y11. PDF doküman temizliği yok: `destroy()` çağrılmıyor; raster yüklenince PDF paneli ve `currentPdfDoc` kalıyor
- **Konum:** `poc.html:3030` (eski doc destroy edilmeden üzerine yazılıyor), `:2925-2951` (raster dalı paneli gizlemiyor)
- **Sorun:** (a) Üst üste PDF'te eski `PDFDocumentProxy` belleği birikir. (b) PDF sonrası PNG yüklenirse panel kalır; thumbnail tıklanınca `selectPdfPage` ESKİ PDF'i işleyip yeni PNG'nin üstüne yazar.
- **Düzeltme:** `handleFile` başında `if (currentPdfDoc) { currentPdfDoc.destroy(); currentPdfDoc = null; }` + `pdfPagePanel.style.display='none'`; `handlePdfFile`'da yeni atamadan önce eskiyi destroy et.

### Y12. XSS: PDF'ten gelen spot color isimleri kaçışsız `innerHTML`'e basılıyor
- **Konum:** `poc.html:5046` (metaGrid'e `<code>${n}</code>`), kaynak `:3158-3177`; PSD katman adı `:2995` de aynı
- **Sorun:** Spot renk adları PDF içeriğinden okunur, kaçışsız `innerHTML`'e gömülür. `designUrl` ile üçüncü taraf PDF otomatik yüklenebildiği için `<img onerror=...>` içeren spot adı script çalıştırır.
- **Düzeltme:** Basmadan önce `escapeHtml` (`& < > " '`) uygula. (K6 ile aynı PR.)

### Y13. `selectPdfPage`: megapiksel guard'ı + `img.onerror` yok → dev PDF'te sonsuz spinner
- **Konum:** `poc.html:3103-3136`; aynı eksik PSD img'inde `:3004`
- **Sorun:** DPI 600'de büyük sayfa kanvas limitini aşabilir → `toDataURL` boş döner → `onload` çalışmaz → spinner sonsuz.
- **Düzeltme:** Render öncesi `viewport.width*height`'i `PIM_MAX_MEGAPIXELS`'a karşı kontrol et (aşıyorsa scale düşür); her iki img'e `onerror = () => { hideLoading(); showStatus(...); }` ekle.

### Y14. DPI slider PDF'lerde tutarsız: sayfa yeniden render edilmiyor, mm hesabı bozuluyor
- **Konum:** `poc.html:5822-5835` (slider), `:3106-3108` (render-anı DPI)
- **Sorun:** PDF yükleme anındaki DPI ile rasterize; slider sonradan değişince `widthMm = originalW/dpi*25.4` fiziksel boyut değişmediği halde yanlış değişir; çözünürlük de gerçekte artmaz.
- **Düzeltme:** PDF kaynaklıysa DPI değişiminde `selectPdfPage(currentPageNum)`'ı debounce ile yeniden çağır; veya PDF'lerde mm'yi ilk render DPI'ından sabitle.

### Y15. 45sn timeout sonrası geç gelen `cv-ready` → çifte init, çift auto-load, iki OpenCV kopyası
- **Konum:** `poc.html:2680-2708`, `:2710-2747` (özellikle `:2743-2745` koşulsuz auto-load), `:2702-2704`
- **Sorun:** Fallback main-thread opencv.js yükler; worker sonradan `cv-ready` gönderirse `onOpenCvReady` tekrar koşar → `pimAutoLoadDesign` yeniden fetch + `handleFile` (Y6 yarışıyla birleşir), iki OpenCV bellekte.
- **Düzeltme:** `onOpenCvReady`'ye tek-seferlik guard (`if (pimCvInitDone) return;`); fallback'e geçildiyse geç `cv-ready`'yi yok say + `pimCvWorker.terminate()`.

---

## 🟡 ORTA

### O13. `processImage`'da alpha çift tam-tarama + ölü kod
- **Konum:** `poc.html:3917-3926` (sonucu hiç kullanılmayan `hasAlpha` döngüsü), `:3958-3966` (aynı taramayı ikinci kez yapan IIFE)
- **Düzeltme:** İlk döngünün sonucunu değişkende tut, `imageMetadata.hasAlpha`'da kullan; ikinci `getImageData`'yı sil.

### O14. Trim ve maske alpha eşikleri tutarsız (10 vs 200) → cutline görünür içerikten dar çıkabilir
- **Konum:** `pim-cv-worker.js:234` (trim: alpha>10), `:68` (maske: alpha≥200)
- **Düzeltme:** İki eşiği tek sabite bağla (örn. 128) veya farkı belgelenmiş bilinçli karara sabitle.

### O15. `pimPendingHandleFile` yeni yüklemede temizlenmiyor — kuyruktaki eski PSD yeni dosyayı ezebilir
- **Konum:** `poc.html:2177-2197`, `:2850+`
- **Düzeltme:** `handleFile` başında `pimPendingHandleFile = null;`.

### O16. `runPreflight` yeni path formatlarını (`{kind:'poly'/'arc'}`) tanımıyor → rect modunda coverage hep 0
- **Konum:** `poc.html:5122-5133`; doğru örnek `:5028-5032`
- **Sorun:** `rectToPath` artık nesne döndürüyor; `polygonArea` sessizce 0 döner → tier sınıflaması rect modunda devre dışı.
- **Düzeltme:** Entry tipine bak: `poly` → `entry.points`, `arc` → bbox alanı, düz dizi → mevcut yol.

### O17. Geometri testleri kör noktalı: regresyon runner'ı "ölü kod yolunu" test ediyor; prod fikstürü distorsiyonu maskeliyor
- **Konum:** `editor-export-geometry-regression.runner.ts:28-46`; `editor-export-geometry-prod.runner.ts:14-17` (cut bbox aspect == label aspect)
- **Sorun:** K4, K5, Y8 bu yüzden testlerden geçiyor.
- **Düzeltme:** Prod runner'a ekle: (a) White grubu içeren SVG'de ring sayısı assert'ü, (b) cut bbox ≠ label aspect fikstüründe daire yuvarlaklık assert'ü, (c) `C` komutlu fikstür.

### O18. `selectPdfPage` hızlı ardışık tıklama yarışı — render task iptali yok
- **Konum:** `poc.html:3093-3143`
- **Düzeltme:** Sayfa-seçim jenerasyon sayacı + `img.onload`'da kontrol; önceki `renderTask.cancel()`.

### O19. Zoom >1'de içerik kırpılıyor: `transform-origin:center` + pan yalnız editorShell'de
- **Konum:** `poc.html:1408-1411`, `:3773-3780`, `:5995-6000`
- **Sorun:** Sol/üst taşma scroll ile erişilemez; embed/normal modda pan yok → kullanıcı görselin yarısını göremez.
- **Düzeltme:** `transform-origin: top left` + zoom sonrası scroll ayarı; veya editorShell pan mantığını embed moduna aç.

### O20. `performBackgroundRemoval` eşzamanlılık koruması yalnız buton disabled — postMessage ile yeniden tetiklenebilir
- **Konum:** `poc.html:2283-2286`, `:5440-5528`
- **Düzeltme:** `let bgRemovalInFlight = false;` bayrağı: başta set+erken dön, `finally`'de temizle.

### O21. Her render'da pattern kanvasları yeniden üretiliyor (drag'de her pointermove'da)
- **Konum:** `poc.html:3452-3464` (beyaz plan deseni), `:3808-3821` (damalı zemin); tetik `:5990, 5998`
- **Düzeltme:** Pattern'leri bir kez üret, cache'le; `render()`'ı `requestAnimationFrame` ile coalesce et.

### O22. `pim-request-design-file`: 30MB dosya main thread'de senkron base64 → UI donması
- **Konum:** `poc.html:2239-2255`
- **Düzeltme:** `FileReader.readAsDataURL(currentFile)` kullan, prefix'i kırp.

### O23. `computeRadialMetrics` boşa maske kurulumu + tam piksel döngüsü
- **Konum:** `pim-cv-worker.js:272-279`, `:297-303`
- **Düzeltme:** Önce ucuz `cv.mean(alpha)` kontrolüyle erken çık; radyal max için `cv.findNonZero` kullan.

### O24. `smoothPath` ↔ `chaikinSmoothPath` kod kopyası + smoothness'ın çift geometrik etkisi
- **Konum:** `pim-cv-worker.js:14-31` ↔ `src/lib/editor/chaikin-smooth.ts`; `:156` (approxPolyDP epsilon'u da smoothness'a bağlı)
- **Sorun:** Regresyon testi src kopyasını test eder; worker kopyası sessizce ayrışabilir. Epsilon + Chaikin büzülmesi üst üste binip kapalı eğride alan daraltır.
- **Düzeltme:** Runner'a iki implementasyonun aynı çıktıyı verdiğini doğrulayan test; smoothness→epsilon eşlemesini ayrı sabite çek.

### O25. Hull modunda minArea filtresi yok — tek kirli piksel kümesi bıçağı şişirir
- **Konum:** `pim-cv-worker.js:129-148`
- **Düzeltme:** Hull noktaları toplamadan önce `cv.contourArea(c) >= minArea` filtresi.

### O26. `offsetPx = Math.round(mm × pxPerMm)` kuantizasyonu — düşük scale'de 0.4mm'e varan hata
- **Konum:** `poc.html:4108-4112`
- **Sorun:** 800px cap ile büyük görselde `pxPerMm` ~2.7'ye düşer; 0.3mm tolerans 1px=0.37mm'e yuvarlanır; bleed/safe ayrı ayrı yuvarlanıyor.
- **Düzeltme:** `bleedPx`/`safePx`'i `offsetPx`'e göre kümülatif yuvarla; meta'ya gerçek mm karşılığını yaz (üretim mm'i px'ten değil meta'dan alsın).

---

## 🟢 DÜŞÜK

### D1. Ölü/kullanılmayan blob URL state'leri
- `poc.html:1875-1876` (`bgRemoveBefore/AfterObjectUrl` hiç atanmıyor, yalnız revoke ediliyor), `:5482` (`bgRemovePendingBlobUrl` oluşturulup hiç kullanılmıyor) → üçünü kaldır.

### D2. `PIM_PARAMS` catch fallback'inde alan eksikleri → olası TypeError
- `poc.html:1956-1958` catch nesnesine `layers: []`, `designUrl: null` ekle (`:2732`'de `PIM_PARAMS.layers.length` okunuyor).

### D3. Worker hata yanıtında `type` alanı yok; `requestId`'siz hatalar sessizce düşüyor
- `pim-cv-worker.js:438, 441-444`; `poc.html:2691` → hata yanıtına `type:'error'` ekle; ana thread'de requestId'siz error'u `console.error`'a düşür.

### D4. `buildMask` ölü else dalı + `detectBackgroundColor` küçük görüntüde NaN
- `pim-cv-worker.js:79-86` (matFromImageData hep CV_8UC4 → koşul hep true), `:36` (<10px → `sampleSize=0` → `Math.max(200, NaN)`) → ölü dalı kaldır; `Math.max(1, ...)` tabanı koy.

### D5. Arc parser sıkıştırılmış flag sözdizimini desteklemiyor
- `extract-cutline-rings.ts:93` — SVGO çıktısı `a8 8 0 018 8` gibi paketlenmiş flag'lerde bozulur → `A` komutunda flag'leri tek karakter olarak ayrıştır.

### D6. Eski PDF'in geç gelen thumbnail render'ları detached DOM'a çiziliyor
- `poc.html:3074-3082` → Y11'deki destroy + thumbnail döngüsüne jenerasyon kontrolü.

---

## ❓ Doğrulanması gerekenler (uygulamadan önce test/teyit)

1. **K5'in gerçek üretim etkisi:** `cutline_designs.svg_url`'e hangi akışlar yazıyor? "Sipariş boyutu = kesim boyutu" kasıtlı sözleşme olabilir — `save-cutline-edit.ts` + EditorShell save akışını ve DB'de `cutline_width_mm` doluluk oranını kontrol et.
2. **K3'ün büyüklüğü:** Kullanılan opencv.js build'inde `MatVector.get()` semantiği farklı olabilir — 1000 istekte heap büyümesi ölçen küçük bir test yaz.
3. **`tryDetectCutContour` aşırı geniş eşleşme** (`poc.html:3164-3166`): `includes('CUT')`/`includes('DIE')` — "UNCOATED" gibi isimler yanlış pozitif verebilir; gerçek müşteri PDF'leriyle test et.
4. **Bleed/safe sabitleri:** `poc.html:4111-4112`'deki 2.0mm ile `src/lib/editor/coords`'taki `EDITOR_BLEED_MM/EDITOR_SAFE_MM` aynı mı? Farklıysa önizleme ↔ üretim ayrışır.
5. **`canvas { touch-action: pan-y }`** (`poc.html:452`) mobil Safari'de drag/pinch ile çakışıyor mu — cihazda test.
6. **`pimSetViewZoom` debouncesız tam render** (`poc.html:3765-3767`) — parent slider'ı nasıl gönderiyor, bak.
7. **`pimEmitPocReady` 8×400ms retry** (`poc.html:2618-2622`) — parent "ready" işleyicisi idempotent mi?
8. **`generateCutline` hata dalında `currentPaths` bayat kalıyor** (`poc.html:4135-4140`) — yeni dosya + worker hatası senaryosunda görünürlüğünü test et.

---

## Özet — en acil 5 iş

1. **PR-1 (K1+K2+Y9):** Worker köprüsü — timeout, crash kurtarma, stale render. Worker taşımasının doğrudan regresyonları; kullanıcıya en görünür hatalar.
2. **PR-2 (K3+Y5):** Worker Mat sızıntıları — uzun oturumda kesin OOM.
3. **PR-3 (K4+K5+Y8):** Üretim geometrisi — **fiziksel kesim hatası** üretebilen üç bulgu (önce "Doğrulanacaklar #1" teyidi).
4. **PR-4 (K6+Y12):** Güvenlik — origin + XSS.
5. **PR-5 (Y6 jenerasyon-token deseni):** Tüm yükleme yarışlarını tek desenle kapatır (Y8b, O15, O18 dahil).
