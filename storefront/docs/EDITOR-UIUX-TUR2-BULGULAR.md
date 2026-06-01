# Editör UI/UX Tur 2 — Bulgular (Sefa görseli + Claude canlı DOM teyit, 1 Haz)

Sefa 5 somut sorun işaret etti. Claude canlıda (pimetiket.com/editor, commit 28102be) DOM'dan doğruladı.

## 1. 🔴 Footer editörde gereksiz — KALDIR
**Teyit:** `<footer>` VAR, içeriği "PİM'İN DEFTERİ — Etiket rehberini ilk sen oku" (newsletter aboneliği).
Editör bir araç sayfası; footer (newsletter + site linkleri) dikkat dağıtıyor + sayfa uzuyor.
**Fix:** `/editor` layout'unda footer'ı gizle/render etme (AppShell footer'ı editörde kapalı olsun).

## 2. 🔴 Panel içinde panel — TEK panel olmalı
**Teyit:** 10 bordürlü/gölgeli kutu var. Sol sütun (BASKI BOYUTU + GÖRSEL ÖLÇEK + ÖZET) ayrı kutular,
orta sütun (DOSYA + KATMANLAR + ANALİZ) ayrı kutular → "2 farklı panel" hissi (Sefa'nın dediği).
Görselde net: sol panel + orta panel + her birinin içinde alt-kutular = iç içe kutu kalabalığı.
**Fix:** Kontrolleri TEK tutarlı panele topla (tek kart/sütun, içinde bölümler ayraçla — kutu-içinde-kutu YOK).
Ya tek sol sütun (tüm kontroller) + sağ önizleme, ya da tek birleşik kontrol paneli. Görsel bütünlük.

## 3. 🟡 Bıçak renkleri 2 defa yazılmış
**Teyit:** "Bıçak" 3 kez geçiyor. İki ayrı legend:
- **Üst bar "Renkler:"** legend (Bıçak/Beyaz plan/Taşma/Güvenli alan — tam açıklamalı) — yeni eklenen.
- **Canvas sağ üst** mini legend ("Bıçak — Bleed — Safe" — eski POC/preview toolbar).
İkisi aynı bilgi → tekrar.
**Fix:** Birini kaldır. Üst "Renkler:" legend daha açıklayıcı (Türkçe + ne olduğu) → onu TUT, canvas sağ
üstteki mini legend'i KALDIR. Veya tersi — tek legend kalsın.

## 4. 🟡 Dosya yükleme alanı tasarımı bozuk + tek panele taşınmalı
**Teyit:** DOSYA kutusu orta sütunda ayrı, içinde upload-zone + "AI ile arka planı kaldır" butonu. Görselde
upload ikonu/çerçevesi dengesiz duruyor (sol kenar kesik dashed). Madde 2 ile bağlantılı — ayrı kutu olması
sorunun parçası.
**Fix:** Dosya yükleme alanını birleşik panele entegre et (ayrı kutu değil), upload-zone tasarımını düzelt
(dengeli dashed çerçeve, ortalı ikon). Madde 2'nin tek-panel çözümüyle birlikte yapılır.

## 5. 🟡 Canlı önizlemede fazla referans çizgisi — sadece bıçak yeterli
**Teyit:** Sadece `cut` katmanı AÇIK (bleed/safe/white kapalı) AMA canvas'ta 3 çerçeve görünüyor:
- Magenta kesik = **Bıçak konturu** (figürü sarıyor) ✅ KALSIN
- Kahverengi/turuncu kesik dikdörtgen = içerik/yerleşim bbox referansı ❌ FAZLA
- Kırmızı-soluk dikdörtgen = `drawOrderDimReference` (sipariş/baskı boyutu çerçevesi, 2 çağrı) ❌ FAZLA
Sefa: "bıçakların referansı olmalı yeterli." Boyut/içerik referans çerçeveleri görsel gürültü.
**Fix:** `poc.html` editorShell modunda `drawOrderDimReference` + içerik bbox çerçevesini ÇİZME (veya çok
soluk/gizli). Sadece aktif katman konturları (bıçak + kullanıcı açarsa bleed/safe) görünsün. Temiz önizleme.

---

## ÖZET — 5 madde, hepsi UI/UX (kontur motoru SAĞLAM, dokunma)
| # | Sorun | Önem | Dosya |
|---|---|---|---|
| 1 | Footer kaldır | 🔴 | /editor layout |
| 2 | Tek panel (iç-içe kutu yok) | 🔴 | EditorShell.tsx |
| 3 | Çift renk legend → tek | 🟡 | EditorShell + preview toolbar |
| 4 | Dosya alanı düzelt + panele al | 🟡 | EditorShell.tsx |
| 5 | Fazla referans çizgisi → sadece bıçak | 🟡 | poc.html (editorShell modu) |

**NOT:** 2+4 birlikte yapılır (tek panel = dosya alanı da içinde). 3+5 görsel sadeleştirme. Hepsi aynı tur.
Kontur/boyut/DPI/ölçek ÇALIŞIYOR (canlı doğrulandı) — bu tur sadece görsel düzen/sadeleştirme.

## SONRAKİ
Sefa onaylayınca tek Cursor prompt'una dökülür (5 madde, EditorShell + poc.html + /editor layout).
