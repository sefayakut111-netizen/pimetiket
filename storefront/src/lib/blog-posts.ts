/**
 * Blog yazıları — şu an hardcoded (SEO + içerik pazarlaması).
 * Backend swap'te `blog_posts` tablosu + admin /admin/blog sayfası gelecek.
 */

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  publishedAt: string; // ISO
  readMinutes: number;
  coverColor: string; // tailwind bg class
  /** Markdown gibi düz metin — render için basit paragraflar */
  body: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "kucuk-marka-icin-etiket-secimi",
    title: "Küçük marka için etiket seçimi: kraft mı, beyaz mı, ultra mı?",
    excerpt:
      "Marka kimliğin etiketin malzemesinden başlar. Hangi malzeme hangi ürüne yakışır, raf etkisi nasıl yaratılır?",
    category: "Rehber",
    author: "Pim Etiket",
    publishedAt: "2026-05-08",
    readMinutes: 5,
    coverColor: "bg-krem",
    body: `Etiket kağıdı, ürünün ilk dokunuşudur. Müşteri rafa baktığında veya kutuyu aldığında parmak ucuyla hissettiği şey marka algısını şekillendirir. Doğru malzemeyi seçmek pazarlama bütçenden daha çok iş görür.

**Kraft kağıt** — doğal, dokulu, sıcak. Sabun, doğal kozmetik, organik gıda gibi "naturel" pozisyonlanan markalar için ideal. Düşük parlaklık görsel olarak gözü yormaz, tipografi ön plana çıkar. Soft touch kaplama eklersen lüks hissi de gelir.

**Beyaz semi-glos** — klasik, çok yönlü. Kozmetik, gıda, içecek hemen hemen her sektörün varsayılanı. Renkler canlı çıkar, baskı netliği yüksek. Mat selefon eklersen yansımayı keser, parlak selefon eklersen rafta gözü tutar.

**Ultra clear** — şeffaf cam etkisi. Şişeler, parfümler, lüks içeçekler için. Etiketin kendisi görünmez, sadece basılan içerik dururmuş gibi durur. Beyaz mürekkep alt katman gerektirir, dolayısıyla biraz daha pahalı.

**Metalik** — folyo gümüş, premium dokunuş. Şarap, viski, lüks parfüm. Pahalıdır ama küçük adetlerde bile inanılmaz raf etkisi yaratır.

Hangi malzemenin sana uygun olduğunu bilmiyorsan Pim'e bir 60 saniyelik soru-cevap yap. Konfigüratörde her birinin canlı önizlemesi var.`,
  },
  {
    slug: "sticker-mule-vs-pim-etiket",
    title: "Sticker baskı: Sticker Mule mu Pim Etiket mi?",
    excerpt:
      "Türkiye'de küçük adette sticker bastırmanın en pratik yolu. Maliyetler, teslim süreleri, kalite kıyaslaması.",
    category: "Karşılaştırma",
    author: "Pim Etiket",
    publishedAt: "2026-05-05",
    readMinutes: 4,
    coverColor: "bg-pim-mercan-tint",
    body: `Sticker Mule Amerika'nın küresel sticker baskı devlerinden biri. Türkiye'den de sipariş verilebiliyor ama gümrük, kargo ve para birimi karışıklığı işi karmaşıklaştırıyor.

**Maliyet karşılaştırması (50 adet, 75×75mm vinil):**
- Sticker Mule: ~$15 (yaklaşık 500 TL) + ~$25 kargo + gümrük → toplam 1.000-1.200 TL
- Pim Etiket: ~800 TL, kargo 49 TL (1500 TL üzeri ücretsiz), gümrük yok

**Teslim süresi:**
- Sticker Mule: 7-12 gün (üretim + uluslararası kargo + gümrük)
- Pim Etiket: 5-7 gün, Bursa'dan kapına

**Kalite:**
- İkisi de dijital UV baskı, kraft dosyalardan kontur kesim. Vinil + holografik + glitter birebir aynı malzeme grubu.
- Pim Etiket'in farkı: AI ön kontrol — DPI/CMYK/yazım hatalarını sipariş öncesi yakalıyor.

**Müşteri desteği:**
- Sticker Mule: İngilizce, e-posta tabanlı.
- Pim Etiket: Türkçe, WhatsApp + sayfa içi Pim chat (anlık).

**Sonuç:** 100 adetin altında uluslararası baskı genelde lojistik sebebiyle pahalıya geliyor. Türkiye atölyesi her zaman daha hızlı + ucuz, kalite eşit.`,
  },
  {
    slug: "etiket-baskisinin-on-kontrolu",
    title: "AI ile etiket dosyanın ön kontrolü: ne kontrol ediyoruz?",
    excerpt:
      "Pim'in DPI / CMYK / yazım denetimi nasıl çalışıyor? Hangi hataları yakalıyor, hangilerini operatöre bırakıyor?",
    category: "Teknoloji",
    author: "Sefa Yakut",
    publishedAt: "2026-05-01",
    readMinutes: 6,
    coverColor: "bg-yesil-soft",
    body: `Bir etiket dosyası matbaaya geldiğinde 3 büyük problem yakalanmazsa baskıda fark ediliyor — geç ve pahalı:

**1. Düşük DPI** (300'ün altı)
İnternette indirdiğin logo 72 dpi olabilir, ekrandan iyi görünür ama 60×80 mm etiket basıldığında piksel piksel olur. Pim AI yüklediğin dosyanın efektif DPI'sını hesaplar — 300+ değilse uyarır.

**2. RGB renk uzayı**
Photoshop varsayılan RGB. Matbaa CMYK basar. RGB → CMYK dönüşümünde özellikle parlak yeşil/mavi tonları soluyor. Pim renk uzayını okur ve "RGB tespit edildi, CMYK önerilir" diye flag eder.

**3. Yazım hatası / tipografi**
Etiket basıldıktan sonra "kahveçi" yerine "kahveci" yazılması gerektiğini fark etmek 1000 etiketi çöpe atmak demek. Pim'in dil modeli marka adı + ürün metni + içindekiler kontrolü yapıyor.

**Pim'in YAPMADIĞI:**
- Mevzuat denetimi (besin değeri, alerjen, üretici bilgisi vb) — ayrı bir uzmanlık alanı, etiket içerik mevzuatı için bağımsız hizmetler kullanılmalı
- Tasarım önerisi — biz baskı yaparız, tasarım danışmanlığı yapmayız
- Renk düzeltme — flag ederiz, sen düzeltirsin

**Şu an doğruluk oranı:**
- DPI tespiti: ~%99
- Renk uzayı: %100 (metadata okuma)
- Yazım: ~%85 (sürekli iyileştiriyoruz)

Soru olursa Pim chat'ten yaz.`,
  },
  {
    slug: "fason-uretim-vs-kendi-uretim",
    title: "Fason üretim mi kendi atölye mi: Pim Etiket'in tercihi",
    excerpt:
      "Neden tek atölye yerine fason ortaklarla çalışıyoruz? Avantajları, riskleri, kalite kontrolü.",
    category: "Hakkımızda",
    author: "Sefa Yakut",
    publishedAt: "2026-04-28",
    readMinutes: 4,
    coverColor: "bg-krem-soft",
    body: `Pim Etiket bir tabela atölyesi değil, bir akıllı baskı pazarı. Kendi atölyemiz yok ama 4 fason ortağımızla çalışıyoruz: Bursa-1, Bursa-2, İstanbul-1, İzmir-1.

**Neden bu model?**
- Kapasite esnek: ay başında 5K etiket, ay sonunda 20K — fason rotation ile sığdırıyoruz
- Sermaye az: makineye yatırım yapmak yerine fason ortağa iş veriyoruz
- Coğrafi avantaj: İstanbul müşterisini İstanbul atölyesine, Ege müşterisini İzmir'e gönderiyoruz, kargo süresi düşüyor
- Risk düşük: bir atölyede arıza olsa diğerine yönlendiriyoruz

**Kalite kontrolü nasıl?**
- Her atölyede aynı baskı standardı (CMYK, UV, ISO renk profili)
- Operatör panelinde her sipariş için hangi atölyenin bastığı kayıtlı (audit log)
- Müşteri yorum sistemi sayesinde hangi atölyenin işi başarılı kaydı tutuluyor (rating)
- Düşük puanlı atölyeye yeni iş atanmıyor

**Müşteri için anlamı:**
- Tek bir atölyenin tatil/arıza dönemine bağlı kalmıyorsun
- Aynı kalite, daha hızlı teslim
- Şikayet olduğunda hangi atölye olduğu belli, müşteri hakkı korunuyor

Bu model, küçük markalar için makinelerin sahibi olmak yerine zekânın sahibi olmaya odaklanır.`,
  },
];

export function getBlogPost(slug: string): BlogPost | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}
