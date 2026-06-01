# Editör UI/UX — Dış paneli sadeleştir + iframe senkronu

Claude canlıda gezdi (pimetiket.com/editor), UI/UX bulguları: `docs/EDITOR-UIUX-BULGULAR.md`.
Kontur ARTIK çalışıyor (POC iframe). Sorun: **dış React panel + iç POC iframe senkron değil + çakışıyor.**
Sefa kararı: **dış paneli sadeleştir** — çakışan kontrolleri kaldır, POC iframe zaten yapıyor.

## KRİTİK BULGU (Claude canlı DOM teyidi — körlemesine kaldırma!)
- iframe `pim-standalone-restricted` modunda → POC'un boyut/malzeme/katman panelleri **CSS ile GİZLİ**.
- iframe içinde: 4 malzeme + 4 katman toggle VAR ama gizli; boyut number input YOK (0).
- Dış panelde: malzeme/katman/kesim/ayarlar/analiz blokları VAR ama bazıları okuma-only / çakışıyor.
- **Boyut girişi ŞU AN NE DIŞTA NE İÇTE düzenlenebilir** (dış okuma-only, iç gizli). Bu kapatılacak P0.

> Yani "dış paneli sadeleştir" = çakışan/ölü kontrolleri kaldır + boyut girişini TEK yerde GERÇEKTEN çalışır yap.
> POC iframe'i bozma (kontur çalışıyor). Dış React kabuğunu (EditorShell ~420 satır) düzenle.

---

## GÖREV 1 — Çelişkili durum mesajını düzelt [P0.1]
Analiz paneli "Bıçak çizgisi üretilemedi. Görüntüyü kontrol edin." gösteriyor AMA kontur ekranda düzgün var.
Durum state'i iframe'in gerçek durumuyla senkron değil.
**Fix:** iframe'den `pim-cutline-saved`/`pim-poc-loaded` (kontur başarı) mesajı gelince durum state'ini
"hazır"a çek. POC kontur ürettiğinde başarı postMessage'ı atıyor mu kontrol et (poc.html `pim-cutline-saved`);
atıyorsa dış panel onu dinleyip kırmızı uyarıyı kaldırsın. Kontur YOKKEN (gerçekten üretilemedi) uyarı kalsın.
**Doğrulama:** Görsel yükle → kontur belirince kırmızı uyarı KAYBOLUR.

## GÖREV 2 — Boyut girişi: TEK yerde gerçek input [P0.2]
Kullanıcı baskı ölçüsünü (mm) ayarlayamıyor — editörün temel işi (ebatlandırma). İki seçenek, (A) tercih:
**(A) Dış panele gerçek Genişlik/Yükseklik mm input** (oran kilidi ile) → değişince iframe'e postMessage
(`pim-editor-set-size` veya POC'un mevcut size mesajı). POC `orderWidthMm/orderHeightMm` paramını + runtime
mesajını zaten destekliyor (build-poc-iframe-src.ts). Analiz'deki okuma-only "Baskı boyutu" → bu input'tan beslensin.
**(B) Alternatif:** iframe'i `standalone-restricted` yerine boyut panelini açan moda al (POC placement paneli).
> (A) öner: dış panelde net 2 input + oran kilidi, iframe'e postMessage. Konfigüratördeki boyut UI pattern'ini referans al.
**Doğrulama:** Dış panelde 50→80mm yaz → iframe önizleme + kontur o boyuta güncellenir; Analiz "Baskı boyutu" 80 gösterir.

## GÖREV 3 — Çakışan/ölü kontrolleri kaldır [P1.7, P1.8, P2.9, P2.10]
Dış panelde POC iframe'in ZATEN yaptığı + senkron OLMAYAN kontrolleri SADELEŞTİR:
- **Malzeme tipi** (dış panel) — iframe'de 4 malzeme var (gizli). Karar: malzemeyi TEK yerde tut. Müşteri
  editöründe malzeme önemliyse dış panelde bırak + iframe'e postMessage; değilse kaldır (konfigüratörde seçilir).
- **Katman toggle'ları** (Bıçak/Beyaz/Bleed/Safe) — gerçekten iframe'e gidiyor mu TEST et. Gitmiyorsa ya bağla
  (postMessage) ya kaldır. Ölü toggle bırakma.
- **Kesim mesafesi / Yumuşatma slider** — iframe'e postMessage gidiyor mu doğrula; gitmiyorsa bağla veya kaldır.
- **Analiz paneli** — teknik jargon (ALPHA, PATH DÜĞÜMÜ) son kullanıcıya gizle; sadece "Baskı boyutu" + "Kaynak" kalsın (veya tümü gizli, debug-only).
**Doğrulama:** Dış paneldeki HER kontrol ya iframe'i gerçekten etkiler ya da yoktur — ölü/çakışan kontrol kalmaz.

## GÖREV 4 — Layout: scroll'u azalt, önizleme üstte [P0.3, P0.4]
Sayfa 2.4× viewport (2290px), iframe 1413px → her şey scroll arkasında.
**Fix:**
- iframe yüksekliğini viewport'a sığacak şekilde sınırla (`max-height: calc(100vh - header)`), `pim-poc-resize`
  mesajını DİNLE ama makul tavanla (sonsuz büyüme yok).
- Görsel yüklenince iframe içinde otomatik "sığdır/ortala" (POC `pim-fit-contain` veya placement preset 'contain')
  → görsel üst-orta'da belirsin, alt yarıda değil.
- Dış panel Görev 3 ile kısalınca toplam scroll zaten düşer. Hedef: tasarım + ana kontroller + CTA ~1 ekranda.
**Doğrulama:** Görsel yükle → scroll'suz önizleme + ana kontroller + bir CTA görünür.

## GÖREV 5 — Tek net aksiyon [P1.5, P1.6]
Üstte "Sticker/Etiket'e ekle" + altta "Kaydet"+"Ayarlar" → çift aksiyon, kafa karıştırır.
**Fix:** Birincil akış TEK olsun: "Sticker'a ekle"/"Etiket'e ekle" (sipariş handoff). "Kaydet" gerekliyse
(taslak) ikincil/sade kalsın veya kaldır. CTA disabled iken sebebini göster ("Önce görsel yükle").
Bıçak türü → ürün önerisi (Dalga 1) korunur.
**Doğrulama:** Kullanıcı tek net "ekle" akışı görür; disabled CTA sebebi belli.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)
1. `rm -rf .next/dev/types` + `npx tsc --noEmit` → 0 hata (kalırsa push etme).
2. `git add -A`
3. `git commit -m "fix(editor-uiux): dis panel sadelestir + boyut girisi + iframe senkron + layout scroll + tek CTA"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. POC iframe'i (kontur motoru) BOZMA — sadece dış React kabuğu + postMessage köprüsü.
> Claude canlıda test edecek: görsel yükle → boyut değiştir → kontur güncellenir → scroll'suz → tek CTA.
> Emin olmadığın yerde (özellikle boyut postMessage protokolü) POC'un mevcut mesaj tiplerini grep'le, uydurma.
