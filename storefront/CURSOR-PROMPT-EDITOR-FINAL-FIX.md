# Editör Final Fix — açık maddeler tek işte (Claude canlı test, 1 Haz)

Editör çekirdek+UI+etkileşim+sohbet TAM çalışıyor. Claude canlıda kalan açıkları + Pim sohbet testini
yaptı. 4 madde tek commit'te (Sefa: "hepsini tek işte"). Kontur motoru/POC BOZMA. Migration YOK.

## GÖREV 1 — BG removal çalışmıyor → publicPath kaldır + staticimgly CSP 🔴 [P0]
**Kök neden (Claude canlı network):** `@imgly/background-removal@1.5.5` paketinde MODEL YOK (kod var, model
ayrı pakette). Model host'u kütüphane default'u: **`staticimgly.com/@imgly/background-removal-data/${VER}/dist/`**.
Önceki jsdelivr publicPath fix'i YANLIŞTI (jsdelivr'da `resources.json` boş `{}` → Failed to fetch).
### Adım 1: `poc.html` `performBackgroundRemoval` — publicPath satırını KALDIR
```js
const blob = await removeBackground(currentFile, {
  // publicPath KALDIRILDI — kütüphane default staticimgly.com'dan model çeker
  progress: (key, current, total) => { ... }  // mevcut progress kalsın
});
```
### Adım 2: CSP `connect-src`'e `https://staticimgly.com` ekle
`next.config.ts` (~satır 80 connect-src) + varsa `src/lib/security/csp.ts`. Mevcut listeye `https://staticimgly.com` ekle.
(Model .onnx/.wasm `fetch` ile gelir → connect-src yeterli; script-src GEREK YOK.)
**Doğrulama:** Beyaz arka planlı görsel → "AI ile arka planı kaldır" → arka plan kalkar (Failed to fetch yok). Network'te staticimgly.com 200.

## GÖREV 2 — Pim sohbet input görünmüyor (sağ sütun altında, scroll arkası) 🟡
**Teyit (Claude):** EditorPimPanel input'u y:930 — viewport altında, kullanıcı komut kutusunu göremiyor
(açıklama metni uzun, input'u aşağı itiyor). Komut API ÇALIŞIYOR ("1 lira boyutu"→26mm doğrulandı) ama input erişilemez.
**Fix:** Sağ Pim sütunu layout — açıklama metni kısalt + **input'u sütun ALTINA SABİTLE** (sticky bottom),
mesaj listesi ortada scroll'lansın. Pim paneli: üst başlık (kısa) + orta mesaj listesi (flex-1, overflow-auto)
+ alt sabit input. Kullanıcı her zaman komut kutusunu görsün.
**Doğrulama:** Sağ sütunda input EKRANDA görünür (scroll'suz), mesajlar yukarı akar.

## GÖREV 3 — Editörde genel PimChat floating widget'ı gizle [çift chat] 🟡
Cursor notu: "Sağ alttaki genel PimChat widget editörde hâlâ görünür." Editörde sağ sütun Pim ZATEN var →
genel floating PimChat ÇİFT olur (kafa karışıklığı).
**Fix:** `/editor` rotasında genel PimChat (AppShell floating) render edilmesin (footer'ı gizlediğimiz gibi —
`pathname.startsWith('/editor')` koşulu). Editör Pim'i = sağ sütun (tek kaynak).
> Claude DOM'da görünür fixed widget bulamadı (belki zaten yarı-gizli) — yine de KESİN gizle: editörde
> floating PimChat olmamalı. AppShell'de editör koşulu ekle.
**Doğrulama:** /editor'da sağ-alt floating Pim chat YOK; sadece sağ sütun Pim paneli.

## GÖREV 4 — Sol panel 3 adımlı tool (Görsel · Bıçak · Boyut) 🟢
Sefa: sol 6 bölüm tek uzun sütunda, akış belirsiz. 3 adımlı tool (Sefa kararı: Görsel/Bıçak/Boyut):
| Adım | İçindeki MEVCUT bölümler |
|---|---|
| **Görsel** | DOSYA YÜKLE + GÖRSEL ÖLÇEK + AI arka plan kaldır |
| **Bıçak** | KESİM MODU + Kesim mesafesi + Yumuşatma + YERLEŞTİR (Ortala/Sığdır/Doldur) |
| **Boyut** | BASKI BOYUTU (mm+oran) + KATMANLAR (bıçak/bleed/safe/beyaz) |
- Sol panel üstüne 3 sekme (yatay segment, aktif=mercan vurgu). `useState<'gorsel'|'bicak'|'boyut'>('gorsel')`.
- Her grup koşullu render; mevcut bölüm JSX'leri AYNEN taşınır (yeni kontrol YOK — grupla + sekme arkası).
- **ÖZET** (durum/DPI) sekme DIŞI, panel altında her zaman görünür.
- Sekme değişince değerler korunur (sadece görünürlük). Görsel yükleyince otomatik "Bıçak"a geçiş opsiyonel.
- Mevcut postMessage akışları (set-size/shape/scale, toggle-layer, fit-*, bg-remove) AYNEN çalışır.
**Doğrulama:** 3 sekme; tıklanınca ilgili kontroller; bir anda bir grup; değerler korunur; ÖZET hep görünür.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)
1. `rm -rf .next/dev/types` + `npx tsc --noEmit` → 0 hata.
2. `git add -A`
3. `git commit -m "fix(editor-final): bg-removal staticimgly CSP + Pim input sticky + cift chat gizle + sol panel 3 adimli tool"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. Görev 1 (bg-removal) = P0 işlevsel. POC/kontur/sonsuz-zemin/önizleme BOZMA.
> Onay ekranı (/onay) editorShell koşuluyla korunsun. Claude canlıda test: bg-kaldır çalışıyor + Pim input
> görünür + tek chat + 3 sekme. Pim TASARIM YAPMAZ — mevcut aksiyon tetikler (whitelist korunur).
