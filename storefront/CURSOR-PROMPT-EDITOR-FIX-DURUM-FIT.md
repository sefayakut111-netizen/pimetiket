# Editör — 2 Kalıcı Bug (Claude canlı test, commit 36a0b2f)

Etkileşim turu 6/6 çalışıyor (ölçek slider, DPI uyarısı, legend, toolbar hepsi ✅). AMA canlı testte
2 GERÇEK bug kaldı — biri kullanıcıyı bloke ediyor.

## 🔴 BUG 1 — "Bıçak: Hesaplanıyor…" takılıyor → CTA DISABLED (kullanıcı ürüne EKLEYEMİYOR)
**Kanıt (Claude canlı):** Kontur modunda küçük görsel (280px) yükledim → kontur ÖNİZLEMEDE GÖRÜNÜYOR
(magenta daire çizili) AMA:
- Özet'te "Bıçak: **Hesaplanıyor…**" takılı kaldı (yeşil "Hazır"a dönmedi)
- "Sticker'a ekle" + "Etiket'e ekle" butonları **disabled** → kullanıcı siparişe geçemiyor

Yani kontur HAZIR ama sistem "hazır değil" sanıyor. UIUX turundaki durum senkronu (`pim-cutline-ready`
postMessage → `cutlineReady` state) bazı durumlarda tetiklenmiyor/yakalanmıyor.
**NOT:** Önceki testte 80mm dikdörtgende "Hazır"a dönmüştü; bu küçük-görsel+kontur kombosunda takıldı.
Demek ki `pim-cutline-ready` koşullu/eksik atılıyor.

**Fix yönü:**
- `poc.html`: `generateCutline()` BAŞARIYLA bittiğinde (kontur path üretildiğinde) HER MODDA
  `pim-cutline-ready` postMessage atıldığından emin ol. Şu an muhtemelen sadece bazı yollarda atılıyor
  (örn. preflight başarısında ama fast-preview/küçük görselde atlanıyor). grep `pim-cutline-ready` →
  generateCutline'ın tüm başarı çıkışlarına ekle.
- `EditorShell.tsx`: `cutlineReady` state'i `pim-cutline-ready` ile true olur — ama timeout/fallback ekle:
  kontur overlay render edildiyse (pim-poc-loaded sonrası N saniye) `cutlineReady=true` varsay (CTA'yı
  sonsuza kadar disabled bırakma). Kullanıcıyı bloke eden "hesaplanıyor" sonsuz takılması OLMAMALI.

**Doğrulama:** Küçük görsel + kontur modu → birkaç sn içinde "Bıçak: Hazır" + CTA aktif. Farklı boyut/mod/görselde de.

## 🔴 BUG 2 — İlk yüklemede görsel %200 açılıyor (taşıyor), elle %100'e çekmek gerekiyor
**Kanıt (Claude canlı):** 280px görsel yükledim → GÖRSEL ÖLÇEK otomatik **%200**'e gitti, mor görsel
canvas'ı taşırdı. Slider'ı elle %99'a çekince düzeldi. Yani `pimFitEditorPreviewToFrame` / ilk-yükleme
fit, küçük görseli büyük çerçeveye **%200 ile** oturtuyor (üst sınıra yapışıyor).

**Fix yönü:** İlk yükleme fit'i, görseli baskı boyutuna (mm) göre %100 referansla yerleştirsin — görsel
ÖLÇEĞİ default %100 olmalı (görsel = baskı boyutu), view-zoom ayrı (önizleme yakınlaştırma). İkisi karışmış:
"Görsel ölçek %200" = görsel baskı alanının 2 katı demek, bu yanlış default. Yükleme sonrası ölçek=%100
(görsel baskı boyutuna sığar), view-zoom çerçeveye fit. Slider %100'den başlasın.

**Doğrulama:** Görsel yükle → ölçek %100, görsel önizlemeye sığar (taşmaz), elle düzeltme gerekmez.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)
1. `rm -rf .next/dev/types` + `npx tsc --noEmit` → 0 hata.
2. `git add -A`
3. `git commit -m "fix(editor): bicak-hazir durum senkronu (CTA disabled takiliyor) + ilk yukleme olcek %200 bug"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. BUG 1 kullanıcıyı bloke ediyor (CTA disabled) — öncelik. POC iframe kontur
> motorunu bozma. Claude canlıda test edecek: küçük görsel + kontur → CTA aktifleşiyor mu + ölçek %100 mü.
