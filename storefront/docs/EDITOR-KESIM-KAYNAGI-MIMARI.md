# Editör — "Kesim Kaynağı" Dağıtım Mimarisi

Sefa kararı (1 Haz): Editör Bıçak sekmesinde kullanıcı kesim kaynağını seçince DOĞRU MOTORA yönlenmeli.
**Özel kesim = editör kontur motoru (OpenCV izler); diğerleri preset.**

## SORUN (mevcut durum, Claude kod teyit)
- Bıçak sekmesi `KESİM MODU` = 4 düz buton (Kontur/Çevresel/Dikdörtgen/Yuvarlak, `CUT_MODES` EditorShell:48).
  Kontur motoru (OpenCV) ile parametrik şekiller (rect/circle) AYNI listede, ayrım belirsiz.
- Ofset + Yumuşatma her modda gösteriliyor — ama **yumuşatma yalnız kontur/hull'da anlamlı** (parametrik
  şekilde köşe yok). Kullanıcı yuvarlakta yumuşatma görüyor (kafa karıştırıcı).
- Die-cut şablon = sadece `/sablonlar?tab=kesim` HARİCİ link (EditorShell:1127) → kullanıcı editörden ÇIKIYOR,
  ?sablon=ID ile geri dönüyor. Editör İÇİNDE galeri yok.

## MİMARİ — 2 motor, 3 kullanıcı yolu (cut source dispatch)

**Motor seviyesi (POC, MEVCUT — yeni motor YOK):**
- **Kontur motoru** = OpenCV görseli izler. cutMode `"contour"` (sıkı) / `"hull"` (geniş/çevresel).
- **Preset motoru** = parametrik geometri (izleme yok). cutMode `"circle"` / `"rect"`.

**Kullanıcı seviyesi — `cutSource` (YENİ state): 3 yol, her biri motora "iletir":**

| Kesim kaynağı | Motor | cutMode | Görsel? | Gösterilen kontroller |
|---|---|---|---|---|
| **Özel kesim** | Kontur (OpenCV) | contour (+ Sıkı/Geniş alt-seçim → contour/hull) | GEREKİR (izlenecek silüet) | Ofset + **Yumuşatma** + Kesim türü + Yerleştir |
| **Hazır şekil** | Preset | circle (Yuvarlak) / rect (Kare/Dikdörtgen) | opsiyonel (şeklin içine yerleşir) | Şekil seçici + Boyut + Köşe yuvarlama(rect) + Ofset + Kesim türü + Yerleştir |
| **Die-cut şablon** | Preset | şablonun shape'inden türer | opsiyonel | **Editör-içi galeri** (65 şablon) + seçili boyut(resize) + Ofset + Kesim türü |

> **Dispatch ("iletecek") = shell-side**: cutSource değişince ilgili `pim-editor-set-shape` (mevcut) postalanır +
> ilgili kontroller koşullu render edilir. Motor zaten contour/hull/rect/circle destekliyor — yeni POC kodu YOK.

### Eşleme (Sefa'nın 3 örneği)
- **"özel kesim" → Özel kesim** = kontur motoru (görsel yükle → OpenCV silüeti sarar). Yumuşatma BURADA.
- **"yuvarlak" → Hazır şekil = Yuvarlak** (varsayılan) = parametrik daire preset. Yumuşatma YOK.
- **"diecut" → Die-cut şablon** = editör-içi 65-şablon galerisi → seçilen şablonun shape+boyut+köşesi uygulanır.

### Kapsam notları
- Oval/Bumper = parametrik motor zorlamaz → **Die-cut şablon galerisinde** preset olarak kalır (yeni POC motoru gerektirmez).
- Hazır şekil = sadece Yuvarlak(circle) + Kare/Dikdörtgen(rect). Oval/Bumper galeride.
- Çevresel (hull) = Özel kesim altında "Geniş" alt-seçimi (ayrı top-level değil).
- `deriveEditorProductHint` (circle→Sticker/rect→Etiket) ve ürün handoff DEĞİŞMEZ.
