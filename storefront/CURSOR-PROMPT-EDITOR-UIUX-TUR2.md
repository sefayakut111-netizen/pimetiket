# Editör UI/UX Tur 2 — Görsel düzen sadeleştirme

Sefa 5 sorun işaret etti, Claude canlıda DOM'dan doğruladı: `docs/EDITOR-UIUX-TUR2-BULGULAR.md`.
Hepsi GÖRSEL DÜZEN — kontur/boyut/DPI/ölçek motoru ÇALIŞIYOR (canlı doğrulandı), ONA DOKUNMA.

> POC iframe kontur motorunu BOZMA. EditorShell.tsx (görsel düzen) + poc.html (referans çizgileri) + /editor layout (footer).
> Migration YOK.

---

## GÖREV 1 — Footer'ı editörde kaldır [P0]
Editörde `<footer>` (PİM'İN DEFTERİ newsletter + site linkleri) var — araç sayfasında gereksiz, dikkat dağıtıyor.
**Fix:** `/editor` route'unda footer render edilmesin. AppShell/layout footer'ı editör sayfasında gizle
(örn. `app/editor/layout.tsx`'te footer'sız layout, veya AppShell'e `hideFooter` prop'u + editör'de true).
**Doğrulama:** /editor'da sayfa sonunda footer YOK; diğer sayfalarda footer durur.

## GÖREV 2 — TEK panel: sol sütun + sağ önizleme [P0] (Sefa kararı: tek sol sütun)
Şu an sol sütun (Baskı boyutu/Görsel ölçek/Özet) + orta sütun (Dosya/Katmanlar/Analiz) = **2 panel + 10
iç kutu** → "panel içinde panel" hissi.
**Fix:** TÜM kontrolleri TEK sol sütunda topla; sağda büyük önizleme. Layout: `grid-cols-[360px_1fr]` benzeri
(sol kontrol sütunu + sağ canvas).
Sol sütun içeriği SIRAYLA (tek kart, içinde bölüm başlıkları — **kutu-içinde-kutu YOK**, sadece ince ayraç/başlık):
1. **Dosya yükle** (upload-zone + AI arka plan kaldır) ← orta sütundan taşı
2. **Baskı boyutu** (Genişlik/Yükseklik mm + oran kilidi)
3. **Kesim modu** (Kontur/Çevresel/Dikdörtgen/Yuvarlak) ← üst toolbar'dan buraya VEYA üstte kalsın (tutarlı tek yer)
4. **Görsel ölçek** (slider)
5. **Katmanlar** (Bıçak/Beyaz/Bleed/Safe toggle)
6. **Özet** (Kaynak / Baskı boyutu / Bıçak durumu / DPI)
- Her bölüm: başlık + içerik, ortak arka plan/padding. Ayrı `border rounded shadow` kutular YOK — tek panel görünümü.
- Yerleştir toolbar (Ortala/Sığdır/Doldur) önizleme üstünde kalabilir (canvas kontrolü, mantıklı yer).
**Doğrulama:** Sol tek sütun, bölümler ayraçla; görsel olarak TEK panel (iç içe kutu yok). Sağda önizleme.

## GÖREV 3 — Çift renk legend → tek [P1]
İki legend aynı bilgiyi gösteriyor:
- Üst bar **"Renkler:"** (Bıçak/Beyaz plan/Taşma/Güvenli alan — açıklamalı, Türkçe) ← TUT
- Canvas sağ üst **"Bıçak — Bleed — Safe"** mini legend (eski preview toolbar) ← KALDIR
**Fix:** Canvas sağ üstteki mini legend'i kaldır (EditorPreviewToolbar veya preview header'da). Üstteki
açıklamalı "Renkler:" legend tek kalsın.
**Doğrulama:** Tek renk açıklaması (üstte); canvas sağ üstte tekrar yok.

## GÖREV 4 — Dosya yükleme alanı tasarımı düzelt [P1]
Upload-zone dengesiz (sol kenar dashed çerçeve kesik, ikon hizasız). Görev 2 ile sol panele taşınırken
tasarımı düzelt: dengeli/tam dashed çerçeve, ortalı upload ikonu + metin, "AI ile arka planı kaldır" butonu
altında düzgün. Boş/dolu durumlar tutarlı.
**Doğrulama:** Upload alanı dengeli çerçeve + ortalı içerik, sol panelde diğer bölümlerle uyumlu.

## GÖREV 5 — Fazla referans çizgisi → sadece bıçak [P1]
Canvas'ta sadece `cut` katmanı açıkken bile 3 çerçeve çiziliyor:
- Magenta = Bıçak konturu ✅ KALSIN
- Kahverengi/turuncu kesik dikdörtgen = içerik/yerleşim bbox ❌ KALDIR
- Kırmızı-soluk dikdörtgen = `drawOrderDimReference` (sipariş/baskı boyutu çerçevesi) ❌ KALDIR
**Fix:** `poc.html` editorShell modunda (`html.pim-editor-shell`) `drawOrderDimReference` + içerik bbox
referans çerçevelerini ÇİZME. Sadece aktif katman konturları (bıçak + kullanıcı açarsa bleed/safe/white) görünsün.
> poc.html'de bu çerçeveleri çizen kodu grep'le (`drawOrderDimReference`, içerik bbox stroke); editorShell
> modunda erken return / skip et. Diğer modlar (onay ekranı) ETKİLENMESİN — sadece editorShell.
**Doğrulama:** Editörde sadece bıçak konturu (+ açık katmanlar). Boyut/içerik referans çerçeveleri yok. Onay ekranı (/onay) etkilenmez.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)
1. `rm -rf .next/dev/types` + `npx tsc --noEmit` → 0 hata.
2. `git add -A`
3. `git commit -m "fix(editor-uiux2): footer kaldir + tek panel (sol sutun) + tek renk legend + dosya alani + sadece bicak referansi"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. KONTUR MOTORUNU BOZMA (sadece görsel düzen). Onay ekranı (/onay/duzenle)
> POC'u kullanıyor — Görev 5'te SADECE editorShell modunu etkile, onay ekranı referans çizgileri kalsın.
> Claude canlıda test edecek: footer yok + tek panel + tek legend + temiz önizleme (sadece bıçak).
