# Editör UI/UX Tur 3 — Layout + sonsuz zemin + bg-removal fix

Sefa 5 görsel/işlev sorunu (AI sohbet AYRI prompt'ta). Claude canlıda DOM+console doğruladı:
`docs/EDITOR-UIUX-TUR3-BULGULAR.md`. Kontur motoru ÇALIŞIYOR — dokunma.

> POC iframe kontur motorunu BOZMA. EditorShell.tsx (layout) + EditorPreviewLegend + poc.html (canvas zemin + bg-removal).
> Migration YOK. AI sohbet bu turda DEĞİL — ama Görev 6'da layout'ta sağ sohbet için YER aç (3 sütun).

---

## GÖREV 1 — Sayfa sola yapışık → ortala/padding [P1]
**Teyit:** Editör grid `left:0`, sol panel ekran kenarına yapışık (0px boşluk).
**Fix:** Editör root'una yatay padding (`px-4 md:px-6 lg:px-8`) veya `max-w-[1600px] mx-auto`. Sol panel
kenara yapışmasın; sağ önizleme de simetrik nefes alsın.
**Doğrulama:** Sol panel ile ekran kenarı arası boşluk var; içerik ortalı/dengeli.

## GÖREV 2 — Sol panel scroll'u (alt bölümler erişilemiyor) [P1]
**Teyit:** `overflow-y:visible`, sayfa scroll kilitli ama sol panel uzun (Özet/DPI altta). Kullanıcı sol
panelin altını göremiyor.
**Fix:** Sol kontrol sütununa `overflow-y:auto` + `max-h-[calc(100vh-header)]` ver (panelin KENDİ scroll'u).
Sağ önizleme sabit. Tüm kontroller (Özet/DPI dahil) erişilebilir olsun.
**Doğrulama:** Sol panel kendi içinde scroll olur; Özet/DPI'ya erişilir; sağ önizleme kaymaz.

## GÖREV 3 — Renk legend okunaksız → netleştir [P1]
**Teyit:** Üst "Renkler:" legend ince/soluk, kesik çizgi örnekleri küçük, ayrım belirsiz (Sefa: görsellerde de okunaksız).
**Fix:** EditorPreviewLegend'i okunaklı yap: daha kalın/net renk örnek çizgileri (örn. 24px kesik segment),
net etiketler, yeterli kontrast + font (≥13px medium). Her renk ne demek bir bakışta anlaşılsın
(magenta=Bıçak, gri=Beyaz plan, kırmızı=Bleed, mavi=Safe). Gerekirse kompakt rozet grubu.
**Doğrulama:** Legend net okunur; her çizgi-renk anlaşılır.

## GÖREV 4 — Arka plan kaldır ÇALIŞMIYOR → publicPath fix 🔴 [P0]
**Teyit (console):** `BG removal hatası: TypeError: Failed to fetch @ @imgly/background-removal@1.5.5`
(poc.html:4146). Kütüphane model dosyalarını (ONNX/WASM) default CDN'inden çekiyor → CSP `connect-src`'de
o host YOK → bloklanıyor. (CSP'de jsdelivr+huggingface VAR, imgly'nin default host'u yok.)
#### `poc.html` `performBackgroundRemoval` (~satır 4146)
**Fix:** `removeBackground(currentFile, { ... })` çağrısına `publicPath` ekle — model'i CSP'de İZİNLİ
jsdelivr'a yönlendir:
```js
const blob = await removeBackground(currentFile, {
  publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/dist/',
  progress: (key, current, total) => { ... }  // mevcut progress kalsın
});
```
> Kesin model yolu: jsdelivr'da `@imgly/background-removal@1.5.5/dist/` altında model var mı doğrula
> (network tab veya jsdelivr dizini). Yoksa CSP `connect-src`'e imgly'nin gerçek host'unu ekle (network'ten
> "Failed to fetch" giden URL'i bul). publicPath tercih — CSP'ye dokunmadan çözer.
**Doğrulama:** Beyaz arka planlı görsel → "AI ile arka planı kaldır" → arka plan kalkar (Failed to fetch yok).

## GÖREV 5 — Sonsuz düzlem zemin (PNG dışı sınırlı alan KALKSIN) 🔴 [P0]
**Teyit (Claude canlı):** canvas 560×460 AMA önizleme alanı (iframe body) 1511×536. Canvas görsel boyutuna
SABİT → önizlemenin ortasında küçük dikdörtgen, etrafı boş = "PNG dışında sınırlı alan" (Sefa istemiyor).
**Sefa istediği:** Sonsuz düzlem — zemin (checkerboard) TÜM önizleme alanını doldursun, görsel onun içinde
yüzsün; PNG'nin kenarı/sınırı belli olmasın.
#### `poc.html` canvas/wrap render
**Fix:** Canvas'ı (veya checkerboard zemini) önizleme alanının TAMAMINA yay (560px sabit değil →
`width:100%` veya iframe body boyutu). Görsel + bıçak konturu zeminin içinde konumlansın, zemin kenarsız
(sonsuz) görünsün. PNG sınır dikdörtgeni / sayfa-alanı çizimi OLMASIN — sadece görsel + kontur + checkerboard.
> editorShell modunda canvas wrap'i tam-alan yap. Onay ekranı (/onay) etkilenmesin (editorShell koşulu).
**Doğrulama:** Önizleme tüm alanı kaplayan checkerboard zemin; görsel ortada yüzer; PNG dışında sınırlı kutu YOK.

## GÖREV 6 — Layout'ta sağ AI sohbet için YER AÇ (implementasyon ayrı tur)
AI sohbet ayrı prompt'ta yapılacak (`CURSOR-PROMPT-EDITOR-PIM-SOHBET.md`). Bu turda SADECE layout'u 3 sütuna
hazırla: **sol kontrol (360px) + orta önizleme (1fr) + sağ Pim sohbet (320px, şimdilik boş placeholder/gizli)**.
Grid'i `grid-cols-[360px_1fr_320px]` yapısına uygun kur ki AI turu sadece sağ sütunu doldursun.
> Sağ sütun şimdilik boş veya "Pim yakında" placeholder — implementasyon AI turunda. Layout hazır olsun.
**Doğrulama:** 3 sütunlu grid; sağ sütun yer tutuyor (boş/placeholder); sol+orta düzgün.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)
1. `rm -rf .next/dev/types` + `npx tsc --noEmit` → 0 hata.
2. `git add -A`
3. `git commit -m "fix(editor-uiux3): layout ortala+padding + sol panel scroll + legend okunakli + bg-removal publicPath + sonsuz zemin + AI sutun yer"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. Görev 4 (bg-removal) + Görev 5 (sonsuz zemin) = P0. Onay ekranı (/onay)
> editorShell koşuluyla korunsun. Claude canlıda test edecek: padding + panel scroll + legend + bg-kaldır
> çalışıyor + sonsuz zemin + 3-sütun layout.
