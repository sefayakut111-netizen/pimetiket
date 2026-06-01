# Editör Sol Panel — 3 Adımlı Tool (Görsel · Bıçak · Boyut)

Sefa: sol paneldeki 6 bölüm tek uzun sütunda, hangi adımda olduğu belirsiz. İstek: **3 adımlı tool**
(Görsel → Bıçak → Boyut) — kullanıcı akış sırasını görsün, bir anda bir grup açık olsun.

> EditorShell.tsx sol `aside` (360px, satır 643). Kontur motoru/POC iframe BOZMA — sadece sol panel
> organizasyonu. Migration YOK. 3-sütun grid (`grid-cols-[360px_1fr_320px]`) korunur.

## TASARIM — 3 adım sekme/grup (Sefa kararı: Görsel · Bıçak · Boyut)
Sol panel üstüne **3 sekmeli tool çubuğu** (yatay segment veya dikey ikon+label). Aktif sekme vurgulu.
Tıklanınca o grubun kontrolleri altında görünür (diğerleri gizli). Mevcut 6 bölüm 3 gruba dağılır:

| Adım | İkon önerisi | İçindeki MEVCUT bölümler |
|---|---|---|
| **1. Görsel** | 📤 / upload | DOSYA YÜKLE + GÖRSEL ÖLÇEK + "AI ile arka planı kaldır" |
| **2. Bıçak** | ✂️ / scissors | KESİM MODU (Kontur/Çevresel/Dikdörtgen/Yuvarlak) + Kesim mesafesi + Yumuşatma + YERLEŞTİR (Ortala/Sığdır/Doldur) |
| **3. Boyut** | 📐 / ruler | BASKI BOYUTU (Genişlik/Yükseklik mm + oran kilidi) + KATMANLAR (Bıçak/Bleed/Safe/Beyaz) |

- **ÖZET** (Kaynak/Baskı boyutu/Bıçak durumu/DPI) — sekme DIŞI, panelin EN ALTINDA her zaman görünür
  (durum bilgisi adımdan bağımsız). Veya kompakt üst durum şeridi.
- **Renkler legend** — önizleme üstünde kalır (değişmez).

## İSKELET
- `EditorShell.tsx`: `const [activeStep, setActiveStep] = useState<'gorsel'|'bicak'|'boyut'>('gorsel')`.
- Sekme çubuğu (3 buton, aktif vurgu — mercan). Görsel yokken "Bıçak"/"Boyut" sekmeleri açılabilir ama
  içerik "önce görsel yükle" ipucu gösterebilir (veya pasif).
- Her grup `{activeStep==='gorsel' && (...)}` ile koşullu render. Mevcut bölüm JSX'leri AYNEN taşınır
  (yeni kontrol yazma — sadece grupla + sekme arkasına koy).
- Sekme değişince state korunur (boyut/ölçek değerleri kaybolmaz — sadece görünürlük).
- Akış ipucu: görsel yüklenince otomatik "Bıçak" sekmesine geçebilir (opsiyonel, hoş dokunuş — Sefa isterse).

## DİKKAT
- Mevcut postMessage akışları (pim-editor-set-size/shape/scale, toggle-layer, fit-*, trigger-bg-remove)
  AYNEN çalışmalı — sadece UI gruplandı, mantık değişmedi.
- Sağ "Pim sohbet" sütunu (320px) ve önizleme DOKUNULMAZ.
- Mobilde 360px sekme grubu dar — sekmeler sığsın (ikon+kısa label veya sadece ikon).

## DOĞRULAMA
1. `npx tsc --noEmit` → 0 hata.
2. Canlı /editor: 3 sekme (Görsel/Bıçak/Boyut), tıklanınca ilgili kontroller; bir anda bir grup açık.
3. Görsel yükle (Görsel adımı) → Bıçak adımı (kesim modu seç) → Boyut adımı (mm) → değerler korunur, kontur güncellenir.
4. ÖZET her adımda görünür (durum/DPI).

## SON ADIM — commit + push + canlıya al (ZORUNLU)
1. `npx tsc --noEmit` → 0 hata.
2. `git add -A`
3. `git commit -m "feat(editor): sol panel 3 adimli tool (Gorsel/Bicak/Boyut) — akis-odakli gruplandirma"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. SADECE sol panel UI organizasyonu — kontur/POC/önizleme/sohbet sütunu bozulmaz.
> Claude canlıda test: 3 sekme + akış + değer korunması + ÖZET görünür.
