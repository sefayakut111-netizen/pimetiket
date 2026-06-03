// Pim Etiket — Terim Sözlüğü verisi (Sefa onaylı Excel'den üretildi, A-Z Türkçe).
// Kaynak: docs/Pim-Etiket-Terim-Sozlugu.xlsx — düzenleme orada yapılır, bu dosya yeniden üretilir.

export interface Terim {
  terim: string;
  ingilizce: string;
  aciklama: string;
  /** Kategori — kart altında çip (kullanım alanı) olarak gösterilir */
  kategori: string;
}

export const TERIMLER: Terim[] = [
  { terim: "Adet / Tiraj", ingilizce: "Quantity / Run", aciklama: "Basılacak toplam ürün sayısı; arttıkça birim fiyat düşer.", kategori: "Ölçü & Ticari" },
  { terim: "Akrilik yapışkan", ingilizce: "Acrylic adhesive", aciklama: "En çok kullanılan yapışkan türü; su ve UV'ye dayanıklı, uzun ömürlü. Çoğu sticker ve etikette standarttır.", kategori: "Malzeme" },
  { terim: "CMYK", ingilizce: "CMYK", aciklama: "Baskının kullandığı 4 renk sistemi (Camgöbeği-Magenta-Sarı-Siyah). Tasarım CMYK olmalı.", kategori: "Baskı & Dosya" },
  { terim: "Die-cut (Özel kesim)", ingilizce: "Die-cut", aciklama: "Tasarımın dış hattına (silüetine) birebir kesim; her parça kendi şeklinde, tek tek hazır çıkar.", kategori: "Kesim & Üretim" },
  { terim: "Donuk (Freezer) yapışkan", ingilizce: "Freezer-grade adhesive", aciklama: "Soğuk, nemli ve dondurulmuş ürün yüzeylerinde tutması için geliştirilen özel yapışkan.", kategori: "Malzeme" },
  { terim: "DPI / Çözünürlük", ingilizce: "DPI / Resolution", aciklama: "Baskı netliği. Net baskı için minimum 300 DPI önerilir.", kategori: "Baskı & Dosya" },
  { terim: "Emboss / Kabartma", ingilizce: "Emboss", aciklama: "Yüzeyde dokunulabilen 3 boyutlu kabartma etkisi.", kategori: "Kaplama & Sonlandırma" },
  { terim: "Fason / Üretim ortağı", ingilizce: "Contract manufacturer", aciklama: "Baskıyı yapan anlaşmalı üretim atölyesi/ortağı.", kategori: "Ölçü & Ticari" },
  { terim: "Fire", ingilizce: "Waste", aciklama: "Dizilim sırasında kullanılamayan, atılan boş malzeme alanı.", kategori: "Kesim & Üretim" },
  { terim: "Folyo (Vinil)", ingilizce: "Vinyl film", aciklama: "Su ve UV'ye dayanıklı, plastik esaslı sticker malzemesi. Dış mekana uygun.", kategori: "Malzeme" },
  { terim: "Göbek / Core", ingilizce: "Core", aciklama: "Rulonun iç karton çapı (örn. 40mm, 76mm).", kategori: "Form & Sarım" },
  { terim: "Hediye adet", ingilizce: "Bonus quantity", aciklama: "Üretimde fazladan çıkan ve müşteriye ücretsiz eklenen ürünler.", kategori: "Ölçü & Ticari" },
  { terim: "Holografik (Hologram)", ingilizce: "Holographic", aciklama: "Işıkta gökkuşağı yansıması veren parlak metalik yüzey.", kategori: "Malzeme" },
  { terim: "Hotmelt (Sıcak eriyik) yapışkan", ingilizce: "Hot-melt adhesive", aciklama: "Güçlü ilk yapışma sağlayan ekonomik yapışkan; çok yüksek/düşük sıcaklıklarda performansı düşebilir.", kategori: "Malzeme" },
  { terim: "Kalıcı / Çıkarılabilir yapışkan", ingilizce: "Permanent / Removable", aciklama: "Kalıcı: söküldüğünde iz veya yırtık bırakır. Çıkarılabilir: temiz sökülür, yeniden konumlandırılabilir.", kategori: "Malzeme" },
  { terim: "Kartlı kesim", ingilizce: "Carded", aciklama: "Sticker kendi dikdörtgen kartında gelir; dış kart tam kesim, içteki sticker yarım kesimli.", kategori: "Kesim & Üretim" },
  { terim: "KDV", ingilizce: "VAT", aciklama: "Katma Değer Vergisi (%20). Gösterilen fiyatlara dahildir.", kategori: "Ölçü & Ticari" },
  { terim: "Kiss-cut (Yarı kesim)", ingilizce: "Kiss-cut", aciklama: "Sadece üst katman kesilir, arka kağıt bütün kalır; stickerlar tek tek soyularak çıkarılır.", kategori: "Kesim & Üretim" },
  { terim: "Kontur / Bıçak hattı", ingilizce: "Cutline", aciklama: "Kesim makinesinin izleyeceği çizgi; tasarımın nereden kesileceğini belirler.", kategori: "Kesim & Üretim" },
  { terim: "Kraft", ingilizce: "Kraft", aciklama: "Doğal kahverengi, dokulu, geri dönüşümlü kağıt; doğal/butik görünüm.", kategori: "Malzeme" },
  { terim: "Kuşe", ingilizce: "Coated paper", aciklama: "Pürüzsüz, kaplı (coated) baskı kağıdı; mat veya parlak olabilir. Standart kağıt etiket malzemesi.", kategori: "Malzeme" },
  { terim: "Lak / Vernik", ingilizce: "Varnish", aciklama: "Yüzeyi koruyan ve görünümü iyileştiren ince kaplama.", kategori: "Kaplama & Sonlandırma" },
  { terim: "Laminasyon", ingilizce: "Lamination", aciklama: "Baskının üzerine çekilen koruyucu şeffaf film katmanı; çizilme ve suya karşı korur.", kategori: "Kaplama & Sonlandırma" },
  { terim: "Liner / Arka kağıt", ingilizce: "Liner / Backing", aciklama: "Sticker'ın arkasındaki taşıyıcı kağıt; uygulamadan önce soyulur.", kategori: "Malzeme" },
  { terim: "Mat", ingilizce: "Matte", aciklama: "Yansımasız, premium dokunuş hissi veren yüzey.", kategori: "Kaplama & Sonlandırma" },
  { terim: "Metalize", ingilizce: "Metallized", aciklama: "Parlak metalik (gümüş/altın) yüzeyli malzeme.", kategori: "Malzeme" },
  { terim: "Mockup", ingilizce: "Mockup", aciklama: "Ürünün gerçekte nasıl görüneceğini gösteren dijital önizleme.", kategori: "Baskı & Dosya" },
  { terim: "m² (metrekare)", ingilizce: "Square meter", aciklama: "Sticker fiyatının hesaplandığı alan birimi.", kategori: "Ölçü & Ticari" },
  { terim: "Opak", ingilizce: "Opaque", aciklama: "Arkası görünmeyen, ışık geçirmeyen yüzey; altındaki rengi kapatır.", kategori: "Malzeme" },
  { terim: "Opak PP", ingilizce: "Opaque PP", aciklama: "Yırtılmaz, suya dayanıklı beyaz plastik etiket malzemesi.", kategori: "Malzeme" },
  { terim: "Pantone (Spot renk)", ingilizce: "Pantone", aciklama: "Standart renk kataloğu; tutarlı kurumsal renk için kullanılır.", kategori: "Baskı & Dosya" },
  { terim: "Parlak", ingilizce: "Gloss", aciklama: "Canlı renk veren parlak yüzey.", kategori: "Kaplama & Sonlandırma" },
  { terim: "Plotter", ingilizce: "Plotter / Cutter", aciklama: "Vinil/folyo malzemeyi bilgisayar kontrolüyle kesen kesim makinesi.", kategori: "Kesim & Üretim" },
  { terim: "Plotter tabaka", ingilizce: "Plotter sheet", aciklama: "Plotter/baskı makinasında basılan uzun ham tabaka; henüz tek tek ürünlere ayrılmamış üretim formu.", kategori: "Kesim & Üretim" },
  { terim: "Prova", ingilizce: "Proof", aciklama: "Baskı öncesi müşteri onayı için hazırlanan örnek görsel.", kategori: "Baskı & Dosya" },
  { terim: "Raster / Piksel dosya", ingilizce: "Raster", aciklama: "Büyütülünce bozulan piksel tabanlı dosya (PNG, JPG).", kategori: "Baskı & Dosya" },
  { terim: "RGB", ingilizce: "RGB", aciklama: "Ekran renk sistemi; baskıda CMYK'ya çevrilir, renkler hafif değişebilir.", kategori: "Baskı & Dosya" },
  { terim: "Rulo etiket", ingilizce: "Roll label", aciklama: "Rulo halinde sarılı; makineyle hızlı yapıştırma için. Yüksek adetlerde ekonomik.", kategori: "Form & Sarım" },
  { terim: "Sarım yönü", ingilizce: "Wind direction", aciklama: "Etiketin ruloda dışa mı içe mi baktığı (otomatik makineler için önemli).", kategori: "Form & Sarım" },
  { terim: "Selefon", ingilizce: "Lamination film", aciklama: "Laminasyon filmi (mat veya parlak).", kategori: "Kaplama & Sonlandırma" },
  { terim: "Sıcak Yaldız", ingilizce: "Hot foil", aciklama: "Isı ve baskıyla uygulanan metalik folyo (altın, gümüş vb.).", kategori: "Kaplama & Sonlandırma" },
  { terim: "Simli (Glitter)", ingilizce: "Glitter", aciklama: "Parıltılı, taneli dokulu yüzey; hediye ve çocuk ürünlerinde popüler.", kategori: "Malzeme" },
  { terim: "Soft Touch", ingilizce: "Soft touch", aciklama: "Kadife gibi pürüzsüz dokunma hissi veren mat laminasyon.", kategori: "Kaplama & Sonlandırma" },
  { terim: "Spot UV", ingilizce: "Spot UV", aciklama: "Belirli alanlara uygulanan parlak şeffaf vernik; vurgulu detay etkisi.", kategori: "Kaplama & Sonlandırma" },
  { terim: "Şeffaf (Transparan)", ingilizce: "Clear / Transparent", aciklama: "Saydam zemin; altındaki yüzey görünür. Cam ve açık renk uygulamalar için.", kategori: "Malzeme" },
  { terim: "Tabaka", ingilizce: "Sheet", aciklama: "Birden çok ürünün tek bir levha/sayfa üzerinde dizili hali (elle uygulama veya toplu kesim).", kategori: "Kesim & Üretim" },
  { terim: "Tabaka etiket", ingilizce: "Sheet label", aciklama: "Düz levha halinde; elle uygulama için. Düşük adetlerde uygun.", kategori: "Form & Sarım" },
  { terim: "Tabaka sticker / etiket", ingilizce: "Sticker / label sheet (kiss-cut)", aciklama: "Kullanıcıya ulaştırılan, üzerinde birden fazla etiket/sticker bulunan yarım kesilmiş (kiss-cut) tek parça ürün.", kategori: "Form & Sarım" },
  { terim: "Taşma payı (Bleed)", ingilizce: "Bleed", aciklama: "Kesimde beyaz kalmaması için tasarımın kenardan dışarı taşırılan kısmı.", kategori: "Baskı & Dosya" },
  { terim: "Ultra Clear", ingilizce: "Ultra clear", aciklama: "Tamamen şeffaf, kenarları belli olmayan 'görünmez' film etkisi.", kategori: "Malzeme" },
  { terim: "Varak", ingilizce: "Foil", aciklama: "Metalik/yaldız folyo kaplama.", kategori: "Kaplama & Sonlandırma" },
  { terim: "Vektörel dosya", ingilizce: "Vector", aciklama: "Bozulmadan büyütülebilen dosya türü (AI, EPS, PDF). Baskı için ideal.", kategori: "Baskı & Dosya" },
];
