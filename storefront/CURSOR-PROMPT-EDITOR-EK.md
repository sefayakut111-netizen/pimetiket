# Editör — Ek İşler (şablon erişimi + kesim rengi notu)

> Bu, `/editor` (CURSOR-PROMPT-BASIT-EDITOR.md, Faz 1) üzerine 2 küçük eklemedir.
> NOT: Editörün "Bıçak seç" adımı ZATEN `DIE_CUT_TEMPLATES`'i (65 şablon) kategori filtresi +
> `ShapePreview` ile kullanıyor (`src/components/editor/EditorShell.tsx`). Yani şablonlar editörde
> seçilebiliyor — bu prompt erişimi **iki yönlü** yapar ve kesim rengi notu ekler.

---

## GÖREV 1/3 — /sablonlar → editör girişi ("Editörde kullan")

`src/components/templates/KesimSablonlari.tsx` — her kesim şablonu kartına, mevcut indirme
butonlarının yanına bir **"Editörde kullan"** butonu ekle:
- Tıklayınca → `router.push(\`/editor?sablon=${tpl.id}\`)`.
- Üyelik gerekmez (yönlendirme /editor'da zaten üye kapısına takılır — anonim → /auth?next=/editor%3Fsablon%3D...).
- Buton stili ikincil (secondary), indirme butonlarını gölgede bırakmasın.

**Doğrulama:** /sablonlar kesim sekmesinde bir kartta "Editörde kullan" → /editor o şekille açılır.

---

## GÖREV 2/3 — Editör: `?sablon=<id>` ile şablon ön-seçimi

`src/app/editor/page.tsx` + `src/components/editor/EditorShell.tsx`:
- URL'de `?sablon=<id>` varsa (`useSearchParams`), `DIE_CUT_BY_ID.get(id)` ile şablonu bul.
- Geçerliyse: "Bıçak seç" adımında **Hazır şablon** sekmesi açık + o şablon **ön-seçili** (selected state),
  ve `postMessage({ type:'pim-editor-set-shape', shape, widthMm, heightMm, cornerRadiusMm })` ile
  POC'a otomatik geçir. Kullanıcı görseli yükledikten sonra bıçak hazır gelsin.
- Geçersiz/boş id → normal akış (regresyon yok).
- Ayrıca editörün "Hazır şablon" sekmesinin altına **"Tüm kesim şablonlarını gör"** linki → `/sablonlar?tab=kesim`
  (yeni sekmede). Böylece editörden tüm kütüphaneye erişim olur.

> `useSearchParams` Suspense gerektirir — EditorShell zaten client; gerekiyorsa Suspense ile sarmala
> (page.tsx'te mevcut desen).

**Doğrulama:** `/editor?sablon=yuvarlak-cap50` → "Hazır şablon" açık, Ø50 daire ön-seçili ve canvas'ta
hazır. "Tüm kesim şablonlarını gör" → /sablonlar?tab=kesim.

---

## GÖREV 3/3 — Editörde kesim rengi notu (bilgilendirme)

Editörde, "Bıçak seç" adımında (veya önizleme yanında) küçük bir **bilgi notu/açılır kutu** ekle —
kullanıcı kesim çizgisi renklerinin ne anlama geldiğini ve nerede kullanıldığını görsün.
Metinleri `die-cut-templates.ts`'teki `CUT_SET_META` açıklamalarından al (tek kaynak):

```
Kesim çizgisi renkleri ne demek?
🟣 Magenta çizgi — KissCut / Kontur (spot: CutContour)
   Yarım kesim: sadece etiket katmanı kesilir, arka kağıt (liner) bütün kalır.
   Nerede: sticker ve soyularak çıkan etiketler.
🔵 Mavi çizgi — ThruCut (Tam kesim)
   Tam kesim: kağıt boydan boya kesilir, parça tamamen ayrılır.
   Nerede: kartela, askılı etiket, ayrı parça olarak verilen ürünler.
```

- `<details>`/açılır kutu veya `InfoTooltip` (`@/components/ui`) ile sade tut; ekranı doldurmasın.
- Renk örnekleri için küçük renkli nokta (magenta `#E5007E`, mavi `#0047FF` — `CUT_SET_META[*].color`).

**Doğrulama:** Editörde renk notu görünür; magenta = kontur/yarım kesim, mavi = tam kesim açıklaması doğru.

---

## GENEL DOĞRULAMA
1. `tsc --noEmit` temiz.
2. /sablonlar kartı → "Editörde kullan" → /editor şablon ön-seçili.
3. /editor'dan "Tüm kesim şablonları" → /sablonlar?tab=kesim.
4. Editörde kesim rengi notu doğru ve sade.
5. Mevcut editör akışı (upload, otomatik bıçak, ürüne ekle) bozulmadı.

## DEĞİŞECEK DOSYALAR
`src/components/templates/KesimSablonlari.tsx` (Editörde kullan butonu),
`src/app/editor/page.tsx` + `src/components/editor/EditorShell.tsx` (?sablon ön-seçim + tüm şablonlar linki + renk notu).
</content>
