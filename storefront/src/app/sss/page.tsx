/**
 * Pim Etiket — /sss
 *
 * Sıkça sorulan sorular — 11 kategori tab + accordion. Hibrit format
 * (1 cümle özet + detay paragraf). TR ana, EN minimum fallback.
 *
 * Sefa 18 May v68 (sss-genişleme): 5 kategori 15 soru → 11 kategori 73 soru.
 */

"use client";

import { useState, useEffect } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";
import { SchemaJsonLd, faqSchema } from "@/components/SchemaJsonLd";

type Category =
  | "siparis"
  | "tasarim"
  | "malzeme"
  | "kesim"
  | "boyut"
  | "fiyat"
  | "uretim"
  | "iade"
  | "onizleme"
  | "kvkk"
  | "yardim";

interface FaqItem {
  q: string;
  summary: string;
  detail: string;
}

const CATEGORIES_TR: { id: Category; name: string }[] = [
  { id: "siparis", name: "Sipariş & Ödeme" },
  { id: "tasarim", name: "Tasarım & Dosya" },
  { id: "malzeme", name: "Malzeme & Teknik" },
  { id: "kesim", name: "Etiket Türü & Kesim" },
  { id: "boyut", name: "Boyut & Adet" },
  { id: "fiyat", name: "Fiyat & İndirim" },
  { id: "uretim", name: "Üretim & Teslim" },
  { id: "iade", name: "İade & Garanti" },
  { id: "onizleme", name: "Önizleme" },
  { id: "kvkk", name: "KVKK & Güvenlik" },
  { id: "yardim", name: "Yardım" },
];

const CATEGORIES_EN: { id: Category; name: string }[] = [
  { id: "siparis", name: "Order & Payment" },
  { id: "tasarim", name: "Design & Files" },
  { id: "malzeme", name: "Material & Technical" },
  { id: "kesim", name: "Label Type & Cut" },
  { id: "boyut", name: "Size & Quantity" },
  { id: "fiyat", name: "Price & Discount" },
  { id: "uretim", name: "Production & Delivery" },
  { id: "iade", name: "Returns & Warranty" },
  { id: "onizleme", name: "Preview" },
  { id: "kvkk", name: "KVKK & Security" },
  { id: "yardim", name: "Help" },
];

const FAQS_TR: Record<Category, FaqItem[]> = {
  siparis: [
    {
      q: "Pim Etiket'te nasıl sipariş verilir?",
      summary:
        "Etiket veya sticker sayfasındaki konfigüratörü tamamlayıp sepete ekleyerek online ödeme ile siparişinizi oluşturabilirsiniz.",
      detail:
        "Pim Etiket sipariş akışı tek sayfa konfigüratör üzerinden yürütülür: etiket türü veya kesim tipi seçimi → malzeme → kaplama veya yüzey → boyut → tasarım → adet. Her adımda canlı önizleme ekranı, seçimlerinizin son ürün üzerindeki etkisini gerçek zamanlı gösterir. Tasarım dosyanızı sipariş anında yüklemek zorunda değilsiniz; siparişiniz onaylandıktan sonra panel üzerinden de yükleme yapılabilir. Sepete eklenen ürünün KDV dahil son fiyatı ve tahmini teslim tarihi otomatik olarak görüntülenir.",
    },
    {
      q: "Sipariş vermek için üye olmak zorunlu mudur?",
      summary:
        "Tasarım yükleme ve sipariş takibi için üyelik gereklidir; konfigüratör ve fiyat görüntüleme misafir olarak da kullanılabilir.",
      detail:
        "Pim Etiket sisteminde tasarım dosyaları, KVKK 6698 sayılı kanun uyumlu olarak yalnızca kullanıcının erişebileceği kişisel depolama alanında saklanır. Bu güvenlik politikası gereği dosya yükleme işlemi için üye girişi zorunludur. Üyelik işlemi yalnızca e-posta ve şifre ile 30 saniyede tamamlanır. Üyelik avantajları arasında sipariş geçmişi takibi, yeniden basım kolaylığı, çoklu fatura adresi tanımlama ve özel kampanya bildirimleri yer alır.",
    },
    {
      q: "Hangi ödeme yöntemlerini kabul ediyorsunuz?",
      summary:
        "Visa, Mastercard, Troy ve American Express kartları ile PayTR Sanal POS üzerinden 3D Secure güvenli ödeme kabul edilmektedir.",
      detail:
        "Pim Etiket'in ödeme altyapısı, BDDK lisanslı PayTR Sanal POS sistemidir. Türkiye'de en yaygın kullanılan ödeme aracılarından biri olan PayTR, PCI-DSS sertifikalı altyapısıyla kart bilgilerinizin güvenli işlenmesini sağlar. Her ödeme işlemi 3D Secure 2.0 standardına uygun olarak bankanız tarafından SMS veya mobil uygulama doğrulamasıyla onaylanır. Kapıda ödeme, havale/EFT ve kripto para ödeme yöntemleri kabul edilmemektedir. Kurumsal toplu siparişler için özel ödeme koşulları WhatsApp üzerinden görüşülebilir.",
    },
    {
      q: "Kredi kartı bilgilerim güvende mi?",
      summary:
        "Evet, tüm ödemeler 3D Secure 2.0 ile bankanız üzerinden doğrulanır ve kart bilgileri Pim Etiket sunucularında saklanmaz.",
      detail:
        "Kart bilgileri, PayTR'ın PCI-DSS Level 1 sertifikalı altyapısında işlenir; Pim Etiket sunucularına hiçbir aşamada iletilmez. Sistem yalnızca ödemenin başarılı veya başarısız sonucunu callback olarak alır. CVV kodu hiçbir şekilde saklanmaz, kart numarası tokenize edilerek anonimleştirilir. Bu yapı sayesinde Pim Etiket, PCI-DSS uyum kapsamı dışında kalır ve kart verisi sızıntısı riski sıfırlanır.",
    },
    {
      q: "Kapıda ödeme seçeneği bulunuyor mu?",
      summary:
        "Hayır, Pim Etiket'te yalnızca online kart ile ödeme kabul edilmektedir.",
      detail:
        "Tüketicinin Korunması Hakkında Kanun (TKHK) madde 15/b uyarınca, kişiye özel olarak üretilen ürünlerde cayma hakkı bulunmadığından, kapıda ödeme yöntemi Pim Etiket'in iş modeli için uygun değildir. Üretimi tamamlanan özel siparişlerin teslimat sırasında reddedilmesi durumunda doğacak maliyet riski nedeniyle bu yöntem desteklenmemektedir. Kurumsal toplu siparişler için banka havalesi/EFT seçeneği müşteri temsilcimiz üzerinden talep edilebilir.",
    },
    {
      q: "Taksitli ödeme yapabilir miyim?",
      summary:
        "Bankanızın kart taksitlendirme kampanyaları PayTR ödeme ekranında otomatik olarak listelenir.",
      detail:
        "Pim Etiket, taksit işlemleri için ek komisyon talep etmez. Ödeme sayfasında kartınızın bağlı olduğu bankanın güncel taksit kampanyası otomatik olarak gösterilir. Tek çekim ödeme seçeneği her durumda mevcuttur. 500 TL altındaki siparişlerde bazı bankaların kart politikası gereği taksit seçeneği görüntülenmeyebilir.",
    },
    {
      q: "Fatura nasıl ve ne zaman kesilir?",
      summary:
        "E-arşiv faturanız sipariş onayını takip eden 7 iş günü içinde kayıtlı e-posta adresinize iletilir.",
      detail:
        "Pim Etiket faturalarını şahıs işletmesi statüsünde (Sefa Yakut, Alemdağ Vergi Dairesi, Vergi No: 9290558622) düzenler. Bireysel siparişlerde e-arşiv fatura, ticari siparişlerde e-fatura formatında düzenleme yol haritamızdadır. Şirket adına fatura için sepet ekranında \"Şirket adına\" seçeneğini işaretleyerek vergi numaranızı girmeniz yeterlidir. Vergi mevzuatı uyarınca fatura, sipariş tarihinden itibaren 7 takvim günü içinde kesilir.",
    },
    {
      q: "Şirket adına fatura düzenlenebilir mi?",
      summary:
        "Evet, sepet ekranında 'Şirket adına' seçeneğiyle unvan, VKN ve vergi dairesi bilgilerini girmeniz yeterlidir.",
      detail:
        "Kurumsal müşterilerimiz için e-arşiv fatura unvan, vergi kimlik numarası (VKN) ve bağlı bulunulan vergi dairesi bilgileri ile düzenlenir. Tüm fiyatlar KDV %20 dahil olarak görüntülenir; fatura üzerinde matrah ve KDV tutarı ayrı satırlarda detaylandırılır. E-fatura mükellefiyseniz, e-fatura entegrasyonumuz devreye alındığında otomatik aktarım sağlanacaktır.",
    },
    {
      q: "Sipariş onay bildirimi nereden iletilir?",
      summary:
        "Sipariş onayı, üyelik e-postanıza anında gönderilir; ayrıca panel üzerinden de görüntülenebilir.",
      detail:
        "Sipariş tamamlandığı anda sipariş özetinizi ve tahmini teslim tarihinizi içeren onay e-postası info@pimetiket.com adresinden iletilir. Olası teslimat aksaklıklarını önlemek için e-postanızın spam klasörünü de kontrol etmenizi öneririz. Sipariş geçmişiniz ve aşama bilgileri /panelim/siparislerim sayfasında gerçek zamanlı olarak görüntülenir. Üretime giriş ve kargo teslim bildirimleri de aynı kanaldan gönderilir.",
    },
    {
      q: "Verdiğim siparişi iptal edebilir miyim?",
      summary:
        "Siparişiniz üretime girmediği sürece panel üzerinden iptal edilebilir; üretime girdikten sonra iptal mümkün değildir.",
      detail:
        "Sipariş onayını takip eden 2 saat içinde, üretim hazırlığı başlamadan önce /panelim/siparislerim sayfasından iptal işlemi gerçekleştirilebilir. Bu süre sonunda sipariş üretim hattına aktarıldığı için, TKHK madde 15/b kapsamında kişiye özel üretilen ürünler için cayma hakkı bulunmamaktadır. İptal süreciyle ilgili sorularınız için müşteri hizmetlerimiz size yardımcı olur.",
    },
  ],
  tasarim: [
    {
      q: "Hangi dosya formatlarını kabul ediyorsunuz?",
      summary: "PDF, PNG, AI, PSD, EPS — toplam 5 format.",
      detail:
        "En sağlıklı sonuç için PDF (X-1a) veya AI önerilir — vektör, font outline, renk profili korunur. PNG ile gönderirsen tasarım rasterized olur (ölçek değişimi pixel kaybı yapabilir, 300 DPI önerilir). JPEG ve SVG kabul etmiyoruz — JPEG sıkıştırma artefaktları matbaada belirgin, SVG ise font/renk varyasyonu riskli.",
    },
    {
      q: "Dosya boyutu limiti nedir?",
      summary: "Dosya başına max 30 MB, sipariş başına 50 dosyaya kadar.",
      detail:
        "PDF için 30 MB genelde yüksek çözünürlük + birden fazla sayfa için yeterli. Daha büyük dosyan varsa: PDF/X-1a'ya optimize et (Adobe Acrobat → Save As → Optimized PDF), veya WhatsApp üzerinden gönder, biz upload edelim.",
    },
    {
      q: "Tasarımı şimdi yüklemek zorunda mıyım?",
      summary:
        "Hayır, sipariş onayından sonra detay sayfasından da yükleyebilirsin.",
      detail:
        "Konfigüratörde 'Tasarımı şimdi yükle' alanı opsiyonel — mockup'ta nasıl duracağını görmek için ön yükleme yapabilirsin ama sipariş onayını bekletmez. Üretim sadece tasarım yüklendikten sonra başlar, o yüzden teslim süresini hızlandırmak için en kısa zamanda yükle.",
    },
    {
      q: "Çözünürlük kaç olmalı?",
      summary: "300 DPI (gerçek boyutta) — fotoğraf-baskı kalitesi standardı.",
      detail:
        "Tasarım web ekranında 72 DPI yeterli görünebilir ama matbaada bulanık çıkar. Photoshop'ta Image → Image Size → Resolution: 300 ppi, vektör programda zaten ölçek bağımsız. Düşük DPI yüklersen sistem uyarı verir, devam etmek istersen ön denetim WARNING döner.",
    },
    {
      q: "CMYK mi RGB mi?",
      summary:
        "CMYK önerilir; RGB gönderirsen baskı öncesi otomatik dönüştürürüz, renk hafif kayabilir.",
      detail:
        "Ekranın RGB (yayılan ışık) ile basılı kağıdın CMYK (yansıyan mürekkep) renk uzayları farklı — özellikle parlak kırmızılar, neon renkler, koyu maviler. Tasarım programında dosya modunu CMYK olarak ayarla. Pantone spot renk işleri için lütfen sipariş sonrası WhatsApp'tan bize ulaş.",
    },
    {
      q: "Bleed (taşma payı) nasıl ayarlanır?",
      summary:
        "Her kenardan 2-3 mm bleed ekle, önemli içeriği iç güvenli alandan 3 mm uzak tut.",
      detail:
        "Etiket 60×80 mm istiyorsan tasarım dosyası 64×84 mm olmalı (2 mm bleed her kenarda). Yazılar, logo, kritik öğeler kesim çizgisinden 3 mm içeride kalsın — matbaa toleransı +/- 0.5 mm. Mockup önizlemede bleed alanı sınırı görünmez ama hesap dahildir.",
    },
    {
      q: "Yazılarımı outline yapmam gerekir mi?",
      summary:
        "Evet — fontu bizde yoksa otomatik değiştirilmesin diye outline'a çevir.",
      detail:
        "Illustrator'da: Type → Create Outlines (Cmd/Ctrl+Shift+O). Photoshop'ta: katmanı rasterize et veya smart object'e çevir. PDF dışa aktarırken 'Embed All Fonts' seçili olsun. Outline yapılmamış PDF'lerde font yoksa ön denetim FATAL warning verir, üretim bekletilir.",
    },
    {
      q: "Tasarımı kendim yapabilir miyim, hangi araçları kullanmalıyım?",
      summary:
        "Canva, Adobe Express, Figma gibi ücretsiz online araçlarla hazırla; PDF veya PNG indir, sisteme yükle.",
      detail:
        "Bizim dahili şablon kütüphanemiz yok — ama internette ücretsiz ve kolay tasarım araçları çok. En yaygınları: Canva (binlerce hazır etiket/sticker şablonu), Adobe Express (basit ve hızlı), Figma (free tier, profesyonel görünüm), VistaCreate/Crello. Hangisini seçersen seç, tasarımı bitirince **PDF veya PNG** olarak indir ve buraya yükle. Pim sohbet'e (sağ alt) ürün/sektör adını yaz — sana uygun renk, font, kompozisyon önerisi verir. Profesyonel grafiker desteği için WhatsApp'tan yönlendirme yapabiliriz.",
    },
    {
      q: "Çoklu tasarım nasıl çalışır?",
      summary:
        "Aynı siparişte birden fazla farklı tasarım yükleyebilirsin, otomatik indirim uygulanır.",
      detail:
        "Konfigüratörde 'Tasarım sayısı' inputuna yaz: 2-3 → %2, 4-5 → %4, 6-10 → %6, 11-25 → %8, 26-50 → %10 indirim. Her tasarımdan girdiğin adet kadar basılır (örn 3 tasarım × 1000 = 3000 etiket). Setup maliyeti dağıldığı için birim fiyat düşer.",
    },
    {
      q: "Tasarımıma müdahale ediyor musunuz?",
      summary:
        "Hayır, tasarım olduğu gibi basılır; sadece ön denetimde teknik uyarı veririz.",
      detail:
        "Ön denetim otomatik AI kontrolü + matbaa elcek (gerekirse): DPI, font outline, taşma, mürekkep doygunluğu (>320%). Sorun bulursak 'Onay bekleniyor' diye iletiriz, sen düzeltip yeniden yükleyebilirsin. İçeriğe asla müdahale etmiyoruz (renk değişikliği, metin düzeltme yapmıyoruz — özel istek değilse).",
    },
  ],
  malzeme: [
    {
      q: "Hangi malzemeyi seçmeliyim?",
      summary:
        "Ürünün ortamı belirler: gıda → kuşe/kraft, su/buzdolabı → opak PP, premium → metalik, cam şişe → ultra clear.",
      detail:
        "/malzemeler sayfasında her malzeme için 'Nerede kullanılır + Yüzey + Dayanım' detayları var. Karar veremezsen sepete eklemeden önce Pim sohbet butonuna ürün adını yaz (örn 'balsamik sirke şişesi etiketi'), uygun malzeme önerir.",
    },
    {
      q: "Kuşe ile Kraft farkı ne?",
      summary:
        "Kuşe = pürüzsüz beyaz parlak kağıt (renkleri canlı); Kraft = kahverengi doğal lifli kağıt (organik / el yapımı hissi).",
      detail:
        "Kuşe genel amaçlı — ev temizlik, kozmetik, gıda, ilaç. Kraft daha eko/doğallık vurgusu yapan markalar için — el yapımı sabun, organik gıda, baharat, çay. Kraft'a baskı doğal olarak daha mat görünür, beyaz mürekkep basmıyoruz (basit ofset).",
    },
    {
      q: "Opak PP nedir?",
      summary: "Polipropilen plastik etiket — yırtılmaz, suya/yağa dayanıklı.",
      detail:
        "PP (polipropilen), kağıttan farklı olarak ıslanınca yırtılmaz, donmaya dayanır, yağ emmez. Buzdolabı, dondurucu, soğuk zincir gıda, sıvı sabun, deterjan, şampuan ürünleri için ideal. Kağıt etiketin 'kıvrılma/sararma' sorunu olmaz.",
    },
    {
      q: "Ultra Clear ile Şeffaf Etiket farkı ne?",
      summary:
        "Ultra Clear tamamen film (görünmez, makine uygulama); Şeffaf Etiket kağıt-bazlı saydam (elle uygulama).",
      detail:
        "Ultra Clear cam berraklığında — sadece basılan tasarım görünür, etiket sınırı belli olmaz. Profesyonel cam şişe, parfüm, premium içecek için. Ama elle yapıştırmaya uygun değildir — kayar, hava kabarcığı yapar, otomatik aplikatör makine gerekir. Şeffaf Etiket daha standart film, elle uygulanır.",
    },
    {
      q: "Metalize Etiket parıltı kaybeder mi?",
      summary: "Hayır, alüminyum kaplama; UV/su/temas dayanıklı.",
      detail:
        "Metalize Etiket gümüş alüminyum + akrilik koruma katmanı — premium çikolata, şarap, viski, parfüm etiketlerinde standart. Renkler bu metalik zemin üzerinde 'yumuşak' görünür çünkü beyaz mürekkep basmıyoruz, opak vurgu istiyorsan tasarımda parlak/koyu renk seç.",
    },
    {
      q: "Mat / Parlak Selefon ne işe yarar?",
      summary:
        "Etiket üzerine koruyucu film kaplaması; çiziklerden korur, görünümü değiştirir.",
      detail:
        "Parlak Selefon: yansıma yüksek, renkler canlı, klasik perakende. Mat Selefon: yansıma yok, premium / sade his, dokunduğunda yumuşak. Su geçirmezlik artar, çizik dayanımı %200+ olur. Etiket fiyatına +%10-15 ekler.",
    },
    {
      q: "Soft Touch nedir?",
      summary:
        "Kadife / şeftali kabuğu dokusunda mat kaplama — yüksek kalite hissi.",
      detail:
        "Soft Touch, parmak ucuyla dokunulduğunda hissedilen yumuşak doku verir. Kozmetik, parfüm, premium hediye etiketlerinde tercih edilir. Klasik mat selefondan +%30-40 fiyatlı, ama 'ürün lüks görünsün' hissi yaratır. Sadece rulo etiket modunda mevcut (tabaka'da yok).",
    },
    {
      q: "Spot UV, Emboss ve Sıcak Yaldız kombine olur mu?",
      summary: "Evet, üçü birden uygulanabilir (rulo etiket modunda).",
      detail:
        "Konfigüratörde Özelleştirme adımında multi-select — birden fazla seçebilirsin. Her ek özellik fiyatı çarpar (örn yaldız ×1.25 + spot UV ×1.30 = ~1.6x). Tasarımda hangi alana hangi özellik uygulanacağını PDF'te ayrı katman olarak gönder (spot UV katmanı 'SpotUV' isimli, sıcak yaldız katmanı Pantone numarası).",
    },
    {
      q: "Holografik vs Simli stickerda fark ne?",
      summary:
        "Holografik = ışıkta gökkuşağı renkleri (düz iridescent); Simli = içinde parıltı taneleri (glitter).",
      detail:
        "Holografik düz bir film, ışık açısına göre renk kayar (baklava efekti yaygın). Simli daha 'festival/parti' hissi, taneler ışığı kırarak parıldar. Etkinlik, çocuk ürünleri, kırtasiye için ideal. İç mekanda her ikisi de uzun ömürlü, dış mekanda 6-12 ay sonra mat'lanabilir.",
    },
    {
      q: "Sticker dış mekanda kaç yıl dayanır?",
      summary: "Vinil 3-5 yıl; Holografik/Simli 6-12 ay (sonra solar).",
      detail:
        "Vinil UV ve neme dayanıklı — laptop, su şişesi, araba, vitrin sticker için. Çamaşır makinesi tehlikesi değil (60°C bile kalıyor). Holografik/simli özel filmler dış mekan UV'sine daha duyarlı, iç mekan optimum. Transparan vinil vinil ile aynı dayanım, sadece şeffaf zemin.",
    },
  ],
  kesim: [
    {
      q: "Rulo etiket ile Tabaka etiket farkı?",
      summary:
        "Rulo = silindirde sarılı, otomatik makine için; Tabaka = düz sayfa, elle uygulama için.",
      detail:
        "Rulo: 1.000+ adet, makinede sürekli akış. Endüstriyel üretim — şişe etiketleme, kavanoz, kozmetik aplikatörleri. Tabaka: 250+ adet, SRA3 (320×450 mm) tabakada yarı kesimli, elle çıkarıp ürüne yapıştırırsın. Küçük tirajlı el yapımı ürünler için. Konfigüratörde Etiket türü ilk adım — Tabaka seçince Sarım yönü/detayı gizlenir (5 adıma düşer).",
    },
    {
      q: "Hangisini seçmeliyim — Rulo mu Tabaka mı?",
      summary:
        "1000+ adet ve makine kullanıyorsan Rulo; küçük tiraj (250-1000) ve elle uyguluyorsan Tabaka.",
      detail:
        "Rulo ekonomik eşik 1000 adettir — daha az basmak istersen tabakaya geç. Tabaka aplikatör makineye sığmaz (yarı kesimli, elle ayırıp yapıştırırsın). Karar veremezsen: el yapımı sabun/kozmetik/küçük seri → Tabaka; içecek/parfüm/seri üretim → Rulo.",
    },
    {
      q: "Sarım yönü nedir?",
      summary:
        "Etiketin rulo üzerinde dış mı içe mi sarılacağı — otomatik aplikatör makinen varsa kritik.",
      detail:
        "4 sarım yönü: yön 1 (en yaygın, önerilen) yön 2/3/4. Etiket sayfasındaki canlı önizlemede 'ABC' metnin yönü gösterilir. Makinenle aynı yönü seçmezsen etiket ters yapışır. Elle yapıştırıyorsan fark etmez, yön 1 default. Şüphedeyseniz aplikatör manueline veya bayisinin yön kodu (örn 'U-IN') sorulur.",
    },
    {
      q: "Göbek çapı (1\" / 1.5\" / 3\" / 4\") ne anlama gelir?",
      summary:
        "Rulonun iç boruk çapı (core hole) — makinenize göre seçmen gerek.",
      detail:
        "Endüstri standardı 3 inch (76 mm) — büyük endüstriyel makineler. 1 inch (25 mm) masaüstü/küçük lab makineleri. 1.5\" ve 4\" ara boyutlar, daha az yaygın. Makinen yoksa 3\" seç (default), tabakaya geçersen göbek adımı kaybolur. Yanlış göbek = rulo makineye takılmaz.",
    },
    {
      q: "Tabaka ile Die-Cut (Kontur Kesim) farkı?",
      summary:
        "Tabaka: sayfada yarı kesimli, müşteri elle ayırır; Die-Cut: her sticker tasarımın silüetine göre tek tek kesilir.",
      detail:
        "Tabaka — toplu dağıtım, etkinlik, kırtasiye sticker (örn 8 sticker / A4 tabaka). Die-Cut — profesyonel ürün ambalajı, her sticker hazır, beyaz kontur 2.5 mm. Die-cut'ta tasarımın PNG'sinin alpha kanalı kesim yolunu belirler — düz arka planlı PNG yükle, biz sınırı otomatik çıkarırız.",
    },
    {
      q: "Kontur kesim ile her şekil mümkün mü?",
      summary: "Evet, tasarımın silüeti ne ise sticker o şekilde kesilir.",
      detail:
        "Kalp, yıldız, yaprak, dalga, balon, logo silüeti, özgün karakter — sınır yok. Tasarım PNG (şeffaf arka plan) veya AI/PSD (vektör path) yükle. Çok ince çıkıntılar (1 mm altı) üretimde kopabilir, otomatik 1 mm minimum kenar uygulanır.",
    },
    {
      q: "Yumuşatılmış köşe (bumper) ne demek?",
      summary:
        "Dikdörtgen sticker köşelerinin yuvarlatılmış versiyonu — pill/bumper sticker görünümü.",
      detail:
        "Standart kare/dikdörtgen sticker keskin köşeli (radius 0). Yumuşatılmış seçersen 16-36 px radius eklenir, araba bumper sticker, pill formu, kart benzeri görünüm. Özel oran (örn 100×40 mm) + yumuşatılmış köşe = klasik bumper sticker.",
    },
  ],
  boyut: [
    {
      q: "Etikette neden minimum 1.000 adet?",
      summary:
        "Fason rulo üretimi ekonomik eşik — daha az basmak verim kaybı oluşturuyor.",
      detail:
        "Rulo etiket flexografi/dijital baskı makinelerinde setup süresi (mürekkep değişimi, prova baskı, kalibrasyon) 1-2 saat. 1000 adetin altında bu maliyet birim fiyata aşırı yansır. Daha az istersen Tabaka etiket (min 250) veya Sticker tabaka (min 25) seç.",
    },
    {
      q: "Sticker'da neden minimum 25 adet?",
      summary: "Tabaka tam dolar — daha az basmak için yer kalmıyor.",
      detail:
        "SRA3 tabakası (320×450 mm) 25 standart sticker (75×75 mm) ile dolar. Bunun altı verimsiz. 25 sticker tek tabakaya basılır, sen elle ayırırsın veya die-cut için bireysel kesilir. Hediyelik, etkinlik, kırtasiye için 25 yeterli, kişisel kullanım için optimum.",
    },
    {
      q: "Maksimum kaç adet sipariş verebilirim?",
      summary:
        "Etiket: 50.000 adet, Sticker: 1.000+ (toplu için iletişim).",
      detail:
        "Etikette 50.000 üstü sipariş için WhatsApp'tan özel teklif al — fiyat tier'ı düşer, üretim 2-3 makinaya bölünür. Sticker'da 1.000 üstü teknik olarak kabul ediyor ama üretim süresi 5+ iş günü olur. Tek seferde mi parça parça mı ihtiyacın varsa ona göre planlayalım.",
    },
    {
      q: "Tabaka etikette kaç adet tek tabakaya sığar?",
      summary:
        "Etiket boyutuna göre değişir — canlı önizlemede gerçek sayıyı gösteriyoruz.",
      detail:
        "SRA3 tabakası (320×450 mm) + 2 mm gap. Hesap algoritması en iyi yerleşimi (yatay vs çevrilmiş) otomatik seçer: 30×50 mm → ~84 etiket, 60×80 mm → ~30 etiket, 100×150 mm → ~9 etiket. Canlı önizlemede gerçek cols × rows = perSheet etiket grid'i çizilir.",
    },
    {
      q: "Özel oran sticker nedir?",
      summary:
        "Kare/yuvarlak yerine kendi en-boy oranını seç — bumper sticker, pill, geniş yatay için ideal.",
      detail:
        "Standart kare 75×75 mm → bumper 100×40 mm (yatay uzun) veya 25×255 mm (çubuk). Konfigüratörde 'Özel oran' seçince sistem otomatik bumper boyut (100×40) uygular, sen boyut adımında değiştirebilirsin. Köşe seçeneği ile düz/yumuşatılmış arasında karar ver.",
    },
  ],
  fiyat: [
    {
      q: "Pim Etiket fiyatlarına KDV dahil mi?",
      summary:
        "Evet, sitede görüntülenen tüm fiyatlar %20 KDV dahildir.",
      detail:
        "Türkiye'de basılı matbaa ürünleri %20 KDV oranına tabidir ve Pim Etiket fiyatlandırması bu oranı içerecek şekilde sunulur. Faturada matrah (KDV hariç tutar) ve KDV bedeli ayrı satırlarda detaylandırılır. Vergi mevzuatında değişiklik olması halinde fiyatlar otomatik olarak güncellenir. Hiçbir aşamada sürpriz vergi veya ek bedel uygulanmaz.",
    },
    {
      q: "Kargo ücreti ne kadar, ücretsiz kargo limiti var mı?",
      summary:
        "500 TL ve üzeri siparişlerde kargo ücretsizdir; bu limitin altındaki siparişlere kargo ücreti uygulanır.",
      detail:
        "500 TL altı siparişlerde Yurtiçi Kargo standart ücreti (yaklaşık 45-60 TL) sepete eklenir. Tüm gönderimlerimiz Yurtiçi Kargo aracılığıyla, Türkiye geneli kapı teslim şeklinde yapılır. Adres erişiminin zor olduğu bölgelerde (uzak ada/dağ köyleri) ek ücret çıkması durumunda sipariş onayı sonrasında bilgilendirilirsiniz.",
    },
    {
      q: "Gizli ücret veya sürpriz masraf var mı?",
      summary:
        "Hayır, sepette gördüğünüz tutar son ödeme tutarıdır; ek ücret uygulanmaz.",
      detail:
        "Pim Etiket fiyatlandırma politikası şeffaflık ilkesi üzerine kurulmuştur. Sepetinizde görüntülenen tutar; ürün bedeli, KDV ve gerekli kargo ücretini içerir. Ödeme aracısı komisyonu, hizmet bedeli veya işlem ücreti gibi gizli kalemler bulunmamaktadır. Bankanızın taksit kampanyası uygulanması durumunda ödeme tutarınız değişebilir; ancak bu Pim Etiket lehine değil müşteri lehine bir değişikliktir.",
    },
    {
      q: "Adet arttıkça birim fiyat düşüyor mu?",
      summary:
        "Evet, miktar bazlı kademeli indirim uygulanır; sipariş adetiniz arttıkça birim fiyat otomatik düşer.",
      detail:
        "Etiket siparişlerinde indirim kademeleri: 1.000, 2.000, 5.000, 10.000, 25.000 ve 50.000 adet. Sticker siparişlerinde: 25, 50, 100, 250, 500 ve 1.000 adet. Konfigüratörde adet seçicisini hareket ettirdiğinizde fiyat ve birim maliyet anlık olarak güncellenir; sistem ayrıca \"+1.000 adet daha ekleyin, %X tasarruf edin\" gibi öneriler sunarak optimum sipariş büyüklüğünü görmenize yardımcı olur.",
    },
    {
      q: "Çoklu tasarım indirimi nasıl uygulanır?",
      summary:
        "Aynı siparişte birden fazla tasarım yüklediğinizde, otomatik olarak %2 ile %10 arasında indirim uygulanır.",
      detail:
        "Çoklu tasarım indirim oranları: 2-3 tasarım %2, 4-5 tasarım %4, 6-10 tasarım %6, 11-25 tasarım %8 ve 26-50 tasarım %10. Bu yapı, baskı hazırlık (setup) maliyetinin çoklu tasarıma dağıtılması esasına dayanır. Örneğin 5 farklı tasarımdan her birinden 1.000 adet basıldığında toplam 5.000 etiket %4 indirimli fiyatla üretilir. Her tasarım için ayrı PDF veya PNG dosyası yüklenmesi gerekir.",
    },
    {
      q: "İndirim kuponu nasıl kullanılır?",
      summary:
        "Sepet ekranındaki 'Kupon kodu' alanına kodu yazıp 'Uygula' butonuna basmanız yeterlidir.",
      detail:
        "Pim Etiket'te yüzde indirim, sabit indirim ve ücretsiz kargo kuponları sunulmaktadır. Kuponlar minimum sepet tutarı veya kullanım süresi şartı içerebilir; bu bilgiler kupon detay sayfasında belirtilir. Aktif kampanyalar için Pim Etiket sohbet asistanına \"kupon var mı?\" sorusunu yöneltebilirsiniz; sistem geçerli kuponları size sunar.",
    },
    {
      q: "Toplu sipariş için özel fiyat teklifi alınabilir mi?",
      summary:
        "20.000+ etiket veya 500+ sticker siparişleriniz için WhatsApp veya e-posta üzerinden özel teklif talep edebilirsiniz.",
      detail:
        "Toplu siparişlerde birim fiyat üzerinden ekstra indirim, palet/koli düzeyinde özel kargo planlaması, e-fatura ile vadeli faturalama ve özelleştirilmiş teslim takvimi gibi avantajlar sunulur. Talep için ürün tipi, adet, boyut, malzeme ve teslim adresi bilgilerini içeren bir mesajı WhatsApp veya info@pimetiket.com adresine iletmeniz yeterlidir; 24 saat içinde detaylı teklif tarafınıza ulaştırılır.",
    },
  ],
  uretim: [
    {
      q: "Pim Etiket üretim süresi ne kadardır?",
      summary:
        "Standart etiket siparişleri 10 iş günü, sticker siparişleri 5 iş günü içinde üretilir (resmi tatiller hariç).",
      detail:
        "Pim Etiket'te sabit üretim süreleri uygulanmaktadır: rulo etiket ve tabaka etiket üretimi 10 iş günü, sticker (tabaka ve kontur kesim/die-cut) üretimi 5 iş günü sürmektedir. Bu süreler tasarım dosyanızın onaylanmasının ardından başlar; cumartesi, pazar ve resmi tatil günleri hesaba katılmaz. Üretim tamamlandıktan sonra kargo süresi (şehir bazında 1-3 iş günü) eklenir. Konfigüratör ve sepet ekranında, siparişiniz için tahmini teslim tarihi otomatik olarak hesaplanıp gösterilir.",
    },
    {
      q: "Siparişlerinizi hangi kargo firmasıyla gönderiyorsunuz?",
      summary:
        "Tüm siparişlerimiz Yurtiçi Kargo aracılığıyla, Türkiye geneli kapı teslim olarak gönderilmektedir.",
      detail:
        "Pim Etiket olarak siparişlerinizi yalnızca Yurtiçi Kargo aracılığıyla göndermekteyiz. Teslimat süresi İstanbul içi 1 iş günü, diğer iller için 2-3 iş günü olarak gerçekleşmektedir. Kargo takip numaranız, siparişiniz kargoya verildiği anda sistemde görüntülenir ve kayıtlı e-posta adresinize otomatik olarak iletilir. Eksik veya hatalı adres bilgisi nedeniyle iade olan siparişlerin yeniden gönderim ücreti müşteriye aittir.",
    },
    {
      q: "Tahmini teslim tarihi sipariş ekranında gösteriliyor mu?",
      summary:
        "Evet, sepete eklediğiniz andan itibaren tahmini teslim tarihi konfigüratör ekranında otomatik gösterilir.",
      detail:
        "Hesaplama formülü: sipariş tarihi + üretim süresi (etiket için 10, sticker için 5 iş günü) + kargo süresi (1-3 iş günü). Bu hesaplamada hafta sonları ve resmi tatil günleri dikkate alınmaz. Üretim sürecinde olası bir gecikme durumunda, beklenen teslim tarihinden en az 48 saat önce e-posta ve sistem bildirimi ile bilgilendirilirsiniz.",
    },
    {
      q: "Hızlı baskı veya acil sipariş hizmetiniz var mı?",
      summary:
        "Hayır, Pim Etiket'te hızlı veya acil baskı hizmeti sunulmamaktadır. Tüm siparişler standart üretim akışına tabidir.",
      detail:
        "Pim Etiket'in kalite politikası gereği tüm siparişler, planlı üretim akışı ve kalite kontrol süreçlerinden geçer. Hızlı baskı uygulanması; ön denetim, fason üretim planlaması ve son kalite kontrol aşamalarının atlanması anlamına geldiğinden, baskı kalitesi olumsuz etkilenir. Bu nedenle hızlı baskı hizmeti kataloğumuzda yer almamaktadır. Belirli bir teslim tarihine yetişmesi gereken siparişler için planlama yaparak erken sipariş vermenizi öneririz.",
    },
    {
      q: "Sipariş üretim aşamasını sistem üzerinden takip edebilir miyim?",
      summary:
        "Evet, siparişlerinizin tüm üretim ve kargo aşamalarını /panelim/siparislerim sayfasından gerçek zamanlı takip edebilirsiniz.",
      detail:
        "Sipariş takip akışı şu aşamaları içerir: Sipariş alındı → Tasarım onaylandı → Üretime girdi → Üretim tamamlandı → Kalite kontrolde → Kargoya verildi → Teslim edildi. Her aşama değişiminde sistem tarafından otomatik olarak e-posta bildirimi gönderilir. Sipariş geçmişiniz ve fatura kayıtlarınız da aynı panelden erişilebilir durumdadır.",
    },
    {
      q: "Sipariş verdikten sonra teslimat adresini değiştirebilir miyim?",
      summary:
        "Sipariş kargoya verilmeden önce panelinizden adresi güncelleyebilirsiniz; kargoya verildikten sonra değişiklik mümkün değildir.",
      detail:
        "Üretim sürecindeki siparişlerin teslimat adresi /panelim/siparislerim → Sipariş Detay → Adres Düzenle yolu ile güncellenebilir. Sipariş kargoya teslim edildikten sonra kargo firmasının sistemi üzerinden yönlendirme talebinde bulunabilirsiniz; bu işlem kargo firmasının politikası gereği ek ücretlendirmeye tabi olabilir. Sipariş esnasında adres bilgilerinizi dikkatli girmenizi öneririz.",
    },
  ],
  iade: [
    {
      q: "Pim Etiket'te cayma hakkı kullanılabilir mi?",
      summary:
        "Kişiye özel üretilen ürünler için cayma hakkı bulunmamaktadır; ancak üretim veya kargo kaynaklı hatalarda ücretsiz yeniden basım hizmeti sunulur.",
      detail:
        "Tüketicinin Korunması Hakkında Kanun (TKHK) madde 15/b uyarınca, müşteriye özel olarak üretilen mallar cayma hakkı istisnası kapsamındadır. Pim Etiket'te basılan etiket ve sticker ürünleri bu istisna kapsamına girer. Ancak teslim alınan üründe üretim hatası, kalite sorunu veya kargo hasarı tespit edilmesi durumunda; teslim tarihinden itibaren 7 takvim günü içinde fotoğraf ile bildirim yapılması halinde ücretsiz yeniden basım ve iade kargo ücreti tarafımızdan karşılanır.",
    },
    {
      q: "Tasarımım yanlış veya hatalı basıldığında ne yapmalıyım?",
      summary:
        "Pim Etiket kaynaklı üretim hatalarında, fotoğraf ile bildirim yaparak ücretsiz yeniden basım talep edebilirsiniz.",
      detail:
        "Yanlış malzeme kullanımı, eksik özellik uygulaması (yaldız, emboss, Spot UV), %15 ve üzeri renk sapması, kesim veya kontur hatası ve teslim sırasında hasar gibi durumlar üretim hatası olarak kabul edilir. Hata fotoğrafını /iade-talep sayfasındaki form aracılığıyla veya info@pimetiket.com adresine e-posta ile bildirebilirsiniz. Talebiniz 48 saat içinde incelenip yeniden üretim akışına alınır.",
    },
    {
      q: "Ürün çizik veya kargo hasarlı geldiğinde nasıl bir yol izlenir?",
      summary:
        "Görünür kargo hasarı varsa kargo görevlisi önünde tutanak tutturmanız önerilir; iç hasar fark edildiğinde 48 saat içinde fotoğraflı bildirim yapılmalıdır.",
      detail:
        "Kargo paketinde dış hasar tespit ettiğinizde teslim almadan önce kargo görevlisinden hasar tutanağı talep etmeniz tazminat sürecini hızlandırır. Paketi açtıktan sonra iç hasar fark ederseniz, hasarın fotoğrafını 48 saat içinde info@pimetiket.com adresine ileterek bildirim yapın. Kargo şirketinden tazmin edilen tutar sonrasında ürün ücretsiz olarak yeniden gönderilir.",
    },
    {
      q: "Basılan ürünün rengi ekranda gördüğümden farklı olabilir mi?",
      summary:
        "Ekran (RGB) ve matbaa (CMYK) renk uzaylarının farkından dolayı %5-10 oranında renk sapması olağan kabul edilir.",
      detail:
        "Dijital ekranlar RGB (ışık karışımı) ve matbaa baskı sistemleri CMYK (mürekkep karışımı) renk uzaylarında çalışır. Bu iki sistem arasında, özellikle parlak kırmızı, neon ve koyu mavi tonlarında doğal bir renk sapması bulunur. Aynı PDF dosyası farklı monitörlerde de farklı görüntülenebilir. Marka renginizin birebir basılmasını gerektiren projelerde Pantone spot renk tanımı yapılmalı ve sipariş öncesinde WhatsApp üzerinden bizimle iletişime geçilmelidir; bu siparişler için prova baskı uygulanabilir.",
    },
    {
      q: "Hatalı tasarım dosyası yükledim, değiştirebilir miyim?",
      summary:
        "Sipariş üretime alınmadığı sürece dosyanızı panelden silip yeniden yükleyebilirsiniz.",
      detail:
        "/panelim/siparislerim → Sipariş Detay → Tasarım Dosyaları menüsünden eski dosyayı silip yeni dosyayı yükleyebilirsiniz. Bu işlem yalnızca sipariş onayını takip eden 2 saatlik üretim hazırlık penceresinde mümkündür. Sipariş üretim hattına aktarıldıktan sonra dosya değişikliği kabul edilmez; bu durumda kişiye özel üretim ilkesi gereği yeni bir sipariş açılması gerekir.",
    },
  ],
  onizleme: [
    {
      q: "Canlı önizleme ne kadar gerçekçi?",
      summary:
        "Malzeme dokusu, kaplama parlaklığı, boyut oranı gerçek; renk hassasiyeti monitör kalibrasyonuna bağlı.",
      detail:
        "Önizlemede gerçek olanlar: malzeme zemini (kuşe vs kraft vs metalik), kaplama efekti (mat/parlak/soft touch), özelleştirme (yaldız/emboss/spotUV katmanları), boyut oranı (60×80 ≠ 75×75), tabaka yerleşimi (cols×rows). Tam gerçek olmayan: kesin renk tonu (ekran ↔ baskı CMYK farkı), kağıt kalınlığı/hissi.",
    },
    {
      q: "3D mod ile Eskiz mod farkı?",
      summary:
        "3D: malzeme dokusu + perspektif (gerçekçi sunum); Eskiz: mercan dolu diyagram (matbaa yerleşim ipucu).",
      detail:
        "Sağ alttaki toggle ile geçiş. 3D modu müşteriye 'böyle görünecek' hissi verir — malzeme zemini, sheen efekti, hafif perspektif. Eskiz modu 'ne kadar sığar, nasıl dizilecek' net anlatır — matbaa diyagramı gibi.",
    },
    {
      q: "Önizlemede tasarımım nasıl göründüyse aynısı mı basılır?",
      summary:
        "Evet, mockup üretim referansı — boyut oranı + malzeme + özelleştirme tam birebir.",
      detail:
        "Tasarımın PDF/PNG olarak yüklediğin halinde önizleme cell'inde ortalı görünür. Üretimde aynı yerleşim uygulanır (bleed payı 2 mm sistem otomatik ekler). Renk hassasiyeti hariç tüm görsel öğeler birebir.",
    },
    {
      q: "Üretim öncesi onay süreci var mı?",
      summary:
        "Evet, tasarım yüklendikten sonra otomatik AI ön denetim + senin onay bekleniyor.",
      detail:
        "AI denetimi: DPI, font outline, taşma payı, mürekkep doygunluğu, kontur kesim hatları, çok ince çıkıntılar. Sorun bulursa 'Onay bekleniyor' durumuna alırız, sen düzeltip tekrar yüklersin. Sorun yoksa otomatik üretime girer. Kritik tasarımlarda (kurumsal müşteri) elcek prova baskı isteyebilirsin (ek ücret).",
    },
  ],
  kvkk: [
    {
      q: "Kişisel verilerim KVKK kapsamında nasıl korunuyor?",
      summary:
        "Pim Etiket, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyumlu olarak verilerinizi şifreli olarak saklar ve üçüncü taraflarla paylaşmaz.",
      detail:
        "Aydınlatma metnimizin tamamına /kvkk sayfasından erişebilirsiniz. Toplanan veriler şunlardır: ad-soyad, e-posta, telefon, fatura adresi ve ödeme bilgileri (PayTR'da tokenize edilmiş). Sipariş kayıtları Vergi Usul Kanunu uyarınca 10 yıl, pazarlama izinli iletişim verileri ise silinme talebine kadar saklanır. Veri sahibi olarak KVKK madde 11 kapsamındaki haklarınızı (erişim, düzeltme, silme, taşınabilirlik, itiraz) /ayarlar/verilerim sayfasından kullanabilirsiniz.",
    },
    {
      q: "Yüklediğim tasarım dosyaları üçüncü taraflarla paylaşılır mı?",
      summary:
        "Hayır, tasarım dosyalarınız yalnızca üretim süreci için kullanılır ve üçüncü taraflarla kesinlikle paylaşılmaz.",
      detail:
        "Tasarım dosyalarınız (PDF, PNG, AI, PSD, EPS), Supabase Storage altyapısında Row Level Security (RLS) ile kişisel hesabınıza bağlı olarak şifreli saklanır. Bu dosyalara yalnızca siz ve üretim ekibimiz erişebilir. Pazarlama, reklam veya başka müşterilere örnek gösterme gibi amaçlarla asla kullanılmaz. Yapay zeka model eğitimi için anonim veri katkısı yalnızca opsiyonel açık rızanız doğrultusunda gerçekleştirilir ve dilediğiniz zaman geri alabilirsiniz.",
    },
    {
      q: "Verilerim ne kadar süre saklanıyor?",
      summary:
        "Sipariş kayıtları 10 yıl (VUK gereği), pazarlama verileri silme talebine kadar, tasarım dosyaları 90 gün saklanır.",
      detail:
        "Vergi Usul Kanunu gereği fatura ve sipariş kayıtları 10 yıl boyunca muhasebe ve denetim amacıyla korunur; bu süreçte pazarlama amaçlı kullanılmaz. Tasarım dosyaları, yeniden basım taleplerini desteklemek için son siparişten itibaren 90 gün boyunca tutulur ve sonrasında otomatik olarak silinir. Hesap silme talebinde bulunmanız halinde KVKK kapsamındaki tüm kişisel verileriniz 30 gün içinde tamamen silinir veya anonimleştirilir.",
    },
    {
      q: "Mesafeli satış sözleşmesi nedir, nasıl onaylanıyor?",
      summary:
        "Mesafeli satış sözleşmesi, online alışverişte tarafların hak ve yükümlülüklerini düzenleyen yasal belgedir; sipariş öncesi onayınız alınır.",
      detail:
        "Sözleşmenin tam metnine /mesafeli-satis sayfasından erişebilirsiniz. Ödeme adımından önce sözleşme otomatik olarak görüntülenir; \"Okudum ve kabul ediyorum\" onay kutusu işaretlenmeden sipariş tamamlanamaz. İçerikte; ürün özellikleri, fiyat ve ödeme bilgisi, teslim koşulları, cayma hakkı (özel üretim ürünlerde istisna), iade prosedürü ve kişisel veri politikası gibi TKHK madde 5'in zorunlu kıldığı tüm unsurlar yer alır.",
    },
    {
      q: "Telif hakkı olan bir tasarım için sipariş verebilir miyim?",
      summary:
        "Telif veya marka hakkı bulunan içeriklerin baskısı için ilgili hakların sahibi olmanız veya yetkilendirilmiş olmanız gereklidir; aksi takdirde sipariş reddedilir.",
      detail:
        "Sipariş verirken yüklediğiniz tasarımın fikri ve sınai mülkiyet haklarına sahip olduğunuzu veya bu hakları kullanma yetkinizin bulunduğunu kabul ve taahhüt etmiş olursunuz. Tescilli marka logoları (örneğin Adidas, Nike), telif altındaki karakterler (Marvel, Disney) veya patent kapsamındaki tasarımlar için yetki belgesi ibraz edilemediği takdirde sipariş Pim Etiket tarafından reddedilir. Müşteri, yüklediği içerikten doğan tüm telif ihlali sonuçlarından hukuken sorumludur.",
    },
  ],
  yardim: [
    {
      q: "Pim sohbet asistanı hangi konularda yardımcı oluyor?",
      summary:
        "Pim Etiket'in yapay zeka destekli sohbet asistanı; ürün önerisi, malzeme seçimi, fiyat sorgulama ve sipariş takibi konularında destek sağlar.",
      detail:
        "Sayfanın sağ alt köşesindeki karga ikonuna tıklayarak sohbeti başlatabilirsiniz. Asistan; \"balsamik sirke şişesi için hangi malzeme uygundur?\" gibi ürün danışmanlığı, fiyat tahmini, kupon kodu sorgulama, malzeme detayları ve aktif siparişlerinizin durumu gibi sorularınızı yanıtlar. Yapay zeka tarafından üretilen yanıtlar bilgilendirme amaçlıdır ve hatalı olabilir; kritik karar gerektiren konularda müşteri hizmetlerimizle iletişime geçmeniz önerilir.",
    },
    {
      q: "Yapay zeka asistanı tasarım yapabiliyor mu?",
      summary:
        "Hayır, Pim sohbet asistanı renk, font ve kompozisyon önerisi sunar; tasarım dosyasını oluşturmaz.",
      detail:
        "Pim sohbet asistanı; \"organik bal için minimal etiket önerisi\" gibi sektör bazlı tavsiye, renk paleti seçimi, font kombinasyonu önerisi ve örnek paylaşımı yapar. Tasarımın fiili olarak hazırlanması Canva, Adobe Express veya Figma gibi ücretsiz online tasarım araçları üzerinden tarafınızca gerçekleştirilir. Hukuki tavsiye, vergi danışmanlığı veya kişisel sağlık bilgisi gibi konularda yanıt vermez.",
    },
    {
      q: "Müşteri hizmetlerine nasıl ulaşabilirim?",
      summary:
        "WhatsApp en hızlı yanıt kanalımızdır; e-posta (info@pimetiket.com) ve /iletisim formu da kullanılabilir.",
      detail:
        "İletişim kanallarımız ve ortalama yanıt süreleri: WhatsApp — hafta içi mesai saatlerinde 30 dakika, hafta sonu 12 saat içinde dönüş. E-posta (info@pimetiket.com) — 24 saat içinde detaylı yanıt. /iletisim formu — sipariş numarası ile birlikte iletildiğinde aynı gün incelenir. Telefonla iletişim kanalımız henüz aktif değildir; 2026 Q2'de hizmete açılacaktır.",
    },
    {
      q: "Çalışma saatleriniz nedir?",
      summary:
        "Müşteri hizmetlerimiz hafta içi 09:00-18:00, hafta sonu 10:00-16:00 saatleri arasında hizmet vermektedir.",
      detail:
        "Pim sohbet asistanı 7/24 yanıt verir; operatör desteği yukarıdaki saatlerle sınırlıdır. WhatsApp yanıt süresi mesai içinde 30 dakika, mesai dışında 4-12 saattir. E-posta yanıt süresi 4-12 saattir. Çoğu soru AI asistan tarafından çözülür; çözülemeyen talepler otomatik olarak insan operatöre yönlendirilir.",
    },
  ],
};

// EN: minimum fallback — Sefa daha sonra detaylı çevirir
const FAQS_EN: Record<Category, FaqItem[]> = {
  siparis: [
    {
      q: "How do I place an order?",
      summary:
        "Configure your label/sticker, add to cart, complete payment.",
      detail:
        "Steps: Label type → Material → Coating → Size → Design → Quantity. See live preview at each step. Pay via PayTR with 3D Secure card.",
    },
    {
      q: "Which payment methods do you accept?",
      summary: "Visa, Mastercard, Troy and Amex via PayTR with 3D Secure.",
      detail:
        "Card data never reaches our servers — handled in PayTR's PCI-DSS infrastructure. We only receive 'payment success/fail' callback.",
    },
    {
      q: "Is VAT included?",
      summary: "Yes, all displayed prices include 20% VAT.",
      detail: "Turkey's standard VAT rate for printed materials is 20%.",
    },
  ],
  tasarim: [
    {
      q: "What file formats do you accept?",
      summary: "PDF, PNG, AI, PSD, EPS — 5 formats total.",
      detail:
        "PDF (X-1a) or AI recommended for best result. PNG, AI, PSD, EPS also accepted. JPEG/SVG not accepted.",
    },
    {
      q: "What resolution should my design be?",
      summary: "300 DPI at actual size — print quality standard.",
      detail:
        "Lower DPI may produce blurry print. CMYK color space recommended.",
    },
    {
      q: "Can I design it myself? Which tools do you recommend?",
      summary:
        "Use Canva, Adobe Express, or Figma — free online tools. Export as PDF/PNG and upload.",
      detail:
        "We don't have an in-house template library yet — but the web has plenty: Canva (thousands of label/sticker templates), Adobe Express (fast and simple), Figma (free tier, pro look), VistaCreate. Pick one, design, export PDF/PNG, upload here. Ask Pim chat for color and font suggestions based on your industry.",
    },
  ],
  malzeme: [
    {
      q: "Which material should I choose?",
      summary:
        "Depends on product environment: food → coated/kraft, water → opaque PP, premium → metallic, glass bottle → ultra clear.",
      detail:
        "/malzemeler page has full details for each material. Ask Pim chat for personalized recommendation.",
    },
  ],
  kesim: [
    {
      q: "Roll vs Sheet label difference?",
      summary:
        "Roll: 1000+ qty for machine application; Sheet: smaller runs, hand application.",
      detail:
        "Roll is industrial production standard; sheet is SRA3 with semi-cut, you peel by hand.",
    },
    {
      q: "Sheet vs Die-Cut sticker difference?",
      summary:
        "Sheet: stickers on one page, peel by hand; Die-Cut: each sticker individually cut along design silhouette.",
      detail:
        "Die-cut produces professional product-ready stickers with 2.5mm white border.",
    },
  ],
  boyut: [
    {
      q: "Why minimum 1,000 for labels?",
      summary:
        "Fason roll production economic threshold — lower volume is inefficient.",
      detail:
        "Setup cost is fixed; spreading over 1000+ units keeps unit price reasonable.",
    },
    {
      q: "Why minimum 25 for stickers?",
      summary: "Sheet fills exactly with 25 standard stickers.",
      detail:
        "SRA3 sheet (320×450mm) holds 25 standard 75×75mm stickers. Below 25 = inefficient.",
    },
  ],
  fiyat: [
    {
      q: "Are there volume discounts?",
      summary: "Yes, automatic tier discounts — more quantity = lower unit price.",
      detail:
        "Labels: 1K, 2K, 5K, 10K, 25K, 50K tiers with progressive discount up to ~7%.",
    },
    {
      q: "Multi-design discount?",
      summary: "Yes, 2-50 designs in same order = 2-10% automatic discount.",
      detail:
        "Setup cost spreads across designs. 26-50 designs get the maximum 10%.",
    },
  ],
  uretim: [
    {
      q: "How long does production take?",
      summary:
        "Labels: 10 business days, stickers: 5 business days (public holidays excluded).",
      detail:
        "Fixed lead times: roll & sheet labels — 10 business days; stickers (sheet + die-cut) — 5 business days. Starts after design approval, public holidays not counted. Add 1-3 days for shipping. Estimated delivery date shown automatically at checkout.",
    },
    {
      q: "Which courier do you use?",
      summary: "Yurtiçi Kargo and Aras Kargo — Turkey-wide delivery.",
      detail:
        "Istanbul 1 business day, other cities 2-3. Tracking number in your dashboard.",
    },
    {
      q: "Same-day shipping / rush print?",
      summary:
        "No rush service. Fixed lead times: 10 days labels, 5 days stickers.",
      detail:
        "We keep fixed production windows for QC, pre-flight checks, and planned fason partner runs. Rush printing degrades quality; we don't compromise. Plan ahead — the sooner you order, the sooner it ships.",
    },
  ],
  iade: [
    {
      q: "Do I have a right to withdraw?",
      summary:
        "No, as products are made-to-order (TKHK m.15/b) — but free reprint if our error.",
      detail:
        "Production defects, color shifts, shipping damage → free reprint + return shipping within 7 days.",
    },
  ],
  onizleme: [
    {
      q: "How realistic is the live preview?",
      summary:
        "Material texture, finish, size ratio — real. Exact color tone depends on monitor.",
      detail:
        "3D mode: realistic textures + perspective. Sketch mode: matbaa-style layout diagram.",
    },
  ],
  kvkk: [
    {
      q: "Is my data secure under KVKK?",
      summary:
        "Yes, fully KVKK-compliant — data encrypted, never sold to third parties.",
      detail:
        "Full privacy notice at /kvkk. Design files stored with personal RLS in Supabase — only you have access.",
    },
  ],
  yardim: [
    {
      q: "What is the Pim chat button for?",
      summary:
        "AI assistant — product recommendations, material selection, price queries, order tracking.",
      detail:
        "Bottom-right crow icon. AI can help with product type, material selection, pricing. Critical decisions → contact human support via WhatsApp.",
    },
    {
      q: "WhatsApp / email support?",
      summary: "Yes, both available — WhatsApp fastest.",
      detail:
        "Weekdays 09:00-18:00 Turkey time. WhatsApp response 30min, email 4-12h.",
    },
  ],
};

const COPY = {
  tr: {
    eyebrow: "Sıkça sorulanlar",
    h1Line1: "Cevap genelde",
    h1Line2: "“evet, hallederiz”.",
    intro:
      "Aklındakini kategoriler altında topladık. Bulamadığını Pim'e sorabilir veya ",
    introLink: "iletişim",
    introEnd: " sayfasından bize yazabilirsin.",
    cantFindTitle: "Cevabını bulamadın mı?",
    cantFindDesc:
      "Pim sağ alt köşede sana yardım etmek için bekliyor — ya da doğrudan e-posta ile bize yaz.",
    contactButton: "Bize yaz",
    detailLabel: "Detay",
  },
  en: {
    eyebrow: "Frequently asked",
    h1Line1: "Answer is usually",
    h1Line2: "“yes, we got you”.",
    intro: "We grouped the common questions by category. Can't find yours? Ask Pim or ",
    introLink: "contact",
    introEnd: " us directly.",
    cantFindTitle: "Couldn't find your answer?",
    cantFindDesc:
      "Pim is waiting in the bottom-right corner to help — or just send us an email.",
    contactButton: "Contact us",
    detailLabel: "Detail",
  },
};

export default function SssPage() {
  const { locale } = useT();
  const isEn = locale === "en";
  const c = isEn ? COPY.en : COPY.tr;
  const CATEGORIES = isEn ? CATEGORIES_EN : CATEGORIES_TR;
  const FAQS = isEn ? FAQS_EN : FAQS_TR;

  const [active, setActive] = useState<Category>("siparis");
  const items = FAQS[active];

  // URL hash ile paylaşılabilir kategori (örn /sss#kargo)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const validCats: Category[] = [
      "siparis",
      "tasarim",
      "malzeme",
      "kesim",
      "boyut",
      "fiyat",
      "uretim",
      "iade",
      "onizleme",
      "kvkk",
      "yardim",
    ];
    const readHash = () => {
      const h = window.location.hash.replace("#", "") as Category;
      if (validCats.includes(h)) setActive(h);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const changeCategory = (cat: Category) => {
    setActive(cat);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${cat}`);
    }
  };

  // FAQ JSON-LD (Google Rich Snippet) — summary'i answer olarak kullan
  const allFaqs: { q: string; a: string }[] = Object.values(FAQS)
    .flat()
    .map((f) => ({ q: f.q, a: f.summary + " " + f.detail }));

  return (
    <main className="animate-fade-up">
      <SchemaJsonLd data={faqSchema(allFaqs)} />

      {/* HERO */}
      <section className="pt-10 md:pt-16 pb-8 md:pb-12">
        <div className="mx-auto max-w-[800px] px-4 md:px-8 text-center">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-4 text-[32px] md:text-[56px] font-semibold tracking-[-0.02em] leading-[1.04]">
            {c.h1Line1}
            <br />
            {c.h1Line2}
          </h1>
          <p className="mt-6 text-[15px] md:text-lg text-gri-700 leading-relaxed">
            {c.intro}
            <a
              href="/iletisim"
              className="text-pim-mercan font-semibold hover:underline"
            >
              {c.introLink}
            </a>
            {c.introEnd}
          </p>
        </div>
      </section>

      {/* CATEGORY TABS */}
      <section className="pb-6 md:pb-8">
        <div className="mx-auto max-w-[1100px] px-4 md:px-8">
          <div className="flex gap-2 flex-wrap justify-center">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => changeCategory(cat.id)}
                className={cn(
                  "px-4 md:px-5 py-2.5 rounded-full text-sm font-semibold transition-colors",
                  active === cat.id
                    ? "bg-lacivert text-white"
                    : "bg-white ring-1 ring-gri-200 text-gri-700 hover:bg-gri-100 hover:text-lacivert"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ ACCORDION — hibrit format (summary + detail) */}
      <section className="pb-12 md:pb-16">
        <div className="mx-auto max-w-[800px] px-4 md:px-8 flex flex-col gap-3">
          {items.map((f, i) => (
            <details
              key={`${active}-${i}`}
              className="bg-white rounded-lg shadow-1 ring-1 ring-black/[0.04] px-5 md:px-6 py-4 group open:bg-gri-50 transition-colors"
            >
              <summary className="flex justify-between items-center list-none font-semibold text-[15px] md:text-base gap-4 cursor-pointer">
                <span>{f.q}</span>
                <span className="text-pim-mercan text-xl group-open:rotate-45 transition-transform shrink-0">
                  +
                </span>
              </summary>
              {/* Özet — bold, hemen altında */}
              <p className="mt-3 text-[15px] md:text-base text-lacivert font-medium leading-relaxed">
                {f.summary}
              </p>
              {/* Detay — ikincil paragraf, daha küçük + gri */}
              <details className="mt-3 group/d">
                <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-[13px] font-semibold text-pim-mercan hover:underline">
                  <span className="group-open/d:rotate-90 transition-transform inline-block">
                    ▸
                  </span>
                  {c.detailLabel}
                </summary>
                <p className="mt-2 text-[14px] text-gri-700 leading-[1.7]">
                  {f.detail}
                </p>
              </details>
            </details>
          ))}
        </div>
      </section>

      {/* PIM CTA */}
      <section className="py-12 md:py-16 bg-gri-50">
        <div className="mx-auto max-w-[800px] px-4 md:px-8">
          <div className="bg-krem rounded-2xl px-6 md:px-12 py-8 md:py-10 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 md:gap-6 items-center">
            <Pim pose="think" size={120} />
            <div>
              <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
                {c.cantFindTitle}
              </h3>
              <p className="mt-2 text-[15px] md:text-base text-gri-700 leading-relaxed">
                {c.cantFindDesc}
              </p>
            </div>
            <Button variant="primary" href="/iletisim">
              <Icon.ChatBubble size={16} /> {c.contactButton}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
