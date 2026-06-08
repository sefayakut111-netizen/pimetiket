export type SssCategory =
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

export interface SssFaqItem {
  q: string;
  summary: string;
  detail: string;
}

export const SSS_CATEGORIES_TR: { id: SssCategory; name: string }[] = [
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

export const SSS_CATEGORIES_EN: { id: SssCategory; name: string }[] = [
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

export const SSS_FAQS_TR: Record<SssCategory, SssFaqItem[]> = {
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
        "Pim Etiket sisteminde tasarım dosyaları, KVKK 6698 sayılı kanun uyumlu olarak yalnızca kullanıcının erişebileceği kişisel depolama alanında saklanır. Bu güvenlik politikası gereği dosya yükleme işlemi için üye girişi zorunludur. Üyelik işlemi yalnızca e-posta ve şifre ile 30 saniyede tamamlanır. Üyelik avantajları arasında sipariş geçmişi takibi, tekrar sipariş kolaylığı ve çoklu fatura adresi tanımlama yer alır.",
    },
    {
      q: "Hangi ödeme yöntemlerini kabul ediyorsunuz?",
      summary:
        "Visa, Mastercard, Troy ve American Express kartları ile PayTR Sanal POS üzerinden 3D Secure güvenli ödeme kabul edilmektedir.",
      detail:
        "Pim Etiket'in ödeme altyapısı, BDDK lisanslı PayTR Sanal POS sistemidir. Türkiye'de en yaygın kullanılan ödeme aracılarından biri olan PayTR, PCI-DSS sertifikalı altyapısıyla kart bilgilerinizin güvenli işlenmesini sağlar. Her ödeme işlemi 3D Secure 2.0 standardına uygun olarak bankanız tarafından SMS veya mobil uygulama doğrulamasıyla onaylanır. Kapıda ödeme, havale/EFT ve kripto para ödeme yöntemleri kabul edilmemektedir; yalnızca kart ile online ödeme alınır.",
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
        "Tüketicinin Korunması Hakkında Kanun (TKHK) madde 15/b uyarınca, kişiye özel olarak üretilen ürünlerde cayma hakkı bulunmadığından, kapıda ödeme yöntemi Pim Etiket'in iş modeli için uygun değildir. Üretimi tamamlanan özel siparişlerin teslimat sırasında reddedilmesi durumunda doğacak maliyet riski nedeniyle bu yöntem desteklenmemektedir.",
    },
    {
      q: "Taksitli ödeme yapabilir miyim?",
      summary:
        "Bankanızın kart taksitlendirme kampanyaları PayTR ödeme ekranında otomatik olarak listelenir.",
      detail:
        "Pim Etiket, taksit işlemleri için ek komisyon talep etmez. Ödeme sayfasında kartınızın bağlı olduğu bankanın güncel taksit kampanyası otomatik olarak gösterilir. Tek çekim ödeme seçeneği her durumda mevcuttur. 500 ₺ altındaki siparişlerde bazı bankaların kart politikası gereği taksit seçeneği görüntülenmeyebilir.",
    },
    {
      q: "Fatura nasıl ve ne zaman kesilir?",
      summary:
        "E-arşiv faturanız sipariş onayını takip eden 7 iş günü içinde kayıtlı e-posta adresinize iletilir.",
      detail:
        "Pim Etiket faturaları SEFA YAKUT ETİKETBOX KIRTASİYE BASKI TİCARET LİMİTED ŞİRKETİ unvanıyla (Doğanbey Vergi Dairesi, VKN: 7580606076) e-Fatura olarak kesilir. Şirket adına fatura için sepet ekranında \"Şirket adına\" seçeneğini işaretleyerek unvan ve VKN bilgilerinizi girmeniz yeterlidir. Vergi mevzuatı uyarınca fatura, sipariş tarihinden itibaren 7 takvim günü içinde düzenlenir.",
    },
    {
      q: "Şirket adına fatura düzenlenebilir mi?",
      summary:
        "Evet, sepet ekranında 'Şirket adına' seçeneğiyle unvan, VKN ve vergi dairesi bilgilerini girmeniz yeterlidir.",
      detail:
        "Kurumsal müşterilerimiz için e-Fatura unvan, vergi kimlik numarası (VKN) ve bağlı bulunulan vergi dairesi bilgileri ile düzenlenir. Tüm fiyatlar KDV %20 dahil olarak görüntülenir; fatura üzerinde matrah ve KDV tutarı ayrı satırlarda detaylandırılır.",
    },
    {
      q: "Sipariş onay bildirimi nereden iletilir?",
      summary:
        "Sipariş onayı, üyelik e-postanıza anında gönderilir; ayrıca panel üzerinden de görüntülenebilir.",
      detail:
        "Sipariş tamamlandığı anda sipariş özetinizi ve tahmini teslim tarihinizi içeren onay e-postası info@pimetiket.com adresinden iletilir. Olası teslimat aksaklıklarını önlemek için e-postanızın spam klasörünü de kontrol etmenizi öneririz. Sipariş geçmişiniz ve aşama bilgileri /siparislerim sayfasında gerçek zamanlı olarak görüntülenir. Üretime giriş ve kargo teslim bildirimleri de aynı kanaldan gönderilir.",
    },
    {
      q: "Verdiğim siparişi iptal edebilir miyim?",
      summary:
        "Sipariş durumu uygunken (ödeme alındı veya tasarım bekleniyor) sipariş detayından iptal edilebilir; üretim başladıktan sonra iptal mümkün değildir.",
      detail:
        "Sipariş durumu ödeme alındı veya tasarım bekleniyor iken /siparislerim sayfasından ilgili siparişe girin ve Siparişi iptal et butonunu kullanın. Tasarım kontrolü veya üretim aşamasına geçildikten sonra panelden iptal edilemez; bu durumda /destek veya /iletisim üzerinden bize ulaşın. TKHK madde 15/b kapsamında kişiye özel üretilen ürünler için cayma hakkı bulunmamaktadır.",
    },
    {
      q: "Daha önce verdiğim siparişi tekrar verebilir miyim?",
      summary:
        "Evet — /siparislerim veya sipariş detayındaki «Tekrar sipariş» ile ürünleri sepete ekleyebilirsin.",
      detail:
        "Siparişlerim sayfasında veya sipariş detayında «Tekrar sipariş» butonuna basarak önceki siparişin ürün yapılandırmasını (malzeme, boyut, adet) sepete kopyalarsın. Tasarım dosyalarını yeniden yüklemen gerekir; güncel fiyatlar sepette otomatik hesaplanır ve /sepet üzerinden ödemeye geçilir.",
    },
  ],
  tasarim: [
    {
      q: "Hangi tasarım dosyası formatları kabul edilmektedir?",
      summary:
        "Pim Etiket sistemi; PDF, PNG, JPEG, AI, PSD ve SVG formatlarını kabul etmektedir.",
      detail:
        "Yüksek baskı kalitesi için PDF/X-1a veya AI formatı önerilir; bu formatlarda vektör veriler, font outline'ları ve renk profilleri korunur. PNG ve JPEG raster formatlarında 300 DPI çözünürlük tavsiye edilir. EPS formatı desteklenmez. Yüklenen dosyalar otomatik ön denetimden geçirilerek format, çözünürlük ve renk profili açısından kontrol edilir.",
    },
    {
      q: "Maksimum dosya boyutu ve yükleme limiti nedir?",
      summary:
        "Tek bir tasarım dosyası en fazla 30 MB olabilir; bir sipariş içinde 50 dosyaya kadar yükleme yapılabilir.",
      detail:
        "30 MB limiti, yüksek çözünürlüklü çok sayfalı PDF dosyaları için yeterli boyut sunar. Bu sınırı aşan dosyalarda Adobe Acrobat üzerinden Save As → Optimized PDF işlemi uygulanması veya PDF/X-1a profiline dönüştürülmesi önerilir. Boyut sorunu yaşamanız halinde WhatsApp aracılığıyla dosyanızı iletebilirsiniz; ekibimiz sisteme adınıza yükleyecektir. Yükleme limitleri, hem altyapı performansını korumak hem de dosya bütünlüğünü güvence altına almak amacıyla belirlenmiştir.",
    },
    {
      q: "Tasarım dosyamı sipariş anında yüklemek zorunda mıyım?",
      summary:
        "Hayır, tasarım dosyanızı sipariş onaylandıktan sonra panel üzerinden de yükleyebilirsiniz.",
      detail:
        "Konfigüratördeki tasarım yükleme alanı opsiyoneldir; bu adım atlandığı takdirde sipariş onaylanır ve dosyayı /siparislerim sayfasından ilgili siparişe girerek sipariş detayındaki tasarım yükleme alanından veya /siparis/[sipariş-no]/tasarim-yukle sayfasından sonradan ekleyebilirsiniz. Ön denetim ve baskı provası tamamlandıktan sonra /onay/[sipariş-no] sayfasından baskı önizlemenizi onaylamanız gerekir; onay sonrası üretime geçilir. Teslim süresinin gecikmemesi için dosyanın en kısa sürede yüklenmesi önerilir.",
    },
    {
      q: "Tasarım dosyasının çözünürlüğü kaç olmalıdır?",
      summary:
        "Tüm tasarım dosyaları, gerçek baskı boyutunda 300 DPI çözünürlükte hazırlanmalıdır.",
      detail:
        "300 DPI değeri, profesyonel matbaa standardı kabul edilen fotoğraf-baskı çözünürlüğüdür. Web ekranı için 72 DPI yeterli görünse de basıma alındığında bulanık bir sonuç oluşturur. Photoshop kullanıcıları Image → Image Size → Resolution: 300 ppi ayarını yapmalıdır; vektör tabanlı tasarım programlarında çözünürlük ölçek bağımsız olduğundan ek ayar gerekmez. Düşük çözünürlüklü dosyalar yüklendiğinde sistem otomatik uyarı verir; bu durumda ön denetim sonucunda WARNING bildirimi oluşur.",
    },
    {
      q: "Tasarımım CMYK mi RGB renk uzayında mı olmalıdır?",
      summary:
        "Renk uyumu açısından CMYK renk uzayı önerilir; RGB dosyalar baskı öncesinde otomatik olarak CMYK'ya dönüştürülür.",
      detail:
        "Ekran teknolojisi RGB (yayılan ışık) renk uzayında çalışırken matbaa baskı sistemleri CMYK (yansıyan mürekkep) renk uzayında çalışır. Bu iki sistem arasında özellikle parlak kırmızı, neon ve koyu mavi tonlarında doğal renk farklılıkları görülür. Renk doğruluğu kritik olan projeler için tasarım dosyasının doğrudan CMYK modunda hazırlanması en sağlıklı yaklaşımdır. Pantone spot renk gerektiren özel siparişlerde sipariş sonrasında WhatsApp aracılığıyla bizimle iletişime geçmeniz önerilir.",
    },
    {
      q: "Taşma payı (bleed) nasıl ayarlanmalıdır?",
      summary:
        "Tasarım dosyasının her kenarına 2-3 mm taşma payı eklenmeli; metin ve logo gibi kritik öğeler kesim çizgisinden 3 mm içeride konumlandırılmalıdır.",
      detail:
        "Örnek olarak 60×80 mm boyutunda bir etiket için tasarım dosyası 64×84 mm boyutunda hazırlanmalıdır (her kenarda 2 mm taşma). Matbaa kesim toleransı ±0,5 mm olduğundan kritik içerik (yazı, logo, çerçeve) güvenli alanda tutulmazsa kesim sırasında zarar görme riski oluşur. Sistem canlı önizlemede taşma çizgilerini görünür kılmaz ancak hesaplama aşamasında dikkate alır. PDF dışa aktarımında 'Bleed: 2 mm' seçeneği işaretlenmelidir.",
    },
    {
      q: "Tasarımdaki yazıları outline'a çevirmem gerekiyor mu?",
      summary:
        "Evet, font sistemimizde mevcut değilse otomatik değişikliği önlemek için tüm yazıların outline'a (eğriye) çevrilmesi gerekmektedir.",
      detail:
        "Adobe Illustrator kullanıcıları için Type → Create Outlines (Cmd/Ctrl+Shift+O) komutu, Photoshop kullanıcıları için katmanın rasterize edilmesi veya smart object'e dönüştürülmesi gereklidir. PDF dışa aktarımında 'Embed All Fonts' (tüm fontları göm) seçeneği aktif olmalıdır. Outline'a çevrilmemiş ve font dosyası gömülmemiş PDF'lerde font eksikliği ön denetim aşamasında FATAL uyarısı oluşturur ve üretim süreci başlatılmaz.",
    },
    {
      q: "Tasarımı kendim hazırlayabilir miyim, hangi araçları kullanmalıyım?",
      summary:
        "Evet, Canva, Adobe Express ve Figma gibi ücretsiz online tasarım araçlarıyla hazırladığınız tasarımları PDF veya PNG formatında sisteme yükleyebilirsiniz.",
      detail:
        "Pim Etiket dahili tasarım şablonu kütüphanesi sunmamaktadır; ancak internet üzerindeki ücretsiz tasarım araçları profesyonel sonuçlar elde etmenizi sağlar. En yaygın araçlar: Canva (binlerce hazır etiket ve sticker şablonu), Adobe Express (hızlı ve sezgisel arayüz), Figma (ücretsiz sürüm, profesyonel görünüm) ve VistaCreate / Crello. Tasarımınızı tamamladıktan sonra PDF veya PNG olarak dışa aktarıp Pim Etiket konfigüratörüne yükleyebilirsiniz. Sayfanın sağ alt köşesindeki Pim sohbet asistanına ürün veya sektör adınızı yazarak; renk, font ve kompozisyon önerileri alabilirsiniz. Profesyonel grafik tasarım desteği için WhatsApp üzerinden yönlendirme yapılmaktadır.",
    },
    {
      q: "Çoklu tasarım siparişi nasıl çalışır, indirim oranı nedir?",
      summary:
        "Aynı siparişte birden fazla tasarımda kademeli indirim uygulanır; kesin oran konfigüratörde görünür.",
      detail:
        "Konfigüratördeki «Tasarım sayısı» alanına yazdığınız değer kadar farklı tasarımdan, seçtiğiniz adet kadar baskı üretilir. Aynı siparişte birden fazla tasarım eklediğinizde birim fiyatta otomatik indirim uygulanır; güncel oranı konfigüratör ve sepet ekranında anlık görürsünüz. Her tasarım için ayrı dosya yüklenmesi gerekir.",
    },
    {
      q: "Yüklediğim tasarıma Pim Etiket tarafından müdahale ediliyor mu?",
      summary:
        "Hayır, tasarımlar olduğu gibi basılır; yalnızca ön denetim sürecinde teknik uyarılar müşteri ile paylaşılır.",
      detail:
        "Tasarım içeriğinize (renk, metin, kompozisyon) hiçbir şekilde müdahale edilmez. Ön denetim aşamasında otomatik yapay zeka kontrolü ve gerekli durumlarda matbaa ekibi denetimi gerçekleştirilir; DPI değeri, font outline durumu, taşma payı, mürekkep doygunluğu (%320 üzeri toplam ink coverage) ve kontur kesim hatları kontrol edilir. Teknik sorun tespit edildiğinde sipariş 'Onay bekleniyor' durumuna alınır ve müşteri tarafından düzeltilmiş dosyanın yüklenmesi beklenir. İçerik değişikliği yalnızca müşterinin açık talebi doğrultusunda gerçekleştirilir.",
    },
  ],
  malzeme: [
    {
      q: "Ürünüm için hangi malzemeyi seçmeliyim?",
      summary:
        "Malzeme seçimi, ürünün kullanılacağı ortama göre belirlenir: gıda ürünleri için kuşe/kraft, su ve buzdolabı için opak PP, premium ürünler için metalize, cam şişeler için ultra clear film önerilir.",
      detail:
        "Pim Etiket /malzemeler sayfasında her malzeme için kullanım alanı, yüzey özellikleri ve dayanım kriterleri ayrıntılı olarak listelenmiştir. Doğru malzeme seçimi; etiketin ürün ömrü boyunca okunaklı kalmasını, marka algısının korunmasını ve mevzuat uyumunun sağlanmasını mümkün kılar. Karar aşamasında destek almak için sayfanın sağ alt köşesindeki Pim sohbet asistanına ürün adınızı (örneğin 'balsamik sirke cam şişe etiketi') yazmanız yeterlidir; sistem ortam koşullarına uygun malzeme önerisi sunar.",
    },
    {
      q: "Kuşe etiket ile Kraft etiket arasındaki fark nedir?",
      summary:
        "Kuşe etiket; pürüzsüz beyaz parlak yüzeyiyle renkleri canlı bir şekilde aktarır; Kraft etiket ise kahverengi doğal lifli yapısıyla organik ve el yapımı bir hava sunar.",
      detail:
        "Kuşe etiket, geniş bir ürün yelpazesi için tercih edilen genel amaçlı bir kağıt türüdür ve ev temizlik ürünleri, kozmetik, gıda ve ilaç sektörlerinde sıklıkla kullanılır. Kraft etiket ise eko-bilinçli markalar, el yapımı sabun, organik gıda, baharat ve çay ürünleri için tercih edilir; doğal kahverengi rengi marka mesajını destekler. Kraft yüzey üzerine yapılan baskılar doğal olarak daha mat görünür; beyaz mürekkep baskısı yapılmadığı için açık renklerin canlılığı kağıdın ham rengiyle bütünleşir.",
    },
    {
      q: "Opak PP malzeme hangi kullanım alanları için uygundur?",
      summary:
        "Opak PP (polipropilen) malzeme; yırtılmaz, suya, yağa ve donmaya dayanıklı bir plastik etiket çözümüdür.",
      detail:
        "Polipropilen, kağıt etiketlerden farklı olarak ıslandığında yırtılmaz, donmaya dayanır ve yağ emmez. Bu özellikleri sayesinde buzdolabı, dondurucu ve soğuk zincir gıda ürünleri, sıvı sabun, deterjan, şampuan ve temizlik ürünlerinde tercih edilen bir malzemedir. Kağıt etiketlerde yaygın görülen kıvrılma, sararma ve nem deformasyonu sorunları opak PP yüzeylerde yaşanmaz; bu da uzun raf ömrü gerektiren ürünler için ideal bir çözüm sunar.",
    },
    {
      q: "Ultra Clear etiket ile Şeffaf Etiket arasındaki fark nedir?",
      summary:
        "Ultra Clear etiket tamamen film yapısında olup otomatik aplikatör makineler için tasarlanmıştır; Şeffaf Etiket ise kağıt bazlı saydam yapısıyla elle uygulamaya uygundur.",
      detail:
        "Ultra Clear etiket cam berraklığında bir görünüm sunar; yalnızca basılan tasarım görünür, etiket sınırı fark edilmez. Bu özelliği nedeniyle profesyonel cam şişeler, parfüm ürünleri ve premium içeceklerde tercih edilir. Ancak elle yapıştırmaya uygun değildir; kayma ve hava kabarcığı oluşumu nedeniyle otomatik aplikatör makinesi gereklidir. Şeffaf Etiket daha standart bir film yapısına sahiptir, elle uygulamaya elverişlidir ve küçük ölçekli işletmeler ile el yapımı ürünler için uygundur.",
    },
    {
      q: "Metalize Etiket zaman içinde parıltısını kaybeder mi?",
      summary:
        "Hayır, metalize etiketler alüminyum kaplama yapısı sayesinde UV ışınlarına, suya ve temasa karşı uzun süreli dayanım gösterir.",
      detail:
        "Metalize etiket; gümüş alüminyum yüzey ve üzerine uygulanan akrilik koruma katmanından oluşur. Premium çikolata, şarap, viski ve parfüm ürünlerinde standart bir tercih olarak öne çıkar. Beyaz mürekkep baskısı uygulanmadığı için renkler metalik zemin üzerinde yumuşak bir görünüm kazanır. Opak ve canlı bir renk vurgusu isteniyorsa tasarımın koyu veya yüksek doygunluklu renklerle hazırlanması önerilir; bu yaklaşım metalik yüzeyin görsel etkisini destekler.",
    },
    {
      q: "Mat Selefon ve Parlak Selefon kaplamaların farkı nedir?",
      summary:
        "Mat ve parlak selefon; etiket yüzeyine uygulanan koruyucu film kaplamalarıdır. Çizik ve aşınmalara karşı dayanım sağlar ve görsel hissi belirler.",
      detail:
        "Parlak Selefon, yüksek yansıma değeri ve canlı renkler sunar; klasik perakende ürünlerde tercih edilir. Mat Selefon ise yansımayı ortadan kaldırarak premium ve sade bir his uyandırır; dokunulduğunda yumuşak bir doku verir. Her iki selefon türü de su geçirmezliği artırır ve çizik dayanımını yükseltir. Kaplama seçiminin fiyat etkisini konfigüratörde anlık görürsünüz.",
    },
    {
      q: "Soft Touch kaplama hangi ürünler için uygundur?",
      summary:
        "Soft Touch; kadife veya şeftali kabuğu dokusunda yumuşak mat bir kaplamadır ve premium algı oluşturan ürünler için tercih edilir.",
      detail:
        "Soft Touch kaplama, parmak ucuyla dokunulduğunda hissedilen yumuşak doku ile diğer kaplamalardan ayrışır. Kozmetik, parfüm ve premium hediye etiketlerinde tercih edilen bir çözümdür; lüks marka algısı oluşturmaya katkı sağlar. Soft Touch kaplama yalnızca rulo etiket üretiminde mevcuttur (rulo sipariş 29 Haziran 2026'da açılacak); tabaka etiket üretiminde sunulmamaktadır.",
    },
    {
      q: "Spot UV, Emboss ve Sıcak Yaldız özelleştirmeleri kombine edilebilir mi?",
      summary:
        "Evet, Spot UV, Emboss ve Sıcak Yaldız özelleştirmeleri tek bir tasarım üzerinde kombine olarak uygulanabilir (yalnızca rulo etiket modunda).",
      detail:
        "Konfigüratördeki Özelleştirme adımında çoklu seçim yapılabilir; birden fazla efekt aynı etiket üzerine uygulanabilir. Rulo etiket siparişi şu an kapalıdır — 29 Haziran 2026'da açılacak; şimdilik tabaka etiket ve sticker siparişi verilebilir. Hangi alana hangi özelleştirmenin uygulanacağını belirtmek için tasarım dosyasının PDF formatında ayrı katmanlar halinde hazırlanması gerekir; Spot UV katmanı «SpotUV» adıyla ve sıcak yaldız katmanı ilgili Pantone numarasıyla işaretlenmelidir.",
    },
    {
      q: "Holografik ve Simli sticker malzemeleri arasındaki fark nedir?",
      summary:
        "Holografik malzeme; ışıkta gökkuşağı renkleri yansıtan düz iridescent bir film yapısına sahiptir. Simli malzeme ise içinde parıltı taneleri (glitter) barındıran dekoratif bir yüzey sunar.",
      detail:
        "Holografik film düz bir yüzeye sahiptir ve ışık açısına göre renk değişimi (baklava deseni) gösterir; bu özelliği yüksek görünürlük gerektiren ürünlerde tercih edilir. Simli film daha festival ve parti havası sunar; taneler ışığı kırarak parıldama efekti oluşturur. Etkinlik organizasyonu, çocuk ürünleri ve kırtasiye sektörü için ideal seçeneklerdir. İç mekan kullanımında her iki film de uzun ömürlüdür; dış mekan koşullarında 6-12 ay sonra UV etkisiyle matlaşma görülebilir.",
    },
    {
      q: "Sticker ürünleri dış mekanda kaç yıl dayanıklılığını korur?",
      summary:
        "Vinil sticker dış mekan koşullarında 3-5 yıl, holografik ve simli sticker ise yaklaşık 6-12 ay dayanım gösterir.",
      detail:
        "Vinil sticker UV ışınlarına ve neme karşı yüksek dayanım sağlar; laptop, su şişesi, otomobil ve vitrin uygulamaları için ideal seçenektir. 60°C sıcaklığa kadar deformasyona uğramaz; çamaşır makinesi gibi yüksek sıcaklık ortamlarına dahi dayanıklıdır. Holografik ve simli özel filmler ise dış mekan UV ışınlarına karşı daha duyarlıdır ve iç mekan kullanımı için optimumdur. Transparan vinil malzeme; standart vinilin tüm dayanım özelliklerini taşır, yalnızca şeffaf zemin sunması açısından farklılık gösterir.",
    },
  ],
  kesim: [
    {
      q: "Rulo etiket ile Tabaka etiket arasındaki fark nedir?",
      summary:
        "Rulo etiket; silindir biçiminde sarılı, otomatik aplikatör makineler için tasarlanmıştır. Tabaka etiket ise düz sayfa formatında yarı kesimli olarak hazırlanır ve elle uygulamaya uygundur.",
      detail:
        "Rulo etiket üretimi; minimum 1.000 adetlik siparişler için sürekli makine akışında gerçekleştirilir ve endüstriyel ölçekte şişe etiketleme, kavanoz ve kozmetik aplikasyonlarında tercih edilir. Rulo sipariş şu an kapalıdır — 29 Haziran 2026'da açılacak. Tabaka etiket ise minimum 250 adet ile SRA3 (320×450 mm) tabakada yarı kesimli olarak üretilir; etiketler elle ayrılarak ürüne uygulanır ve küçük tirajlı el yapımı ürünler için ideal bir çözümdür. Konfigüratörde Etiket türü ilk adım olarak seçilir; Tabaka tercih edildiğinde sarım yönü ve göbek çapı adımları otomatik olarak devre dışı kalır.",
    },
    {
      q: "Rulo etiket mi Tabaka etiket mi seçmeliyim?",
      summary:
        "1.000+ adet sipariş ve otomatik aplikatör kullanıyorsanız Rulo etiket; 250-1.000 arası tirajlı el uygulaması yapıyorsanız Tabaka etiket önerilir.",
      detail:
        "Rulo etiket üretimi için ekonomik eşik 1.000 adettir. Rulo sipariş şu an kapalıdır — 29 Haziran 2026'da açılacak; şimdilik tabaka etiket (min. 250 adet) veya sticker tercih edilebilir. Tabaka etiket otomatik aplikatör makineye uygun değildir; elle ayırma ve uygulama gerektirir. El yapımı sabun, kozmetik ve küçük seri üretim için Tabaka etiket önerilirken; içecek, parfüm ve seri üretim için Rulo etiket tercih edilmelidir.",
    },
    {
      q: "Rulo etikette sarım yönü ne anlama gelir?",
      summary:
        "Sarım yönü; etiketin rulo üzerinde içe mi dışa mı bakacak şekilde sarılacağını belirler ve otomatik aplikatör makine kullanan müşteriler için kritik bir parametredir.",
      detail:
        "Pim Etiket sisteminde dört farklı sarım yönü sunulmaktadır: yön 1 (en yaygın ve önerilen), yön 2, yön 3 ve yön 4. Etiket konfigüratörü ekranındaki canlı önizleme alanında, 'ABC' referans metni üzerinden seçilen sarım yönü görsel olarak doğrulanabilir. Aplikatör makinenin sarım yönü ile uyumsuz seçim yapılması, etiketin ters yapışmasına neden olur. Elle uygulama yapan müşteriler için sarım yönü kritik değildir; yön 1 varsayılan olarak önerilir. Şüphe halinde aplikatör makine kullanım kılavuzu veya bayinin verdiği yön kodu (örneğin 'U-IN') referans alınabilir.",
    },
    {
      q: "Rulo göbek çapı (1\" / 1.5\" / 3\" / 4\") nedir, nasıl seçilmelidir?",
      summary:
        "Rulo göbek çapı, rulonun iç boru çapını (core) ifade eder ve aplikatör makinenin teknik özelliklerine göre seçilmelidir.",
      detail:
        "Endüstri standardı 3 inch (76 mm) göbek çapıdır; büyük ölçekli endüstriyel aplikatör makinelerinde tercih edilir. 1 inch (25 mm) göbek; masaüstü ve küçük laboratuvar makineleri için uygundur. 1,5 inch ve 4 inch göbek çapları ara boyutlar olarak sunulur ancak daha az tercih edilir. Aplikatör makineye sahip olmayan müşteriler için 3 inch varsayılan değerdir. Tabaka etiket seçildiğinde göbek çapı adımı konfigüratörden otomatik olarak kaldırılır. Yanlış göbek çapı seçimi, rulonun aplikatör makineye uyum sağlayamaması sonucunu doğurur.",
    },
    {
      q: "Tabaka sticker ile Kontur Kesim (Die-Cut) sticker arasındaki fark nedir?",
      summary:
        "Tabaka sticker; sayfada yarı kesimli olarak üretilir ve müşteri tarafından elle ayrılır. Die-Cut (kontur kesim) sticker ise her birimin tasarım silüetine göre tek tek özel olarak kesilmesi yöntemidir.",
      detail:
        "Tabaka sticker; toplu dağıtım, etkinlik ve kırtasiye uygulamaları için tercih edilir; örneğin tek bir A4 tabakada 8 sticker yarı kesimli olarak yer alabilir. Die-Cut sticker ise profesyonel ürün ambalajlama için tasarlanmıştır; her birim hazır halde teslim edilir ve 2,5 mm beyaz kontur çerçevesi sticker'a karakteristik bir görünüm kazandırır. Die-Cut üretiminde tasarım PNG dosyasının alpha kanalı kesim yolunu otomatik olarak belirler; düz arka planlı PNG dosyası yüklenmesi durumunda sistem kesim sınırını otomatik olarak hesaplar.",
    },
    {
      q: "Kontur kesim sticker'da her şekil üretilebilir mi?",
      summary:
        "Evet, kontur kesim teknolojisi sayesinde tasarımın silüeti ne ise sticker tam o şekilde kesilebilir.",
      detail:
        "Kalp, yıldız, yaprak, dalga, balon, logo silüeti, özgün karakter tasarımları ve diğer karmaşık formlarda hiçbir şekil sınırlaması bulunmaz. Üretim için tasarım dosyası PNG formatında şeffaf arka planlı olarak veya AI/PSD formatında vektör path içerecek şekilde yüklenmelidir. 1 mm altındaki çok ince çıkıntılar üretim sırasında kopabileceğinden sistem otomatik olarak 1 mm minimum kenar payı uygular. Kontur kesim, her birimin lazer veya kalıp ile özel olarak kesilmesini sağladığından el yapımı ürün görünümünden profesyonel marka logosuna kadar geniş bir uygulama yelpazesi sunar.",
    },
    {
      q: "Yumuşatılmış köşe (bumper) seçeneği nedir?",
      summary:
        "Yumuşatılmış köşe; dikdörtgen sticker'ların köşelerinin yuvarlatılmış halidir ve pill veya bumper sticker görünümü oluşturur.",
      detail:
        "Standart kare ve dikdörtgen sticker'lar varsayılan olarak keskin köşeli (radius 0) üretilir. Yumuşatılmış köşe seçeneği işaretlendiğinde 16-36 piksel arası bir köşe yumuşatma uygulanır; bu da otomobil bumper sticker'ları, pill formu ve kart benzeri görünümler için ideal bir estetik sağlar. Özel form (örneğin 100×40 mm) ile birlikte yumuşatılmış köşe seçildiğinde klasik bumper sticker görünümü elde edilir; konfigüratör bu seçim için varsayılan bumper boyutunu otomatik olarak uygular.",
    },
  ],
  boyut: [
    {
      q: "Rulo etikette neden minimum 1.000 adet sipariş zorunluluğu vardır?",
      summary:
        "1.000 adet minimum sipariş; fason rulo etiket üretiminin ekonomik eşiğidir ve birim fiyatın sürdürülebilir kalmasını sağlar.",
      detail:
        "Rulo etiket üretimi, flexografi ve dijital baskı makinelerinde gerçekleştirilir; bu makinelerde mürekkep değişimi, prova baskı ve kalibrasyon süreçleri ortalama 1-2 saat sürer. 1.000 adet altındaki siparişlerde bu hazırlık (setup) maliyeti birim fiyata aşırı oranda yansıyacağı için ekonomik açıdan sürdürülebilir değildir. Daha düşük adetli siparişler için Tabaka etiket (minimum 250 adet) veya Sticker tabaka (minimum 25 adet) seçenekleri konfigüratörde sunulmaktadır.",
    },
    {
      q: "Sticker'da minimum sipariş adedi neden 25 olarak belirlenmiştir?",
      summary:
        "Sticker tabaka 25 adet minimumu; SRA3 tabakanın standart sticker boyutuyla tamamen dolacak şekilde optimize edilmesinden kaynaklanır.",
      detail:
        "SRA3 tabaka (320×450 mm) 25 standart sticker (75×75 mm) ile tam olarak dolar; bu rakamın altındaki sipariş tabakanın boş kalmasına ve verim kaybına neden olur. 25 adet sticker tek bir tabakaya basılır ve müşteri tarafından elle ayrılır veya kontur kesim (die-cut) uygulamasında bireysel olarak kesilir. Bu adet; hediyelik ürünler, kurumsal etkinlikler, kırtasiye uygulamaları ve kişisel kullanım için optimum bir başlangıç miktarıdır.",
    },
    {
      q: "Maksimum kaç adet sipariş verilebilir?",
      summary:
        "Konfigüratördeki adet üst sınırına kadar sipariş verebilirsin; çok yüksek tutarlar için sepet limiti uygulanır.",
      detail:
        "Etiket ve sticker siparişlerinde konfigüratörde seçilebilen maksimum adet sınırı vardır. Sepet toplamı belirli bir üst limite ulaştığında ödeme ekranına geçilemez; bu durumda /iletisim veya WhatsApp üzerinden bize yazabilirsin. Adet arttıkça birim fiyat konfigüratörde otomatik düşer.",
    },
    {
      q: "Tabaka etikette tek tabakaya kaç adet etiket sığar?",
      summary:
        "Tek SRA3 tabakaya sığacak etiket sayısı; etiket boyutuna göre değişir ve canlı önizleme ekranında gerçek değerle görüntülenir.",
      detail:
        "Hesaplama; SRA3 (320×450 mm) tabaka üzerinde etiketler arası 2 mm boşluk dikkate alınarak gerçekleştirilir. Sistem algoritması en yüksek verimliliği sağlayan yerleşimi (yatay veya çevrilmiş yön) otomatik olarak seçer. Örnek hesaplamalar: 30×50 mm etiket ≈ 84 adet, 60×80 mm etiket ≈ 30 adet, 100×150 mm etiket ≈ 9 adet. Canlı önizleme ekranındaki tabaka diyagramında sütun × satır olarak yerleşim ızgara biçiminde gösterilir; bu sayede müşteri her tabakadan kaç adet etiket alacağını net olarak görüntüleyebilir.",
    },
    {
      q: "Özel form sticker seçeneği nedir?",
      summary:
        "Özel form sticker seçeneği; standart kare veya yuvarlak boyutlar yerine müşterinin belirleyeceği en-boy oranıyla üretim imkanı sunar.",
      detail:
        "Standart 75×75 mm kare sticker dışında, özel form seçeneği ile 100×40 mm bumper sticker veya 25×255 mm çubuk sticker gibi farklı geometrilerde üretim yapılabilir. Konfigüratörde 'Özel form' seçildiğinde sistem otomatik olarak bumper boyutunu (100×40 mm) varsayılan değer olarak uygular; bu değer boyut adımında müşteri tarafından düzenlenebilir. Köşe seçimi ile keskin köşeli veya yumuşatılmış köşeli (bumper sticker görünümü) arasında tercih yapılabilir.",
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
        "1000 ₺ ve üzeri siparişlerde kargo ücretsizdir; altında kargo ücreti sepette görünür.",
      detail:
        "1000 ₺ altı siparişlerde kargo ücreti sepete otomatik eklenir; tutarı ödeme öncesi sepet ekranında görürsün. Gönderimler Yurtiçi Kargo (birincil) ve DHL ile Türkiye geneli kapı teslim yapılır. Adres erişiminin zor olduğu bölgelerde ek ücret çıkması durumunda sipariş onayı sonrasında bilgilendirilirsiniz.",
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
        "Evet, adet arttıkça birim fiyat düşer; güncel fiyatı konfigüratörde anlık görürsün.",
      detail:
        "Konfigüratörde adet seçicisini değiştirdiğinizde toplam fiyat ve birim maliyet anlık güncellenir. Adet kademelerine göre otomatik indirim uygulanır; kesin oran ve tutar sepet ekranında görünür.",
    },
    {
      q: "Çoklu tasarım indirimi nasıl uygulanır?",
      summary:
        "Aynı siparişte birden fazla tasarımda kademeli indirim uygulanır; kesin oran konfigüratörde görünür.",
      detail:
        "Aynı siparişe birden fazla tasarım eklediğinizde birim fiyatta otomatik indirim uygulanır. Güncel indirim oranını konfigüratör ve sepet ekranında anlık görürsünüz. Her tasarım için ayrı PDF veya PNG dosyası yüklenmesi gerekir.",
    },
    {
      q: "İndirim kuponu nasıl kullanılır?",
      summary:
        "Ödeme sayfasındaki 'Kupon kodun var mı?' alanına kodu yazıp 'Uygula' butonuna basmanız yeterlidir.",
      detail:
        "Pim Etiket'te yüzde indirim, sabit indirim ve ücretsiz kargo kuponları sunulmaktadır. Kupon alanı /odeme (checkout) ekranında sipariş özetinin altında yer alır. Kuponlar minimum sepet tutarı veya kullanım süresi şartı içerebilir; bu bilgiler kupon detay sayfasında belirtilir. Aktif kampanyalar için Pim Etiket sohbet asistanına \"kupon var mı?\" sorusunu yöneltebilirsiniz; sistem geçerli kuponları size sunar.",
    },
  ],
  uretim: [
    {
      q: "Pim Etiket üretim süresi ne kadardır?",
      summary:
        "Sticker 3, tabaka etiket 3, rulo etiket 10 iş günü (tasarım onayından sonra; resmi tatiller hariç).",
      detail:
        "Üretim süreleri tasarım onayınızdan sonra başlar; cumartesi, pazar ve resmi tatil günleri sayılmaz. Sticker: 3 iş günü. Tabaka etiket: 3 iş günü. Rulo etiket: 10 iş günü (rulo sipariş 29 Haziran 2026'da açılacak). Üretim tamamlandıktan sonra kargo süresi eklenir (İstanbul 1, diğer iller 2-3 iş günü). Tahmini teslim tarihi konfigüratör ve sepet ekranında otomatik gösterilir.",
    },
    {
      q: "Siparişlerinizi hangi kargo firmasıyla gönderiyorsunuz?",
      summary:
        "Yurtiçi Kargo (birincil) ve DHL ile Türkiye geneli kapı teslim gönderim yapılır.",
      detail:
        "Pim Etiket siparişleri Yurtiçi Kargo (birincil) ve DHL aracılığıyla gönderilir; Aras veya MNG kullanılmaz. Teslimat süresi İstanbul içi 1 iş günü, diğer iller için 2-3 iş günü olarak gerçekleşir. Kargo takip numaranız sipariş kargoya verildiğinde sistemde görünür ve kayıtlı e-posta adresinize iletilir. Eksik veya hatalı adres nedeniyle iade olan siparişlerin yeniden gönderim ücreti müşteriye aittir.",
    },
    {
      q: "Tahmini teslim tarihi sipariş ekranında gösteriliyor mu?",
      summary:
        "Evet, sepete eklediğiniz andan itibaren tahmini teslim tarihi konfigüratör ekranında otomatik gösterilir.",
      detail:
        "Hesaplama formülü: sipariş tarihi + üretim süresi (sticker 3, tabaka etiket 3, rulo etiket 10 iş günü) + kargo süresi (1-3 iş günü). Hafta sonları ve resmi tatil günleri sayılmaz. Olası gecikmede beklenen teslim tarihinden en az 48 saat önce e-posta ve sistem bildirimi ile bilgilendirilirsiniz.",
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
        "Evet, siparişlerinizin tüm üretim ve kargo aşamalarını /siparislerim sayfasından gerçek zamanlı takip edebilirsiniz.",
      detail:
        "Sipariş takip akışı şu aşamaları içerir: Sipariş alındı → Tasarım onaylandı → Üretime girdi → Üretim tamamlandı → Kalite kontrolde → Kargoya verildi → Teslim edildi. Her aşama değişiminde sistem tarafından otomatik olarak e-posta bildirimi gönderilir. Sipariş geçmişiniz ve fatura kayıtlarınız da aynı panelden erişilebilir durumdadır.",
    },
    {
      q: "Sipariş verdikten sonra teslimat adresini değiştirebilir miyim?",
      summary:
        "Panelde doğrudan adres düzenleme yok; kargoya verilmeden önce destek veya iletişim üzerinden talep edebilirsiniz.",
      detail:
        "Sipariş detayında teslimat adresi salt okunur gösterilir; panelde adres düzenleme özelliği bulunmaz. Adres değişikliği için /destek üzerinden destek talebi açın veya /iletisim sayfasından bize ulaşın; üretim aşamasına göre güncelleyelim. Sipariş kargoya verildikten sonra değişiklik mümkün değildir. Sipariş esnasında adres bilgilerinizi dikkatli girmenizi öneririz.",
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
        "Sipariş durumu uygunken (ön denetim veya düzeltme aşamasında) dosyanızı panelden yeniden yükleyebilirsiniz.",
      detail:
        "/siparislerim sayfasından ilgili siparişe girin; sipariş detayındaki tasarım yükleme alanından veya /siparis/[sipariş-no]/tasarim-yukle sayfasından yeni dosyayı yükleyebilirsiniz. Dosya değişikliği, sipariş durumu yükleme veya düzeltme aşamasındayken mümkündür; baskı provası onaylandıktan veya üretim başladıktan sonra değişiklik kabul edilmez. Bu durumda /destek üzerinden bize ulaşın veya kişiye özel üretim ilkesi gereği yeni bir sipariş açın.",
    },
  ],
  onizleme: [
    {
      q: "Canlı önizleme ne kadar gerçekçidir?",
      summary:
        "Canlı önizleme; malzeme dokusu, kaplama parlaklığı, boyut oranı ve yerleşim açısından gerçek üretimle birebir uyumludur. Renk hassasiyeti ise monitör kalibrasyonuna bağlı olarak farklılık gösterebilir.",
      detail:
        "Önizleme ekranında gerçek üretim sonucuyla birebir aktarılan unsurlar şunlardır: malzeme zemini (kuşe, kraft, metalize, ultra clear), kaplama efekti (mat selefon, parlak selefon, soft touch), özelleştirme katmanları (sıcak yaldız, emboss, Spot UV), boyut oranı (60×80 mm ile 75×75 mm görsel farkı) ve tabaka yerleşimi (sütun × satır ızgarası). Tam birebir aktarılamayan unsurlar arasında ise ekran-baskı arasındaki renk uzayı farkından (RGB ↔ CMYK) kaynaklanan ton sapması ve kağıt kalınlığı/dokunsal his yer alır. Yüksek hassasiyet gerektiren kurumsal projeler için sipariş öncesinde fiziksel prova baskı talep edilebilir.",
    },
    {
      q: "3D önizleme modu ile Eskiz modu arasındaki fark nedir?",
      summary:
        "3D modu; malzeme dokusu ve hafif perspektif ile gerçekçi bir sunum sağlar. Eskiz modu ise mercan rengiyle dolgulu matbaa diyagramı görünümüyle yerleşim planını detaylı aktarır.",
      detail:
        "Pim Etiket önizleme paneli üzerindeki toggle ile iki mod arasında geçiş yapılabilir. 3D modu; malzeme zemini, parlaklık efekti ve hafif perspektif ile 'ürün son halinde böyle görünecek' algısı sunar. Bu mod özellikle müşteri sunumları ve mockup ihtiyaçları için tercih edilir. Eskiz modu ise tabakaya kaç adet etiket sığacağını ve yerleşim planını net bir şekilde aktarır; matbaa üretim diyagramına benzer bir görsellik ile teknik açıdan değerlendirme yapma imkanı sağlar.",
    },
    {
      q: "Önizlemede gördüğüm tasarım, basılı ürünle aynı mı olacak?",
      summary:
        "Evet, canlı önizleme üretim referansıdır; boyut oranı, malzeme tipi ve özelleştirme katmanları birebir uygulanır.",
      detail:
        "Yüklenen PDF veya PNG tasarım dosyası, önizleme hücresinde otomatik olarak ortalı şekilde konumlandırılır. Üretim aşamasında aynı yerleşim uygulanır; sistem 2 mm taşma payını otomatik olarak ekler. Malzeme tipi (kuşe, kraft, metalize), kaplama (mat, parlak, soft touch) ve özelleştirme (yaldız, emboss, Spot UV) öğeleri birebir aktarılır. Yalnızca renk hassasiyeti açısından, ekran ile baskı arasındaki doğal renk uzayı farkından kaynaklanan %5-10 oranında sapma olağan kabul edilir.",
    },
    {
      q: "Üretim öncesi tasarım onay süreci nasıl işlemektedir?",
      summary:
        "Tasarım yüklendikten sonra yapay zeka ön denetimi yapılır; ardından baskı provanı /onay sayfasından onaylamanız gerekir.",
      detail:
        "Ön denetim sürecinde yapay zeka tabanlı kontrol mekanizması; DPI değeri, font outline durumu, taşma payı, mürekkep doygunluğu (%320 üzeri toplam ink coverage), kontur kesim hatları ve 1 mm altındaki ince çıkıntılar gibi teknik parametreleri analiz eder. Sorun tespit edildiğinde sipariş düzeltme aşamasına alınır ve müşteriye yeniden dosya yükleme talebi iletilir. Ön denetim tamamlandıktan sonra baskı provası hazırlanır; /onay/[sipariş-no] sayfasından tüm kalemleri onaylamanız gerekir. Onay sonrası üretime geçilir — otomatik üretim yoktur.",
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
        "Tasarım dosyalarınız (PDF, PNG, JPEG, AI, PSD, SVG), Supabase Storage altyapısında Row Level Security (RLS) ile kişisel hesabınıza bağlı olarak şifreli saklanır. Bu dosyalara yalnızca siz ve üretim ekibimiz erişebilir. Pazarlama, reklam veya başka müşterilere örnek gösterme gibi amaçlarla asla kullanılmaz. OpenAI API kullanımında sohbet verileri model eğitimi için kullanılmaz (OpenAI API tier kuralı).",
    },
    {
      q: "Verilerim ne kadar süre saklanıyor?",
      summary:
        "Sipariş kayıtları 10 yıl (VUK gereği), pazarlama verileri silme talebine kadar, tasarım dosyaları son siparişten itibaren 24 ay saklanır.",
      detail:
        "Vergi Usul Kanunu gereği fatura ve sipariş kayıtları 10 yıl boyunca muhasebe ve denetim amacıyla korunur; bu süreçte pazarlama amaçlı kullanılmaz. Tasarım dosyaları, yeniden basım taleplerini desteklemek için son siparişten itibaren 24 ay boyunca tutulur ve sonrasında otomatik olarak silinir. Hesap silme talebinde bulunmanız halinde KVKK kapsamındaki tüm kişisel verileriniz 30 gün içinde tamamen silinir veya anonimleştirilir.",
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
        "İletişim kanallarımız ve ortalama yanıt süreleri: WhatsApp — hafta içi mesai saatlerinde 30 dakika, hafta sonu 12 saat içinde dönüş. E-posta (info@pimetiket.com) — 24 saat içinde detaylı yanıt. /iletisim formu — sipariş numarası ile birlikte iletildiğinde aynı gün incelenir. Telefon — hafta içi 09:00–18:00 mesai saatlerinde 0545 699 90 63 numarasından bizi arayabilirsiniz (site ayarlarından güncellenir).",
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
export const SSS_FAQS_EN: Record<SssCategory, SssFaqItem[]> = {
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
    {
      q: "How is invoicing handled?",
      summary:
        "e-Invoice is issued under SEFA YAKUT ETİKETBOX KIRTASİYE BASKI TİCARET LİMİTED ŞİRKETİ (Doğanbey V.D., VKN 7580606076).",
      detail:
        "Company invoices: enter company name and VKN at checkout. Card payment only (PayTR 3D Secure) — no bank transfer.",
    },
    {
      q: "Can I reorder a previous order?",
      summary:
        "Yes — use «Reorder» on /siparislerim or the order detail page.",
      detail:
        "Adds the same product configuration to your cart. Re-upload design files; current prices apply at checkout.",
    },
  ],
  tasarim: [
    {
      q: "What file formats do you accept?",
      summary: "PDF, PNG, JPEG, AI, PSD, SVG.",
      detail:
        "Pim Etiket accepts PDF, PNG, JPEG, AI, PSD, and SVG. PDF/X-1a or AI recommended for vector data and font outlines; PNG and JPEG raster at 300 DPI. EPS is not supported. Uploaded files go through automatic pre-check for format, resolution, and color profile.",
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
      summary:
        "Yes — unit price drops as quantity increases; see live price in the configurator.",
      detail:
        "Move the quantity slider in the configurator to see updated totals. No fixed tier percentages published — checkout shows the final amount.",
    },
    {
      q: "Multi-design discount?",
      summary:
        "Yes — tiered discount when multiple designs in one order; rate shown in configurator.",
      detail:
        "Add several designs in the same order; discount applies automatically. Upload a separate file per design.",
    },
    {
      q: "Shipping cost and free shipping threshold?",
      summary:
        "Free shipping on orders 1000 ₺ and above; below that, fee shown in cart.",
      detail:
        "Shipped via Yurtiçi Kargo (primary) and DHL — Turkey-wide. No Aras/MNG.",
    },
  ],
  uretim: [
    {
      q: "How long does production take?",
      summary:
        "Stickers: 3 business days; sheet labels: 3; roll labels: 10 (after design approval).",
      detail:
        "Weekends and public holidays excluded. Roll label orders open 29 June 2026 — sheet labels and stickers available now. Add 1-3 days shipping (Istanbul 1, other cities 2-3).",
    },
    {
      q: "Which courier do you use?",
      summary: "Yurtiçi Kargo (primary) and DHL — Turkey-wide delivery.",
      detail:
        "No Aras or MNG. Istanbul 1 business day, other cities 2-3. Tracking in your dashboard.",
    },
    {
      q: "Same-day shipping / rush print?",
      summary:
        "No rush service. Stickers 3, sheet labels 3, roll labels 10 business days.",
      detail:
        "Fixed production windows for QC and quality. Plan ahead — order early for your deadline.",
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

