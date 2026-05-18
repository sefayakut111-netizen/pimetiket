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
      q: "Nasıl sipariş veririm?",
      summary:
        "Etiket veya Sticker sayfasında konfigüratörü doldur, sepete ekle, ödemeyi tamamla.",
      detail:
        "Adımlar: Etiket türü / Kesim tipi → Malzeme → Kaplama/Yüzey → Boyut → Tasarım → Adet. Her adımda canlı önizlemeden ne basacağını görürsün. Boyut ve adeti ister chip'lerden seç ister kendin yaz. Sepete ekledikten sonra ödeme sayfasında kart bilgilerini gir, sipariş onayı e-postan gelir. Tasarımını şimdi yüklemek zorunda değilsin — sipariş sonrası detay sayfasından da yükleyebilirsin.",
    },
    {
      q: "Üye olmam zorunlu mu?",
      summary:
        "Tasarım yüklemek ve sipariş takibi için üyelik gerekir; sepete ekleme ve fiyat görme misafir olarak da çalışır.",
      detail:
        "Tasarım dosyaları Supabase Storage'da kişisel hesabına bağlı saklanır (KVKK uyumu — sadece sen erişirsin). Bu yüzden tasarım yüklemek için giriş gerek. Üye olmak 30 saniye sürer, e-posta + şifre yeterli. Üye olarak: sipariş geçmişi, yeniden basım kolaylığı, tasarım kütüphanen, çoklu fatura adresi.",
    },
    {
      q: "Hangi ödeme yöntemlerini kabul ediyorsunuz?",
      summary: "Visa, Mastercard, Troy ve Amex kart ile PayTR üzerinden ödeme.",
      detail:
        "Ödeme altyapımız PayTR Sanal POS — Türkiye'nin en yaygın PSP'lerinden biri, BDDK lisanslı. Kartlarına ek olarak 3D Secure ile her işlemde bankanız SMS doğrulama isteyebilir. Kapıda ödeme / havale-EFT / kripto kabul etmiyoruz. Kurumsal müşteriler için elden teslim seçeneği WhatsApp üzerinden görüşülür.",
    },
    {
      q: "3D Secure kullanıyor musunuz, kartım güvende mi?",
      summary:
        "Evet, tüm işlemler 3D Secure 2.0 ile bankanın SMS/uygulama doğrulamasından geçer.",
      detail:
        "Kart bilgileriniz bizim sunucularımıza hiç ulaşmaz — PayTR'ın PCI-DSS sertifikalı altyapısında işlenir. Biz sadece 'ödeme başarılı / başarısız' callback'i alırız. Bu, PCI scope dışı olmamızı sağlar. CVV bizde saklanmaz, kart numarası tokenize edilir.",
    },
    {
      q: "Kapıda ödeme var mı?",
      summary: "Hayır, sadece online kart ile ödeme.",
      detail:
        "Özel üretim ürünler basıldıktan sonra iade edilemediği için (TKHK m.15/b) kapıda ödeme riski yüksek — siparişin reddedilmesi durumunda üretim maliyeti kayıp olur. Kurumsal sipariş ve toplu alımlar için havale-EFT seçeneği WhatsApp üzerinden açılabilir.",
    },
    {
      q: "Taksit imkânı var mı?",
      summary:
        "Bankanızın kart taksit kampanyalarına göre PayTR ekranında otomatik görünür.",
      detail:
        "Biz ek taksit komisyonu eklemiyoruz — bankanızın güncel kampanyası neyse o uygulanır. Tek çekim her zaman seçilebilir. 500 TL altı siparişlerde bazı bankalarda taksit görünmeyebilir (kart politikası).",
    },
    {
      q: "Fatura nasıl kesilir?",
      summary:
        "E-arşiv fatura, sipariş onayı sonrası e-postan iletilir; kurumsal için e-fatura yol haritamızda.",
      detail:
        "Şahıs işletmesi olarak çalışıyoruz (Sefa Yakut, Alemdağ VD 9290558622). Ticari müşterilerimiz için e-fatura entegrasyonu yol haritamızda. Şirket adına faturada VKN/TCKN bilgisi sepet ekranında istenir. Vergi mevzuatı gereği fatura sipariş tarihinden itibaren 7 gün içinde kesilir.",
    },
    {
      q: "Şirket adına fatura kesilir mi?",
      summary:
        "Evet, sepet adımında 'Şirket adına' seçerek vergi numarası gir.",
      detail:
        "Unvan + VKN + vergi dairesi bilgisi alınır, e-arşiv faturanız bu bilgilerle düzenlenir. KDV %20 dahil görüntülenir, fatura üzerinde matrah + KDV ayrı ayrı dökülür.",
    },
    {
      q: "Sipariş onayı nereden gelir?",
      summary:
        "Üye e-postana anında sipariş onayı + tahmini teslim tarihi gönderilir.",
      detail:
        "Spam klasörünü de kontrol et (info@pimetiket.com alan adından). Sipariş takibi /panelim/siparislerim üzerinden de görünür. Üretim aşamasında ayrıca 'Üretime girdi' ve 'Kargoya verildi' bildirimleri gelir.",
    },
    {
      q: "Siparişi nasıl iptal ederim?",
      summary:
        "Üretime girmeden önce panelimden iptal et — sonrasında özel üretim olduğu için iade yok.",
      detail:
        "Sipariş onayından sonra maksimum 2 saat içinde iptal hakkın var (üretim hazırlığı başlamadan). /panelim/siparislerim → İptal et butonu. 2 saat sonra ya da üretime girmişse, TKHK m.15/b kapsamında cayma hakkı yoktur (özel üretim ürün). Bu konuda müşteri hizmetleri yardımcı olur.",
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
      q: "Fiyatlara KDV dahil mi?",
      summary: "Evet, görüntülenen tüm fiyatlar KDV %20 dahil.",
      detail:
        "Türkiye'de basılı matbaa ürünleri %20 KDV oranına tabi. Fatura üzerinde matrah (KDV hariç) + KDV ayrı dökülür. Sürpriz ek vergi yoktur. KDV oranı 2026 itibariyle %20'dir, mevzuat değişirse fiyatlar günceller.",
    },
    {
      q: "Kargo ücretsiz mi?",
      summary:
        "Evet, 500 TL üstü siparişlerde kargo bizden; altında küçük bir kargo ücreti eklenir.",
      detail:
        "500 TL altı için ~45-60 TL kargo ücreti (sepete eklenir). Türkiye geneli Yurtiçi Kargo / Aras Kargo ile gönderiyoruz, kapı önü teslim. Adada/dağda zorlu adresler için ek ücret çıkabilir, sipariş onayı sonrası bilgilendiririz.",
    },
    {
      q: "Sürpriz / gizli ücret olur mu?",
      summary: "Hayır — KDV dahil, kargo dahil, sürpriz yok.",
      detail:
        "Görüntülediğin fiyat son fiyat. PSP komisyonu, kart komisyonu, hizmet bedeli gibi ekstra kalemler bizden çıkıyor. Tek değişebilen: bankanın kart taksit kampanyası varsa indirim olabilir.",
    },
    {
      q: "Adet arttıkça birim fiyat nasıl düşer?",
      summary:
        "Otomatik tier indirimleri — 2K → %4, 5K → %6, 10K → %7 birim fiyat düşer.",
      detail:
        "Etiket tier'ları: 1K, 2K, 5K, 10K, 25K, 50K → her tier birim fiyatı kademeli düşer. Konfigüratörde adet sürgüsünü sürüklediğinde canlı fiyat güncellenir, '+1000 daha ekle, %X daha tasarruf' upsell ipuçları görünür. Sticker'da 25, 50, 100, 250, 500, 1000 tier'ları benzer mantık.",
    },
    {
      q: "Çoklu tasarım indirimi nasıl çalışır?",
      summary:
        "Aynı siparişte birden fazla tasarım = otomatik %2-%10 indirim.",
      detail:
        "2-3 → %2, 4-5 → %4, 6-10 → %6, 11-25 → %8, 26-50 → %10. Mantık: setup maliyeti çoklu tasarımda dağılır, hammadde aynı. Örnek: 5 tasarım × 1000 adet = 5000 etiket → her tasarımdan 1000 adet basılır, %4 indirim uygulanır. Her tasarım için ayrı PDF/PNG dosyası yükle.",
    },
    {
      q: "Kupon kodu nasıl kullanılır?",
      summary:
        "Sepet adımında 'Kupon kodu' kutusuna gir, Uygula butonu indirimleri otomatik hesaplar.",
      detail:
        "Kupon türleri: yüzde indirim (örn %10), sabit indirim (örn 100 TL), kargo bedavası. Kuponların minimum sepet tutarı veya geçerlilik tarihi olabilir. Pim sohbet AI ekrana aktif kuponları gösterir, 'kupon var mı?' diye sorabilirsin.",
    },
    {
      q: "Toplu sipariş için özel teklif?",
      summary:
        "20.000+ etiket veya 500+ sticker için WhatsApp/e-posta üzerinden özel teklif alabilirsin.",
      detail:
        "Toplu siparişlerde: birim fiyat ekstra indirim, kargo özel ayarlama (palet/koli), faturalama (e-fatura, açık hesap), teslim takvimi. Lütfen ürün tipi + adet + boyut + malzeme bilgisiyle bize ulaş — 24 saat içinde özel teklif iletilir.",
    },
  ],
  uretim: [
    {
      q: "Üretim ne kadar sürer?",
      summary:
        "Etiket için 10 iş günü, sticker için 5 iş günü (resmi tatiller hariç).",
      detail:
        "Sabit üretim sürelerimiz: Rulo etiket ve tabaka etiket — 10 iş günü; sticker (tabaka + die-cut) — 5 iş günü. Bu süreler tasarım onayından sonra başlar, resmi tatiller hesaba katılmaz. Üzerine kargo süresi (1-3 iş günü, şehre göre) eklenir. Sepete eklediğinde tahmini teslim tarihi otomatik hesaplanır.",
    },
    {
      q: "Hangi kargo firması?",
      summary: "Yurtiçi Kargo ve Aras Kargo ile gönderiyoruz.",
      detail:
        "Türkiye geneli kapı önü teslim. İstanbul içi 1 iş günü, diğer iller 2-3 iş günü. Adres + telefon doğru olmazsa kargo iade eder, yeniden gönderim ek ücret. Kargo takip numarası sipariş 'Kargoya verildi' bildirimi ile e-postana gelir.",
    },
    {
      q: "Tahmini teslim tarihi gösterilir mi?",
      summary:
        "Evet, konfigüratörde sepete eklemeden önce ve sipariş sonrası gösterilir.",
      detail:
        "Hesap: bugünün tarihi + üretim süresi (etiket 10 iş günü / sticker 5 iş günü) + kargo (1-3 iş günü) → tahmini teslim. Hafta sonu ve resmi tatiller hesaba katılmaz. Üretimde gecikme olursa 48 saat önceden sana e-posta + Pim sohbet bildirimi gider.",
    },
    {
      q: "Aynı gün kargoya verebilir misiniz, hızlı baskı var mı?",
      summary:
        "Hayır, hızlı/acil baskı hizmetimiz yok. Sabit üretim sürelerimiz var: etiket 10, sticker 5 iş günü.",
      detail:
        "Kalite kontrol, ön denetim ve fason ortaklarımızla planlı üretim akışı için sabit süreler uyguluyoruz. 'Acele baskı' sipariş kalitesini düşürür, biz buna izin vermiyoruz. Daha kısa süre gereken bir durumda planlamayı önceden yap — sipariş ne kadar erken verirsen teslim de o kadar erken olur.",
    },
    {
      q: "Üretim aşamasını takip edebilir miyim?",
      summary:
        "Evet, /panelim/siparislerim üzerinden gerçek zamanlı aşama takibi.",
      detail:
        "Aşamalar: 1️⃣ Sipariş alındı → 2️⃣ Tasarım onaylandı → 3️⃣ Üretime girdi → 4️⃣ Üretim tamamlandı → 5️⃣ Kalite kontrolde → 6️⃣ Kargoya verildi → 7️⃣ Teslim edildi. Her aşama değişiminde e-posta bildirimi.",
    },
    {
      q: "Adres değiştirebilir miyim sipariş sonrası?",
      summary:
        "Üretim aşamasında evet, kargoya verildikten sonra hayır.",
      detail:
        "/panelim/siparislerim → Sipariş detay → Adres değiştir. Üretime girmiş ama kargoya verilmemişse değişim kabul. Kargoya verildikten sonra kargo firmasının kendi sistemi üzerinden adres yönlendirme talep edebilirsin (ek ücret olabilir).",
    },
  ],
  iade: [
    {
      q: "İade hakkım var mı?",
      summary:
        "Özel üretim ürünlerde cayma hakkı yoktur — ama bizim hatamızsa ücretsiz yeniden basım.",
      detail:
        "Etiket/sticker sana özel basıldığı için iadesi başkasına satılamaz. Türk Tüketici Kanunu m.15/b 'kişiye özel olarak hazırlanan mallar' istisnası kapsamında cayma hakkı kullanılamaz. Ama: tasarımın hatalı basılmışsa, kalite sorunu varsa, kargoda hasar gördüyse → 7 gün içinde fotoğrafla bildir, ücretsiz yeniden basım + iade kargo yaparız.",
    },
    {
      q: "Tasarımım yanlış basılırsa?",
      summary: "Bizim hatamızsa ücretsiz yeniden basım + iade kargo.",
      detail:
        "Hata türleri: yanlış malzeme, eksik özellik (yaldız uygulanmamış), renk %15+ kayma, kesim/kontur hatası, hasarlı teslim. Fotoğraf çek → /iade-talep formunu doldur veya info@pimetiket.com mail at. 48 saat içinde inceleyip yeniden üretime alırız.",
    },
    {
      q: "Üründe çizik / hasar varsa?",
      summary:
        "Kargo hasarı: tutanak tut + bildir. Üretim hasarı: fotoğraf + yeniden basım.",
      detail:
        "Kargo kutusu zarar görmüş gibi görüyorsan TESLIM ALMA, tutanak tut (kargo firması zorunlu olarak yapar). Sonra biz kargo firmasından tazminat alıp size yenisini ücretsiz göndeririz. Açtıktan sonra hasar fark ettiysen 48 saat içinde fotoğrafla bildir.",
    },
    {
      q: "Renk benim ekrandakine göre farklı çıkarsa?",
      summary:
        "Ekran (RGB) ↔ matbaa (CMYK) farkı %5-10 kabul edilir.",
      detail:
        "Aynı PDF iki farklı monitörde bile farklı görünür (kalibrasyon, parlaklık, renk profili). Matbaa CMYK + 4-renk baskı; ekran RGB + 16M renk. Bu yüzden kanvas/UV efektli renkler tam birebir olamaz. Pantone spot renk istiyorsan sipariş sonrası WhatsApp'tan iletişime geç, ek prova baskı sürecimiz var.",
    },
    {
      q: "Hatalı tasarım yükledim, geri alabilir miyim?",
      summary: "Üretime girmeden önce evet — yeni dosya yükle, eski silinir.",
      detail:
        "/panelim/siparislerim → Sipariş detay → Tasarım dosyaları → Sil + Yeni yükle. Sipariş 2 saatlik üretim hazırlığı penceresinde değişiklik yapılır. Üretime girdiyse maalesef yeniden basım ücretli olur (özel üretim mantığı).",
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
      q: "KVKK kapsamında verilerim güvende mi?",
      summary:
        "Evet, 6698 sayılı KVKK uyumlu işliyoruz — veriler şifreli, üçüncü tarafa satılmaz.",
      detail:
        "Aydınlatma metni /kvkk sayfasında. Topladığımız veriler: ad-soyad, e-posta, telefon, fatura adresi, ödeme bilgisi (PayTR'da). Saklama süresi: sipariş kayıtları 10 yıl (VUK gereği), pazarlama izinli verileri silinme talebine kadar. Veri sahibi hakların: erişim, düzeltme, silme, taşınabilirlik, itiraz → /ayarlar/verilerim.",
    },
    {
      q: "Tasarımım başkalarıyla paylaşılır mı?",
      summary: "Hayır — tasarım dosyaların sadece üretim için kullanılır.",
      detail:
        "Yüklediğin PDF/PNG'ler Supabase Storage kişisel RLS (Row Level Security) ile saklanır — sadece sen + biz (üretim için) erişebiliriz. Üçüncü taraflara, başka müşterilere, pazarlama amaçlı asla kullanılmaz. AI training data lake için opsiyonel onay verirsen anonimleştirilmiş şekilde kalite iyileştirme için kullanılır (cayabilirsin).",
    },
    {
      q: "Verilerim ne kadar süre saklanır?",
      summary:
        "Sipariş 10 yıl (VUK), pazarlama silme talebine kadar, tasarım dosyaları 90 gün.",
      detail:
        "VUK (Vergi Usul Kanunu) gereği fatura ve sipariş kayıtları 10 yıl korunmalı. Bu sürede pazarlama amaçlı kullanmıyoruz, sadece muhasebe/denetim için. Tasarım dosyaları 90 gün sonra otomatik silinir (yeniden basım istersen tekrar yüklersin). Hesap silme talebinde tüm KVKK kapsamında veriler 30 gün içinde silinir.",
    },
    {
      q: "Mesafeli satış sözleşmesi nedir?",
      summary:
        "Online alışverişte zorunlu olan tarafların hak ve yükümlülüklerini belirleyen sözleşme.",
      detail:
        "/mesafeli-satis sayfasında tam metni var — sipariş öncesi otomatik gösterilir, 'kabul ediyorum' kutusunu işaretlemeden sipariş tamamlanmaz. İçeriği: ürün açıklaması, fiyat, ödeme, teslim, cayma hakkı (özel üretim hariç), iade koşulları, kişisel veri. Türk Tüketici Kanunu (TKHK) zorunlu unsurları içerir.",
    },
    {
      q: "Telif hakkı olan tasarım gönderirsem?",
      summary:
        "Müşteri sorumluluğunda — başkasının logosunu/markasını basamayız.",
      detail:
        "Sipariş ettiğin tasarımın fikri mülkiyet hakkına sahip olduğunu garanti ediyorsun. Başkasının markası (örn Adidas logosu), telif eseri (örn Marvel karakteri), patent ürünü basmak istersen — siparişi reddederiz. Şüpheli durumda yetki belgesi isteriz. Müşteri telif ihlalinden hukuki olarak sorumludur.",
    },
  ],
  yardim: [
    {
      q: "Pim sohbet butonu ne işe yarıyor?",
      summary:
        "AI asistan — ürün önerisi, malzeme seçimi, fiyat sorgulama, sipariş takibi.",
      detail:
        "Sağ altta karga ikonu — tıkla, sohbet başlasın. AI olarak: 'balsamik sirke etiketi için ne öneririm' gibi sorulara cevap, mevcut sipariş durumu sorgulama, kupon kodu, malzeme detayı, fiyat tahmini. Yapay zeka çıktıları hatalı olabilir, nihai sorumluluk müşteridedir — kritik kararlarda WhatsApp insan desteği.",
    },
    {
      q: "AI bana hangi konularda yardım edebilir?",
      summary:
        "Ürün seçim danışmanlığı, malzeme önerisi, tasarım ipuçları, sipariş takibi, fiyat tahmini.",
      detail:
        "Yapabildikleri: 'Bal kavanozuna nasıl etiket önerirsin?' → kraft + mat selefon; '100 sticker için kaç TL?' → canlı fiyat hesabı; 'Siparişim ne aşamada?' → durum bilgisi. Yapamadıkları: Hukuki tavsiye, vergi danışmanlığı, tasarımı kendisi YAPMAZ (sadece yönlendirme/öneri).",
    },
    {
      q: "İnsan müşteri hizmetlerine nasıl ulaşırım?",
      summary:
        "WhatsApp (en hızlı), info@pimetiket.com (24 saat), iletişim formu.",
      detail:
        "WhatsApp: en hızlı yanıt (iş saatleri içinde 30 dk, dışında 12 saat). E-posta: 24 saat içinde dönüş, detaylı sorunlar için. İletişim formu: /iletisim sayfasında, ürün/sipariş id ile birlikte. Telefon henüz aktif değil — Q2 2026'da açılır.",
    },
    {
      q: "WhatsApp / e-posta destek var mı?",
      summary: "Evet, WhatsApp ve e-posta ana iletişim kanalları.",
      detail:
        "Çalışma saatleri: hafta içi 09:00-18:00, hafta sonu 10:00-16:00 (acil siparişler için). Cevap süresi: WhatsApp 30 dk, e-posta 4-12 saat. Çoğu sorununu Pim AI çözer, çözmezse otomatik olarak insan operatöre yönlendirir.",
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
