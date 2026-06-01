# Editör 3 Sorun — Analiz (Sefa + Claude canlı kod teyit, 1 Haz)

## 1. 🔴 Sonsuz zemin HÂLÂ kesiyor (canvas içerik boyutunda sınırlı)
**Teyit (Claude kod):** `canvas.width/height` GÖRSEL/içerik boyutuna set ediliyor (örn. 600×400).
`pimAutoFitViewZoomToWrap` (poc.html:2320) sadece `viewZoom`'u ayarlıyor — canvas'ı önizleme alanına
SIĞDIRIYOR ama canvas kendisi içerik boyutunda KALIYOR → kenarları belli, etrafı kesik (Sefa: "hala kesiyor").
**Gerçek sonsuz düzlem:** canvas (veya checkerboard zemin katmanı) önizleme alanının (canvasWrap) TAM
boyutunda olmalı; görsel + kontur o büyük zeminin İÇİNE çizilmeli, ortada yüzmeli. Şu an tam tersi —
canvas görsel kadar, zemin görselle sınırlı.
**Fix:** editorShell modunda canvas'ı `canvasWrap` tam boyutuna genişlet (clientWidth × clientHeight).
Görsel + bıçak + checkerboard bu büyük canvas içinde konumlansın (mevcut transform/zoom mantığıyla).
Zemin kenarsız görünsün — viewZoom değil, canvas boyutu = wrap boyutu.

## 2. 🔴 Pim "1 lira" komutu boyutu uyguladı AMA görseli bıçağın içine yerleştirmedi/ortalamadı
**Teyit (Sefa görseli):** Pim "1 TL ≈ 26.15mm, yuvarlak kesim uyguladım" dedi, boyut 26.2mm + yuvarlak
bıçak oldu ✅. AMA görsel %180 ölçekte, dev futbolcu — yuvarlak bıçak figürün dizinde küçük bir daire,
görsel bıçağın İÇİNE oturmamış/ortalanmamış.
**Beklenen:** Pim boyut+şekil komutu uygulayınca görseli de o bıçağa **sığdır + ortala** (fit-contain +
center) — kullanıcı "bunu 1 lira sticker yap" deyince görsel o yuvarlak içine girsin.
**Fix:** `dispatch-pim-command.ts` — `set_size_from_reference` / `set_shape` komutu sonrası otomatik
`pim-fit-contain` (veya center) de tetikle. Yani Pim boyut/şekil değiştirince görsel ölçeği %100'e dönüp
bıçağa sığsın. Şu an boyut değişiyor ama görsel ölçeği (%180) korunuyor → görsel taşıyor.
> Bağlantılı: boyut değişiminde görsel ölçeğinin %180'de kalması da bir bug (önceki "ilk yükleme %100"
> fix'i komut yoluyla gelince çalışmıyor olabilir).

## 3. 🟡 Renk legend karışıklığı — "Bıçak/Kesim hattı = magenta" ama Sefa "kesim mavi" diyor
**Teyit (Claude kod):** die-cut kütüphane konvansiyonu (`die-cut-templates.ts`):
- **KissCut (yarım kesim) = CutContour MAGENTA** `#E5007E`
- **ThruCut (tam kesim) = MAVİ** `#0047FF`
POC cut layer çizimi (poc.html:3829): `#ff0080` (magenta) ve `#3b82f6` (mavi) ikisi de var.
Editör legend "Bıçak — Kesim hattı = magenta" gösteriyor.
**KAVRAM:** İki ayrı kesim türü var, renkleri KASITLI farklı (sektör standardı). Sefa "tam kesim kontur
mavi" diyor = ThruCut. Editördeki "Kontur" kesim modu hangi türü temsil ediyor?
- Eğer editör sticker yarım-kesim (KissCut) → magenta DOĞRU.
- Eğer tam kesim (ThruCut) → mavi olmalı, legend YANLIŞ.
**SEFA'YA SORU (karar gerek):** Editördeki kesim çizgisi hangi kesim türü? Tek bir bıçak çizgisi mi
(o zaman rengi senin standardına göre sabitle — mavi?), yoksa KissCut/ThruCut ayrımı mı (o zaman legend
ikisini de açıklamalı, kullanıcı seçince renk değişsin)?
> Bu, sadece renk değil ÜRÜN kararı — yanlış renk = matbaada yanlış kesim türü. Sefa netleştirmeli.

---

## ÖZET
| # | Sorun | Önem | Fix |
|---|---|---|---|
| 1 | Sonsuz zemin kesiyor | 🔴 | canvas = wrap tam boyutu (içerik boyutu değil) |
| 2 | Pim görseli bıçağa ortalamıyor | 🔴 | dispatch: set-size/shape sonrası fit-contain+center |
| 3 | Kesim rengi (magenta vs mavi) | 🟡 KARAR | Sefa: editör kesim türü ne? renk standardı? |

**KARAR BEKLEYEN (#3):** Sefa kesim türü/renk standardını netleştirmeli — sonra düzelt.
#1 ve #2 net, hemen fix'lenebilir.
