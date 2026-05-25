/**
 * Hardcoded blog içeriğini blog_posts tablosuna seed eder.
 * Migration 099 sonrası bir kez çalıştır: node scripts/seed-blog-posts.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  for (const name of [".env.local", ".env.agent"]) {
    try {
      const raw = readFileSync(resolve(__dirname, "..", name), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m && !process.env[m[1].trim()]) {
          process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      /* skip */
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const POSTS = [
  {
    slug: "kucuk-marka-icin-etiket-secimi",
    title_tr: "Küçük marka için etiket seçimi: kraft mı, beyaz mı, ultra mı?",
    excerpt_tr:
      "Marka kimliğin etiketin malzemesinden başlar. Hangi malzeme hangi ürüne yakışır, raf etkisi nasıl yaratılır?",
    category: "rehber",
    read_minutes: 5,
    published_at: "2026-05-08T12:00:00+03:00",
    body_tr: `Etiket kağıdı, ürünün ilk dokunuşudur. Müşteri rafa baktığında veya kutuyu aldığında parmak ucuyla hissettiği şey marka algısını şekillendirir. Doğru malzemeyi seçmek pazarlama bütçenden daha çok iş görür.

**Kraft kağıt** — doğal, dokulu, sıcak. Sabun, doğal kozmetik, organik gıda gibi "naturel" pozisyonlanan markalar için ideal. Düşük parlaklık görsel olarak gözü yormaz, tipografi ön plana çıkar. Soft touch kaplama eklersen lüks hissi de gelir.

**Beyaz semi-glos** — klasik, çok yönlü. Kozmetik, gıda, içecek hemen hemen her sektörün varsayılanı. Renkler canlı çıkar, baskı netliği yüksek. Mat selefon eklersen yansımayı keser, parlak selefon eklersen rafta gözü tutar.

**Ultra clear** — şeffaf cam etkisi. Şişeler, parfümler, lüks içeçekler için. Etiketin kendisi görünmez, sadece basılan içerik dururmuş gibi durur. Beyaz mürekkep alt katman gerektirir, dolayısıyla biraz daha pahalı.

**Metalik** — folyo gümüş, premium dokunuş. Şarap, viski, lüks parfüm. Pahalıdır ama küçük adetlerde bile rafta gözle görülür bir fark yaratır.

Hangi malzemenin sana uygun olduğunu bilmiyorsan Pim'e bir 60 saniyelik soru-cevap yap. Konfigüratörde her birinin canlı önizlemesi var.`,
  },
  {
    slug: "sticker-mule-vs-pim-etiket",
    title_tr: "Sticker baskı: Sticker Mule mu Pim Etiket mi?",
    excerpt_tr:
      "Türkiye'de küçük adette sticker bastırmanın en pratik yolu. Maliyetler, teslim süreleri, kalite kıyaslaması.",
    category: "karsilastirma",
    read_minutes: 4,
    published_at: "2026-05-05T12:00:00+03:00",
    body_tr: `Sticker Mule Amerika'nın küresel sticker baskı devlerinden biri. Türkiye'den de sipariş verilebiliyor ama gümrük, kargo ve para birimi karışıklığı işi karmaşıklaştırıyor.

**Maliyet karşılaştırması (50 adet, 75×75mm vinil):**
- Sticker Mule: ~$15 (yaklaşık 500 ₺) + ~$25 kargo + gümrük → toplam 1.000-1.200 ₺
- Pim Etiket: ~800 ₺, kargo 49 ₺ (1500 ₺ üzeri ücretsiz), gümrük yok

**Teslim süresi:**
- Sticker Mule: 7-12 gün (üretim + uluslararası kargo + gümrük)
- Pim Etiket: 5 iş günü içinde kargoda, Türkiye geneli

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
    title_tr: "AI ile etiket dosyanın ön kontrolü: ne kontrol ediyoruz?",
    excerpt_tr:
      "Pim'in DPI / CMYK / yazım denetimi nasıl çalışıyor? Hangi hataları yakalıyor, hangilerini operatöre bırakıyor?",
    category: "teknoloji",
    read_minutes: 6,
    published_at: "2026-05-01T12:00:00+03:00",
    body_tr: `Bir etiket dosyası matbaaya geldiğinde 3 büyük problem yakalanmazsa baskıda fark ediliyor — geç ve pahalı:

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
    title_tr: "Fason üretim mi kendi atölye mi: Pim Etiket'in tercihi",
    excerpt_tr:
      "Neden tek atölye yerine fason ortaklarla çalışıyoruz? Avantajları, riskleri, kalite kontrolü.",
    category: "hakkimizda",
    read_minutes: 4,
    published_at: "2026-04-28T12:00:00+03:00",
    body_tr: `Pim Etiket bir tabela atölyesi değil, bir akıllı baskı pazarı. Kendi atölyemiz yok ama anlaşmalı fason ortaklarımızla çalışıyoruz — İstanbul ve Ankara merkezli dijital baskı atölyeleri.

**Neden bu model?**
- Kapasite esnek: ay başında 5K etiket, ay sonunda 20K — fason rotation ile sığdırıyoruz
- Sermaye az: makineye yatırım yapmak yerine fason ortağa iş veriyoruz
- Coğrafi avantaj: müşteri konumuna göre en yakın atölyeye yönlendiriyoruz, kargo süresi düşüyor
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

let ok = 0;
for (const p of POSTS) {
  const { error } = await admin.from("blog_posts").upsert(
    {
      slug: p.slug,
      title_tr: p.title_tr,
      body_tr: p.body_tr,
      excerpt_tr: p.excerpt_tr,
      category: p.category,
      status: "published",
      read_minutes: p.read_minutes,
      published_at: p.published_at,
      author_name: "Pim Etiket",
    },
    { onConflict: "slug" }
  );
  if (error) {
    console.error(`FAIL ${p.slug}:`, error.message);
  } else {
    ok += 1;
    console.log(`OK ${p.slug}`);
  }
}

console.log(`\n${ok}/${POSTS.length} yazı seed edildi.`);
