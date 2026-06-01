# Pim Etiket Editör — Mimari & Geliştirme Yol Haritası

> Kaynak: 7-boyutlu editör keşif workflow'u (1 Haz, 42 doğrulanmış fırsat) + Sefa vizyonu.
> Editör = baskı-öncesi hazırlık aracı (TASARIM ARACI DEĞİL). Bkz. `PIM-EDITOR-KOMUT-SPEC.md`.

## Mimari ilke (değişmez)

1. **Editör tasarım yapmaz** — görsel yükle → kesim bıçağı ayarla → boyut ver → baskıya/sepete taşı.
2. **İzinli işlemler sınırlı:** boyut, kesim payı (offset), yumuşatma, katman (cut/bleed/safe/white), arka plan kaldırma, düz renk zemin, döndürme/çevirme. Serbest tasarım/eleman/metin YOK.
3. **Bıçak türü → ürün yönlendirir** (yuvarlak bıçak → yuvarlak sticker). Otomatik geçmez, önerir.
4. **Çıktı baskıya hazır olmalı** — editörün asıl değeri bu (CMYK, spot CutContour, bleed, DPI).
5. **Pim = sesli kumanda** (gelecek) — mevcut aksiyonları doğal dille tetikler, sistem sınırlarını bilir.
6. **Sefa kuralları:** cüzdan/puan YOK, tek Pim, serbest tasarım aracı değil, abartı yok.

## Mevcut durum (gerçek kod)

- **Sağlam temel:** `EditorShell.tsx` (1146 satır), `PikasoEditorCanvas.tsx` (960 satır, Pikaso/Konva), OpenCV worker (`contour.worker.ts`), 28 `lib/editor/` dosyası, handoff (`editor-handoff.ts`).
- **Çalışan:** 3 bıçak modu (şablon/otomatik/şekil), 65 die-cut, arka plan kaldırma, katmanlar, konfigüratöre handoff.
- **Kilit gözlem:** En değerli işlerin çoğu **yarısı kodda hazır, UI/bağlantı eksik** (cornerRadiusMm, rotationDeg, setLayerVisibility no-op).
- **Çekirdek bug (fix ediliyor):** OpenCV 4.10 Promise-API → worker timeout → kontur kaba kalıyordu (`CURSOR-PROMPT-EDITOR-OPENCV-FIX.md`).

---

## YOL HARİTASI — 4 dalga (değer/efor sıralı)

### 🌊 Dalga 0 — Çekirdek (ŞART, devam ediyor)
OpenCV worker fix. Bu olmadan kontur çalışmaz; üstüne özellik koymak körlük.

### 🌊 Dalga 1 — Hızlı kazanımlar (S efor, altyapı çoğu hazır) ← İLK CURSOR PROMPT
| # | İş | Hazır olan | Eksik |
|---|---|---|---|
| 1 | Bıçak türü → ürün CTA | `bladeShape.kind`, `addToProduct(product)` (EditorShell:185,450) | öneri metni + buton vurgusu |
| 2 | Köşe yarıçapı slider | `cornerRadiusMm` (controller-types:16, canvas:344) | rect modunda slider UI |
| 3 | Görsel döndür/çevir | `rotationDeg` (placement.ts okuyor) | imperative `rotateImage`/`flipImage` + buton |
| 4 | Bleed/Safe tooltip | `LAYER_LABELS` (EditorPreviewToolbar:7) | `title`/`aria` Türkçe açıklama |
| 5 | "Kontur hazır" bildirimi | `contourRefining` state (EditorShell:113) | false→true geçişinde yeşil onay |
| 6 | DPI uyarısı | `suggestMmFromPixels` (DPI=300 sabit) | gerçek DPI oku + 150/100 eşik uyarısı |

### 🌊 Dalga 2 — Baskı doğruluğu (M efor, editörün ASIL işi)
| İş | Sorun |
|---|---|
| Gerçek spot color (CutContour PDF separation) | `print-ready.ts:13` kod kendisi uyarıyor — şu an RGB magenta, operatör elle düzeltiyor |
| İç boşluk (delik) desteği | `RETR_EXTERNAL`→`RETR_CCOMP` — "O"/halka/kafes ortası kesilmiyor |
| SVG vektör → doğrudan kesim | SVG raster'a çevrilip OpenCV'ye gidiyor; vektörü direkt kesime çevir |
| Downscale 640→1024px | İnce detay (saç teli) 640px'de kayboluyor |
| Malzeme-bağımlı bleed | `bleedMm` sabit 2; vinyl 3mm / rulo 1.5mm olmalı |

### 🌊 Dalga 3 — Pim komut altyapısı (M efor, komuttan ÖNCE mimari)
| İş | Neden önce |
|---|---|
| `size-references.ts` oluştur (1 TL=26mm tablosu) | Pim ölçü-referansının tek doğru kaynağı; yok |
| EditorShell aksiyonlarını controller'a expose et | Pim'in tetikleyeceği 10 aksiyon şu an UI'a gömülü |
| `setLayerVisibility` gerçek implementasyon | Şu an no-op (PikasoEditorCanvas:794) |
| Tek-adım undo (`revertLastCommand`) | Spec ilke 4: "Pim aksiyonu geri al" |
| Pim komut API iskeleti (`/api/editor/pim-command` + Zod) | Whitelist + clamp + live config enjeksiyon |

### 🌊 Dalga 4 — Mobil (L efor, eninde sonunda şart)
| İş | Sorun |
|---|---|
| Responsive layout | 4-kolon grid (EditorShell:555) telefonda patlıyor, hiç breakpoint yok |
| Pinch-zoom | `usePikasoEditor` touch-zoom handler yok |
| Touch target ≥44px | Zoom butonları 32px |

---

## Bağımlılık sırası
```
Dalga 0 (OpenCV) ──┬─→ Dalga 1 (hızlı kazanım, OpenCV'den bağımsız UI)
                   └─→ Dalga 2 (baskı doğruluğu, OpenCV çalışmalı)
                        └─→ Dalga 3 (Pim altyapı)
                             └─→ Pim komut Faz 1 (PIM-EDITOR-KOMUT-SPEC.md)
Dalga 4 (mobil) — paralel, bağımsız
```

## Cursor teslim sırası
1. `CURSOR-PROMPT-EDITOR-OPENCV-FIX.md` (Dalga 0 — devam ediyor)
2. `CURSOR-PROMPT-EDITOR-DALGA1.md` (bu turda hazırlanıyor)
3. Dalga 2/3/4 — sırayla, her biri canlı doğrulama sonrası

> Her prompt sonunda commit+push+canlıya al kuyruğu ([[cursor-commit-tail]]). Migration gerekenler Sefa apply.
