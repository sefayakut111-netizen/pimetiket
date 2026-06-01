# Editör UI/UX Tur 3 — Bulgular (Sefa + Claude canlı teyit, 1 Haz, commit 235f86c)

Sefa 6 yeni sorun. Claude canlıda DOM + console ile doğruladı.

## 1. 🟡 Sayfa sola yapışık — ortala/padding
**Teyit:** Editör grid `left:0`, `360px 1545px` — sol panel ekranın TAM sol kenarında (0px boşluk).
Sayfa container'ı ortalanmamış / sol-sağ padding yok.
**Fix:** Editör root'una yatay padding veya `max-w` + `mx-auto` (örn. `px-4 md:px-6` veya container).
Sol panel kenara yapışmasın, sağ önizleme de simetrik nefes alsın.

## 2. 🟡 Sayfa aşağı kaymıyor (scroll yok) — ama içerik taşıyor
**Teyit:** `bodyScrollH:990` ≈ `viewportH:945`, `overflow-y:visible`. UIUX tur1'de `overflow-hidden` +
`h-[calc(100dvh-56px)]` koyulmuştu — sol panel uzun (Özet'e kadar) ama scroll kilitli, alt bölümler
(Özet/DPI) görünmüyor olabilir. Kullanıcı sol panelin altını göremiyor.
**Fix:** Sol panelin KENDİ içi `overflow-y:auto` olsun (panel scroll'u), sayfa geneli sabit. Veya editör
root `min-h` + sayfa scroll'u serbest. Kullanıcı tüm kontrollere (Özet/DPI) erişebilmeli.

## 3. 🔴 Üstteki kalan bıçak çizgileri okunaksız (legend belirsiz)
**Teyit:** Üst "Renkler:" legend var ama Sefa "okunaklı değil, görsellerde dahil anlaşılmıyor" diyor.
Legend ince/soluk, kesik çizgi örnekleri küçük; magenta/gri/kırmızı/mavi ayrımı net değil.
**Fix:** Legend'i daha okunaklı yap — daha kalın renk örnek çizgileri, net etiketler, yeterli kontrast/font.
Veya legend'i önizleme üstünde değil yanında kompakt rozet grubu yap. (Hangi çizgi ne, bir bakışta anlaşılsın.)

## 4. 🟢 Sağ tarafa AI sohbet alanı — Pim komut/danışma
**Teyit:** Editörde AI yok (önceki tespit). Sefa sağ tarafa sohbet alanı istiyor.
**NOT:** Bu, planladığımız **Pim komut alanı** (`PIM-EDITOR-KOMUT-SPEC.md`) — "EN SON katman" demiştik.
Sefa şimdi istiyor → sıraya alınabilir AMA ayrı/büyük iş (LLM + komut whitelist + ölçü-referans).
**Öneri:** Bu maddeyi AYRI tut (bu görsel-cila turuna katma). Layout'ta sağ sohbet için YER AÇ (3 sütun:
sol kontrol + orta önizleme + sağ Pim), implementasyon ayrı Pim-komut turunda.

## 5. 🔴 Arka plan kaldır ÇALIŞMIYOR — kök neden bulundu (console)
**Teyit (console):** `BG removal hatası: TypeError: Failed to fetch` @ `@imgly/background-removal@1.5.5`
(poc.html:4146 `performBackgroundRemoval`). Modül `esm.run`'dan yükleniyor (import OK) AMA kütüphane
**model dosyalarını (ONNX/WASM) kendi default CDN'inden** (`staticimgly.com`/`unpkg`) çekiyor → o host
CSP `connect-src`'de YOK → fetch bloklanıyor.
**Fix (2 yol):**
- (A) CSP `connect-src`'e imgly model host'unu ekle (`https://staticimgly.com` veya kütüphanenin kullandığı host — network tab'dan kesin host doğrula).
- (B) `removeBackground(file, { publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/dist/' })` ile model'i CSP'de İZİNLİ jsdelivr'a yönlendir. **(B) tercih** — CSP'ye yeni host eklemeden çözer.
**NOT:** `connect-src` zaten jsdelivr+huggingface içeriyor; publicPath'i jsdelivr'a sabitlemek en temizi.

## 6. 🔴 PNG sınırı / gölge alan KALMALI (şu an kayboluyor olabilir)
**Teyit:** Sefa'nın görselinde (karga logo, beyaz arka planlı) kontur PNG'nin DIŞ sınırını (dikdörtgen)
+ figürü gösteriyor; "kesim çizgisi dışında gölge alan = png sınırı, kalmalı" diyor.
**ÇELİŞKİ UYARISI:** Tur 2 madde 5'te `drawPngPageBoundary` (içerik/PNG sınırı) editorShell'de GİZLENDİ.
Sefa şimdi onu GERİ istiyor — ama "gölge alan" olarak (soluk, referans). Yani:
- Tur 2'de "fazla referans çizgisi" → kaldır demişti (boyut + içerik bbox).
- Tur 3'te "PNG sınırı gölge alanı kalmalı" → PNG kenarı GERİ gelsin (ama gölge/soluk, çizgi değil).
**Fix:** PNG sınırını soluk **gölge/overlay** olarak göster (kesik magenta çizgi DEĞİL — açık gri dolgu/gölge).
Kullanıcı PNG'nin gerçek sınırını görsün ama bıçak konturuyla karışmasın. `drawPngPageBoundary`'yi
editorShell'de gölge-stiliyle geri aç (return'ü kaldır, stil değiştir).

---

## ÖZET
| # | Sorun | Önem | Yer |
|---|---|---|---|
| 1 | Sayfa sola yapışık | 🟡 | EditorShell layout (padding/center) |
| 2 | Scroll yok, alt görünmüyor | 🟡 | sol panel overflow-y:auto |
| 3 | Legend okunaksız | 🔴 | EditorPreviewLegend stil |
| 4 | Sağ AI sohbet | 🟢 AYRI İŞ | layout yer aç + Pim-komut turu |
| 5 | BG kaldır çalışmıyor | 🔴 | poc.html publicPath jsdelivr (CSP) |
| 6 | PNG sınırı gölge kalmalı | 🔴 | poc.html drawPngPageBoundary gölge-stili geri |

**ÇELİŞKİ NOTU (önemli):** #6, Tur2 #5 ile çelişiyor — Tur2'de PNG sınırını kaldırttık, Tur3'te gölge
olarak geri isteniyor. Doğru anlam: BOYUT referans çerçevesi (kırmızı-soluk dikdörtgen) GİTSİN (Tur2 doğru),
ama PNG'nin KENDİ sınırı gölge olarak KALSIN (Tur3). İkisi farklı çerçeveler — Cursor'a net ayırt ettir.

**KARAR:** #4 (AI sohbet) ayrı/büyük iş — bu turdan ÇIKAR, layout'ta yer açmakla yetin. #1/2/3/5/6 bu tur.
