# Editör UI/UX Bulguları — Canlı İnceleme (1 Haz)

Claude pimetiket.com/editor'ü canlıda gezdi (görsel yükle → bıçak → boyut → ürüne ekle). Kontur ARTIK
çalışıyor (POC iframe). Sorunlar UI/UX katmanında. Önem sırasıyla.

## 🔴 P0 — Akışı bozan / kafa karıştıran

### 1. Çelişkili durum mesajı: kontur VAR ama "üretilemedi" diyor
Analiz panelinde kırmızı uyarı **"Bıçak çizgisi üretilemedi. Görüntüyü kontrol edin."** — AMA önizlemede
magenta kontur düzgün görünüyor (daire+kare temiz sarılmış). Stale/yanlış durum. Kullanıcı "hata mı var?"
diye paniklar, oysa her şey yolunda. Durum state'i iframe postMessage ile senkronlanmıyor.
**Etki:** Kullanıcı çalışan tasarımı "bozuk" sanıp terk eder.

### 2. Baskı boyutu (mm) GİRİŞİ YOK — sadece okuma
`Genişlik/Yükseklik mm` input alanı YOK (0 number input). "Baskı boyutu 50.8×33.9mm" yalnızca Analiz
panelinde **okunabilir** etiket — kullanıcı baskı ölçüsünü DEĞİŞTİREMİYOR. Editörün temel işlerinden biri
"ebatlandırma" (memory: 4 işlemden biri). Boyut iframe içinde mi? Dışarıda kontrol yok.
**Etki:** Kullanıcı "1 lira boyutu / 5cm" gibi ölçü veremiyor — vizyonun çekirdeği eksik.

### 3. Sayfa aşırı uzun — her şey scroll arkasında (2.4× viewport)
Sayfa yüksekliği 2290px, viewport 945px → **2.4 kat scroll.** iframe tek başına 1413px (ekranın 1.5 katı).
Kullanıcı: önizlemeyi görmek için scroll, boyut/katman için scroll, "ürüne ekle" için scroll. Hiçbir an
tasarım + kontroller + CTA aynı ekranda değil.
**Etki:** "Ne yapacağımı göremiyorum" — özellikle ilk kullanımda kaybolma.

### 4. İlk yüklemede önizleme alt yarıda + üstte koca boş alan
Görsel yüklenince kontur canvas'ın ALT yarısında beliriyor, üstte ~300px boş checkerboard. Görsel
otomatik ortalanmıyor/sığdırılmıyor. Kullanıcı tasarımını görmek için scroll etmek zorunda.
**Etki:** İlk izlenim "boş/bozuk" — oysa tasarım aşağıda.

## 🟡 P1 — Karışıklık / tutarsızlık

### 5. Çift aksiyon: üstte "Sticker/Etiket'e ekle" + altta "Kaydet"
Üst barda "Sticker'a ekle"/"Etiket'e ekle" (sipariş handoff), alt barda "Ayarlar"+"Kaydet" (yeşil). İki
ayrı aksiyon seti — kullanıcı hangisiyle ilerleyecek belirsiz. "Kaydet" ne kaydediyor? "Ekle"den farkı ne?
**Etki:** Karar yorgunluğu, yanlış buton.

### 6. "Sticker/Etiket'e ekle" görsel yokken de görünür (disabled belirsiz)
Boş editörde üst bar CTA'ları soluk/disabled ama neden tıklanamadığı belli değil (görsel yükle ipucu yok).

### 7. Malzeme tipi tek seçenek görünüyor ("Normal kağıt")
MALZEME TİPİ panelinde tek kart var. Sticker malzemeleri (vinil/şeffaf/holo) burada mı, iframe'de mi?
Editör dışı panel ile iframe içi malzeme seçimi çakışıyor olabilir (çift kaynak).

### 8. Katman toggle'ları (Beyaz/Bleed/Safe) işlevsiz olabilir
4 toggle var (Bıçak açık, diğer 3 kapalı). Açınca önizlemede gerçekten katman beliriyor mu doğrulanmadı —
eski mimaride setLayerVisibility no-op'tu, POC iframe'de bağlı mı kontrol edilmeli.

## 🟢 P2 — Cila

### 9. "Kesim mesafesi / Yumuşatma" slider'ları iframe'i mi besliyor?
Dış panel slider'ları (offset/smoothness) iframe içindeki POC'a postMessage ile gidiyor mu, yoksa ölü mü?
Test edilmeli — gitmiyorsa kafa karıştırıcı ölü kontrol.

### 10. Analiz paneli teknik jargon (ALPHA, PATH DÜĞÜMÜ)
"Alpha: Var", "Path düğümü: 0" — son kullanıcı için anlamsız teknik veri. Gizlenebilir veya sadeleştirilebilir.

### 11. "Sıfırla" + zoom kontrolleri sağ üstte, CTA sağ üstte — üst bar kalabalık

---

## KÖK SORUN (mimari gözlem)
Editör = **dış React panel (boyut/malzeme/katman/analiz) + iç POC iframe (canvas/kontur).** İki katman
**senkronize değil**: durum mesajı (P0.1), boyut kontrolü (P0.2), katman/slider'ların iframe'e ulaşması
(P1.8, P2.9) hep bu kopuklukта. Dış panel iframe'in gerçek durumunu yansıtmıyor.

**Öneri yönü:** Dış panel ile iframe arasındaki postMessage köprüsü gözden geçirilmeli — ya dış panel
iframe state'ini doğru yansıtsın (durum/boyut/katman senkron), ya da çakışan kontroller (malzeme, boyut)
tek yerde toplansın (tercihen iframe içinde, POC zaten yapıyor; dış panel sadeleşsin).

## SONRAKİ ADIM
Bu liste önceliklendirilmiş. Sefa hangilerini düzeltmek istediğini seçince Cursor prompt'u hazırlanır.
P0'lar (durum mesajı + boyut girişi + scroll/layout) en yüksek etki.
