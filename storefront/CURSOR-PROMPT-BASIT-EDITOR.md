# Basit Bıçak/Baskı Editörü — `/editor` (Pre-Order, Üye-Only)

## AMAÇ
Üyelere açık, **tasarım aracı OLMAYAN** sade bir editör. Kullanıcı 4 işlem yapar:
1. **Hazır bıçak seç** (65 die-cut şablon) veya görselden otomatik bıçak
2. **Ebatlandır** (genişlik/yükseklik mm)
3. **Arka planı kaldır** (varsa)
4. **Ürüne ekle** → Sticker/Etiket konfigüratörüne taşı → sepet → öde → baskı

**Kurallar (Sefa, 31 May):**
- Editöre **sadece üyeler** erişir (anonim → `/auth?next=/editor`).
- Editörde **İNDİRME YOK** — hiçbir adımda export/indir butonu. Çıktı yalnızca siparişe akar.
- Editör tasarım/çizim aracı değil; yukarıdaki 4 işlemle sınırlı.
- Final onay + baskı **mevcut akışta** olur (sipariş → /onay → finalize). Editör bu akışı beslemekle görevli;
  editörde hazırlanan bıçak + görsel + ölçü siparişe taşınır, /onay'da hazır gelir.

## FAZLAMA
- **Bu prompt = FAZ 1:** Temiz React kabuğu (üye kapısı, 5 adım stepper, "ürüne ekle" entegrasyonu) +
  çizim çekirdeği olarak **mevcut POC** (`public/poc.html`) yeni bir **standalone (pre-order) modda**.
  POC'un karmaşıklığı (white-plan/tier/DPI/smoothness/AI-yorum/indirme) kullanıcıdan gizlenir.
- **FAZ 2 (AYRI prompt, sonra):** POC çizim motorunu native React `<CutlineEditor>` bileşenine port et;
  aynı bileşen /onay'daki (post-order) iframe'in yerine de geçer. **Bu promptta YAPMA.**

## MİMARİ KARARLAR (uygula, değiştirme)
1. Editör pre-order: sipariş henüz YOK. POC'un mevcut embed modu order'a bağlı
   (`orderId`/`itemId` + `/api/orders/[id]/proof/[itemId]/save-edit`). Pre-order için POC'a
   **`standalone=1` modu** eklenecek: order yok, save `/api/editor/save`'e gider.
2. Çıkışın siparişe taşınması, mevcut **reprint deseni** ile birebir: `sessionStorage` + configurator
   `?...=1` flag'i (referans: `src/app/tasarimlarim/page.tsx` `handleReprint`).
3. Editörde üretilen **cutline** sipariş kalemine taşınır (`order_items.meta.editor_cutline_draft_id`);
   sipariş oluşunca /onay bu cutline'ı başlangıç draft'ı olarak kullanır (yeniden üretmez).
4. Yeniden kullan: `DesignDropZone`, `lib/proof/background-detect.ts` + `background-remove.ts`,
   `lib/proof/save-cutline-edit.ts` (R2 SVG upload), `lib/storage` temp design akışı, `die-cut-templates.ts`.
5. CLAUDE.md sefaRules geçerli: cüzdan/puan/üyelik indirimi yok.

---

## ÇÖZÜM — 8 GÖREV

> ÖN OKUMA (zorunlu): `public/poc.html` içinde embed modu, query param okuma, `postMessage` protokolü
> ve `buildCutlineSvg`'i bul. `src/lib/proof/build-poc-iframe-src.ts` mevcut param setini gösterir.
> `src/app/onay/[orderId]/duzenle/[itemId]/page.tsx` POC'u nasıl mount edip postMessage dinlediğini gösterir.
> `src/app/api/orders/[id]/proof/[itemId]/save-edit/route.ts` save payload şemasıdır (taban alınacak).

---

### GÖREV 1/8 — Üye kapısı + rota iskeleti

#### Yeni dosya: `src/app/editor/page.tsx`
- Server Component guard: `createClient()` → `getUser()`; yoksa `redirect("/auth?next=/editor")`.
- Üye ise client `<EditorShell />` render et.

#### Yeni dosya: `src/app/editor/layout.tsx`
- Metadata: `title: "Editör — Bıçak & Baskı Hazırlama"`, `robots: { index: false }` (üyelere özel, SEO'suz).

#### Header
- `src/components/layout/TopBar.tsx` → `navItems`: **sadece `user` varsa** `{ href: "/editor", label: "Editör" }`
  ekle (Panelim gibi koşullu). i18n: `tr.ts`/`en.ts` `nav.editor`, `types.ts`'e `editor: string`.

**Doğrulama:** Anonim `/editor` → `/auth?next=/editor`. Üye → editör. Header'da link sadece üyede görünür.

---

### GÖREV 2/8 — Editör kabuğu (5 adımlı stepper, native UX)

#### Yeni dosya: `src/components/editor/EditorShell.tsx` (`"use client"`)
Temiz, sade UX — POC'un görünümü değil, native shell. Üstte `Stepper` (mevcut `@/components/Stepper` veya `ui`).
Adımlar:
1. **Görsel yükle** — `DesignDropZone` (PNG/JPG/PDF/AI/PSD). Yükleme `/api/design/upload-init` + complete
   zinciri ile **temp design** üretir (mevcut configurator upload deseniyle aynı; `UPLOAD_CHAIN_ENDPOINTS`).
2. **Bıçak seç** — iki sekme: **Hazır şablon** (65 kart, `die-cut-templates.ts` + `ShapePreview`) /
   **Görselden otomatik** (POC contour). Seçim POC'a `postMessage` ile bildirilir (bkz. Görev 4).
3. **Ebatlandır** — genişlik/yükseklik mm input + oran kilidi toggle. Değer POC'a iletilir (canlı 1:1).
4. **Arka plan** — `background-detect` sonucu; "Arka planı kaldır" tek buton → `/api/editor/bg-remove`
   (Görev 6). Önce/sonra önizleme.
5. **Önizle & İleri** — sonuç önizlemesi + **"Ürüne ekle"** (Görev 7). **İndirme butonu YOK.**

Orta/sağ alan: `<EditorCanvas />` (POC iframe, Görev 3-4). Sol: adım paneli. Mobilde stepper üstte, canvas altta.

**Doğrulama:** 5 adım gezilebilir; her adım POC'a doğru mesajı geçer; hiçbir yerde indir/export yok.

---

### GÖREV 3/8 — POC standalone (pre-order) modu

#### Dosya: `public/poc.html`
Mevcut embed modunu (`embed=1`) bozmadan **`standalone=1`** modu ekle:
- `standalone=1` iken: order yok. Upload paneli **görünür** (kullanıcı kendi görselini yükler).
- Gizle: white-plan modları, tier göstergesi, DPI slider, smoothness slider, AI-yorum kutusu,
  **SVG export / indir** butonları. (Embed modundaki gizleme mantığını genişlet.)
- Ölçü: order'dan değil, parent'tan gelen `widthMm`/`heightMm` mesajıyla (Görev 4).
- **Kaydet** aksiyonu: order endpoint'i yerine `postMessage({ type: 'pim-editor-saved', svg, preview_png_base64, meta })`
  gönderir; gerçek persist'i parent (React) `/api/editor/save` ile yapar (Görev 5). POC fetch ATMAZ standalone'da.

#### Yeni dosya: `src/lib/editor/build-editor-iframe-src.ts`
`build-poc-iframe-src.ts`'i taban al; pre-order versiyonu:
```typescript
export function buildEditorIframeSrc(args: {
  designUrl: string;        // temp design signed/proxy URL
  fileName: string;
  mimeType: string;
  widthMm?: number;
  heightMm?: number;
  origin: string;
}): string {
  const p = new URLSearchParams({
    standalone: "1",
    designUrl: args.designUrl,
    designName: args.fileName,
    designMime: args.mimeType,
    mode: "contour",
    hideUpload: "0",     // standalone'da upload görünür
  });
  if (args.widthMm) p.set("orderWidthMm", String(args.widthMm));
  if (args.heightMm) p.set("orderHeightMm", String(args.heightMm));
  return `/poc.html?${p.toString()}`;
}
```

**Doğrulama:** `/poc.html?standalone=1` açıldığında karmaşık kontroller + indir gizli; sadece bıçak modu,
offset, arka plan, kaydet görünür. Embed modu (mevcut /onay) etkilenmez.

---

### GÖREV 4/8 — Canvas bileşeni + postMessage köprüsü

#### Yeni dosya: `src/components/editor/EditorCanvas.tsx` (`"use client"`)
`onay/.../duzenle` sayfasındaki iframe + postMessage dinleyici desenini taban al.
- `buildEditorIframeSrc(...)` ile iframe `src`.
- Parent → POC mesajları: bıçak şablonu seçimi (`{type:'pim-editor-set-shape', shape, widthMm, heightMm, cornerRadiusMm}`),
  ebat değişimi (`{type:'pim-editor-set-size', widthMm, heightMm}`), mod (`contour|rect|circle`).
- POC → Parent: `pim-editor-saved` (svg + preview + meta) → `onSaved(payload)` callback.
- `origin` kontrolü yap (security): sadece same-origin mesajları kabul et.

> Hazır şablon → şekil: `die-cut-templates.ts`'teki `shape`/`widthMm`/`heightMm`/`cornerRadiusMm` POC'a
> geçirilir; POC bu geometriden cutline path üretir (rect/circle/ellipse). POC'ta bu mesajı işleyen
> handler ekle (Görev 3 ile birlikte).

**Doğrulama:** Hazır "Yuvarlak Ø50" seç → canvas'ta 50mm daire bıçak; ebatı 60'a çek → canlı büyür.

---

### GÖREV 5/8 — `/api/editor/save` (üye, pre-order persist)

#### Yeni dosya: `src/app/api/editor/save/route.ts`
`save-edit/route.ts`'i taban al ama order'sız:
- `runtime = "nodejs"`. `getUser()` zorunlu (yoksa 401).
- Body (zod): `{ tempDesignId, svg, preview_png_base64?, mode, offset_mm, width_mm, height_mm, source }`.
- SVG → R2: `editor-drafts/{userId}/{tempDesignId}/{ts}.svg` (yeni key builder, `buckets.ts`'e ekle).
- Preview PNG → R2 (opsiyonel, 1MB sınır).
- `cutline_designs` INSERT: `status='editor_draft'`, `user_id`, `order_id=null`, `meta` (width/height/mode/offset).
  > `cutline_designs.order_id` NULL kabul ediyor mu kontrol et; etmiyorsa migration GEREKMEDEN
  > `editor_cutline_drafts` adlı küçük tablo kullan (id, user_id, temp_design_id, svg_key, preview_key,
  > width_mm, height_mm, created_at). Şema kararını CLAUDE.md'ye göre ver — yeni tablo migration ile.
- Rate limit: `editor-save:${user.id}` dakikada 20.
- Response: `{ draftId, svgKey, previewUrl }`.

**Doğrulama:** Üye kaydeder → `editor_cutline_drafts`/`cutline_designs` satırı + R2'de SVG. Anonim → 401.

---

### GÖREV 6/8 — `/api/editor/bg-remove` (arka plan kaldırma, pre-order)

#### Yeni dosya: `src/app/api/editor/bg-remove/route.ts`
- `getUser()` zorunlu. Body: `{ tempDesignId }`.
- Temp design'ı oku → `detectBackground` (zaten yapıldıysa atla) → `removeBackground()`
  (`lib/proof/background-remove.ts`) → çıktı PNG'yi **yeni temp design** olarak yaz (orijinali koru).
- Response: `{ newTempDesignId, previewUrl, method }`.
- Replicate maliyeti var (~$0.002-0.005); rate limit `editor-bg:${user.id}` dakikada 10.

**Doğrulama:** Beyaz/şeffaf zeminli görselde arka plan kalkar, yeni önizleme döner. Editör canvas yeni
görsele geçer.

---

### GÖREV 7/8 — "Ürüne ekle" → configurator handoff

#### EditorShell son adım
"Ürüne ekle" → küçük seçim: **Sticker** / **Etiket**. Seçince:
1. `/api/editor/save` çağrılıp `draftId` alınmışsa onu kullan; yoksa önce kaydet.
2. `sessionStorage["pim_editor_design"]` yaz (reprint deseni + cutline):
   ```json
   {
     "tempId": "<tempDesignId>",
     "previewUrl": "...",
     "fileName": "...",
     "mimeType": "...",
     "sizeBytes": 0,
     "editorCutlineDraftId": "<draftId>",
     "widthMm": 50,
     "heightMm": 50
   }
   ```
3. `router.push(product === "etiket" ? "/etiket/yapilandir?from=editor" : "/sticker/yapilandir?from=editor")`.

#### Configurator entegrasyonu
- `src/app/etiket/yapilandir/page.tsx` ve `src/app/sticker/yapilandir/page.tsx`:
  - `?from=editor` flag'inde `sessionStorage["pim_editor_design"]`'i oku (mevcut `?reprint=1` +
    `pim_reprint_design` okuma mantığını taban al — muhtemelen ortak bir hook'a çıkarılabilir).
  - **Tasarımı ön-bağla** (reprint ile aynı: tempId + previewUrl).
  - **Ölçüyü ön-doldur** (`widthMm`/`heightMm`) — düzenlenebilir kalsın.
  - `editorCutlineDraftId`'yi sepete/sipariş kalemine taşı (Görev 8).

**Doğrulama:** Editörde Yuvarlak Ø50 + görsel + arka plan kaldır → "Ürüne ekle" → Sticker → konfigüratör
50×50 ön-dolu, görsel bağlı, "editörden geldi" durumu.

---

### GÖREV 8/8 — Cutline'ı siparişe taşı (pipeline adopsiyonu)

Editörde hazırlanan bıçak, sipariş oluşunca /onay'da **yeniden üretilmeden** başlangıç draft'ı olsun.
- Sepete eklemede `editorCutlineDraftId` kalem `meta`'sına yaz (`customer-cart.ts` item meta + checkout body).
- `/api/payment/callback` (veya order oluşturma) sonrası, `promoteOrderDesigns` benzeri bir adımda:
  `meta.editor_cutline_draft_id` varsa → `editor_cutline_drafts`/`cutline_designs` SVG'sini
  `saveCutlineEdit()` ile o order_item'a **draft** olarak bağla (status='draft', source='editor').
  Böylece /onay açılınca cutline hazır gelir; kullanıcı sadece onaylar → finalize → baskı.
- Editör cutline'ı yoksa mevcut otomatik pipeline aynen çalışır (regresyon yok).

**Doğrulama:** Editörden hazırlanan sticker sipariş edilip ödendiğinde, /onay'da editör bıçağı draft olarak
görünür (otomatik bounding-box değil). Onayla → ready_to_ship.

---

## GENEL DOĞRULAMA
1. `npm run lint` + `tsc --noEmit` temiz.
2. Anonim `/editor` → `/auth?next=/editor`. Üye → 5 adım editör, hiçbir yerde indirme yok.
3. Hazır bıçak + ebat + arka plan kaldır → "Ürüne ekle" → konfigüratör ön-dolu → sepet → (test) ödeme → /onay'da editör bıçağı.
4. Mevcut /onay (post-order) iframe editörü ve reprint akışı BOZULMADI.
5. Header "Editör" linki sadece üyede.

## YENİ / DEĞİŞECEK DOSYALAR
**Yeni:** `src/app/editor/page.tsx`, `layout.tsx`; `src/components/editor/EditorShell.tsx`, `EditorCanvas.tsx`;
`src/lib/editor/build-editor-iframe-src.ts`; `src/app/api/editor/save/route.ts`, `bg-remove/route.ts`;
(gerekirse) `supabase/migrations/NNN_editor_cutline_drafts.sql`.
**Düzenlenecek:** `public/poc.html` (standalone mod); `src/app/etiket/yapilandir/page.tsx`,
`src/app/sticker/yapilandir/page.tsx` (from=editor); `src/lib/customer-cart.ts` + checkout (cutline draft meta);
`/api/payment/callback` (cutline adopsiyonu); `src/components/layout/TopBar.tsx` + i18n (`nav.editor`);
`src/lib/storage/buckets.ts` (editor-drafts key).

## FAZ 2 (BU PROMPTTA DEĞİL — sonra)
POC çizim motorunu native React `<CutlineEditor>`'a port et (canvas ref + OpenCV/worker + temiz UX),
`/editor` ve `/onay` aynı bileşeni kullansın, iframe kalksın.
</content>
