# Editör Mimari Değişiklik — POC iframe'e geç (worker'ı bırak)

## NEDEN (Claude canlı debug + Sefa kararı)

`/editor`'ın kendi OpenCV Web Worker'ı 3 fix turuna rağmen ÇALIŞMIYOR. Claude canlıda kesin teşhis etti:
- Worker pattern'i (Module.onRuntimeInitialized) DOĞRU — blob-worker testinde 945ms'de çalışıyor.
- AMA **deploy edilen turbopack-worker mimarisi** `importScripts(OPENCV_JS_URL)`'de takılıyor:
  gerçek worker'a `{type:'init'}` atıldığında **14 saniye HİÇ yanıt yok** (ne ready, ne error) → timeout.
- Kök neden: Next.js/turbopack worker shim + Emscripten `importScripts` uyumsuzluğu (worker chunk
  iki parçaya bölünmüş, `Module` global'i shim'in beklediği anda set olmuyor).

**ÇÖZÜM (Sefa kararı):** Worker'la uğraşmayı BIRAK. `/onay/[orderId]/duzenle/[itemId]` ekranı
`pim_etiket_poc.html`'i **iframe'de** çalıştırıyor ve OpenCV'yi SORUNSUZ yüklüyor (Claude doğruladı).
Editör de aynı KANITLANMIŞ mimariyi kullansın.

## POC ZATEN HAZIR (public/poc.html — kanıt)
- `embed=1` + `standalone=1` modları var (PIM_PARAMS, satır 1836).
- `hideUpload` YOKSA POC kendi upload zone'unu gösterir → kullanıcı iframe içinde dosya yükler.
- postMessage handoff: `pim-cutline-saved` (satır 1990), `pim-poc-ready`, `pim-poc-loaded`, `pim-poc-error`.
- `mode/material/layers/orderWidthMm` URL paramları destekli.
- `build-poc-iframe-src.ts` zaten iframe src builder'ı (onay ekranı kullanıyor) — referans al.

---

## GÖREV 1/3 — Editör sayfasını POC iframe wrapper'ına çevir

#### Dosya: `src/components/editor/EditorShell.tsx` (1326 satır — büyük yeniden yapı)

Mevcut Pikaso/Konva canvas + kendi worker akışını, POC iframe ile değiştir. Onay ekranındaki
(`src/app/onay/[orderId]/duzenle/[itemId]/page.tsx`) iframe entegrasyonunu **referans al** (postMessage
bridge, iframe height, pim-poc-* event handling birebir oradaki gibi).

**Editör iframe src'i** (`build-poc-iframe-src.ts`'i editör için genişlet veya yeni helper):
```
/poc.html?embed=1&standalone=1&mode=contour
```
- **designUrl YOK** (editörde dosya henüz siparişe bağlı değil — kullanıcı iframe İÇİNDE yükler).
- `hideUpload` VERME (POC'un kendi upload zone'u görünsün).
- `material`, `mode` default'ları geçilebilir.

> POC standalone modda kendi upload + bıçak + boyut UI'sını gösterir. EditorShell'in sol/sağ panelleri
> (boyut, offset, katman, malzeme) POC içinde zaten var → EditorShell sadece iframe + üst bar (Sticker/Etiket'e ekle) kalır.

**Doğrulama:** `/editor` → POC iframe yüklenir → kullanıcı dosya yükler → kontur OTOMATİK netleşir (onay ekranı gibi). Console'da worker timeout YOK.

---

## GÖREV 2/3 — Handoff köprüsü: POC postMessage → konfigüratör

#### Dosya: `EditorShell.tsx` + `src/lib/editor/editor-handoff.ts`

POC `pim-cutline-saved` postMessage gönderir (cutline kaydedilince). Editörün mevcut handoff'u
`EditorHandoffPayload` (sessionStorage → /sticker veya /etiket). Bu ikisini köprüle:

1. EditorShell iframe'den `pim-cutline-saved` mesajını dinle (onay ekranındaki listener pattern'i).
   Mesaj payload'u: `{ cutlineId, svgKey, previewKey, source, widthMm, heightMm, ... }` (poc.html:1990 civarı).
2. "Sticker'a ekle" / "Etiket'e ekle" tıklanınca: POC'tan gelen cutline + boyut bilgisini
   `writeEditorHandoff()` ile sessionStorage'a yaz → konfigüratöre yönlendir (mevcut akış).
3. Bıçak türü → ürün önerisi (Dalga 1 CTA) korunur: POC'tan gelen `mode`/şekil bilgisine göre.

> Editör anonim/serbest akış: dosya siparişe bağlı değil. POC standalone'da cutline'ı geçici (temp)
> saklar; handoff konfigüratöre taşır, sipariş sonrası promote (mevcut promoteEditorCutlines) devralır.
> Bu akışın temp saklama tarafını onay ekranı save-edit ile KIYASLA — editör temp eşdeğeri ne, netleştir.

**Doğrulama:** Editörde bıçak yap → "Sticker'a ekle" → konfigüratör açılır, cutline + boyut taşınmış.

---

## GÖREV 3/3 — Eski worker/canvas kodunu temizle (ölü kod)

POC iframe'e geçince şunlar ARTIK KULLANILMIYOR — kaldır veya `@deprecated` işaretle:
- `src/lib/editor/cutline/contour.worker.ts` + `contour-worker-client.ts` + `contour-opencv-algorithms.ts` + `opencv-loader.ts` + `opencv-types.ts`
- `src/components/editor/PikasoEditorCanvas.tsx` (Pikaso canvas)
- `src/lib/editor/pikaso/**` (usePikasoEditor, render-cutline, blade-transform vb.)
- `src/lib/editor/cutline/compute.ts`, `contour.ts`, `alpha-contour.ts` (eğer başka yer kullanmıyorsa)

> DİKKAT: Önce `grep` ile bu modüllerin BAŞKA yerde (onay ekranı, proof akışı) kullanılıp kullanılmadığını
> kontrol et. Onay ekranı POC iframe kullanıyor (worker DEĞİL) ama `alpha-contour`/`compute` proof
> tarafında kullanılıyor OLABİLİR. Kullanılan modülleri SİLME — sadece editörün worker'ını bırak.
> Emin değilsen `@deprecated` yorumu ekle, silme. tsc + build kırılmamalı.

**Doğrulama:** `npx tsc --noEmit` 0 hata; `/editor` + `/onay/duzenle` + proof akışı çalışır.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)

1. `rm -rf .next/dev/types` + `npx tsc --noEmit` → 0 hata (kalırsa push etme).
2. `git add -A`
3. `git commit -m "refactor(editor): POC iframe mimarisine gec — kendi OpenCV worker'i birak (turbopack uyumsuzlugu)"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. Bu, editör kontur sorununun KESİN çözümü — kanıtlanmış POC mimarisine geçiş.
> Claude canlıda test edecek: `/editor` → dosya yükle → kontur netleşiyor mu (onay ekranı gibi).
> Bu BÜYÜK bir refactor — EditorShell 1326 satır. Dalga 1 fix'leri (ürün CTA, döndür, köşe slider)
> POC içinde zaten var; kaybolmamalı. Emin olmadığın yerde Claude'a sor, körlemesine silme.
