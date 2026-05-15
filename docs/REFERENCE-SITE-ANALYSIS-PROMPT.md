# Referans Site Analiz Prompt'u

Bu doküman, **başka bir AI'a (Claude/GPT/Gemini/Perplexity/Manus)** verilmek
üzere hazırlanmış bir referans-site analiz prompt'udur. Sefa Pim Etiket için
ilham veya rekabet analizi yapmak istediği bir siteyi inceleterken
kullanır — sonuçtan dolaylı olarak Pim Etiket'in tasarım/içerik/UX yönü
şekillenecek.

---

## Nasıl kullanılır

1. Aşağıdaki blok'tan **"PROMPT BLOĞU"** kısmını kopyala
2. Diğer AI aracına yapıştır (Claude.ai, ChatGPT, Claude in Chrome, vb.)
3. Sonuna **analiz edilecek site URL'ini** ekle:
   - Örn: `İncelenecek site: https://stickermule.com`
4. AI istediği detaylı raporu üretir
5. Raporu bana ya da Claude Code'a getir, Pim Etiket için aksiyon listesi çıkaralım

---

## PROMPT BLOĞU — kopyala-yapıştır

```
Sen kıdemli bir ürün stratejisti + UX/UI uzmanı + marka iletişimcisisin.
Tek bir web sitesini Sefa Yakut'un sahibi olduğu "Pim Etiket"
adlı bir Türk dijital baskı e-ticaret projesi için detaylı analiz etmen
istenecek.

═══════════════════════════════════════════════════════════════════
PİM ETİKET BAĞLAMI (analizini bu lens'ten yap)
═══════════════════════════════════════════════════════════════════

• Marka: Pim Etiket — Türk pazarında küçük markalar + bağımsız üreticiler
  için AI destekli dijital baskı (etiket + sticker) atölyesi.
• Slogan: "Markanın etiketi, fikrinin sticker'ı"
• Ürün: Rulo etiket (1000 adetten başlar) + die-cut sticker
  (25 adetten başlar) — özel boyut, malzeme, kesim seçilebilir.
• Hedef kitle: 0-3 yıllık yeni markalar (gıda, kozmetik, takviye, içecek),
  e-ticaret satıcıları, etkinlik organizatörleri, freelance tasarımcılar.
• Pazarda farklılaşma:
  - AI dosya kontrol (DPI/CMYK/bleed/safe-zone otomatik check)
  - Hızlı üretim (5-7 iş günü, fason ortaklarla)
  - KVKK + TGK uyumlu (gıda etiket mevzuat denetimi opsiyonel — Packanalyz
    motoruyla entegrasyon mümkün)
• Renk paleti: Coral (#ff6b5b) + Krem (#FFF5EE) + Lacivert (#1F2A4D)
• Marka tonu: Sıcak, samimi, profesyonel — kurumsal değil, atölyeci.
• Maskot: "Pim" — yuvarlak, etiket rulosu kafalı sevimli karakter.
• Şu anki durum: Soft launch öncesi, görsel/marka kimliği iyileştirme
  fazında, henüz kayda değer trafik yok.

═══════════════════════════════════════════════════════════════════
GÖREVİN
═══════════════════════════════════════════════════════════════════

Aşağıda vereceğim URL'i sistematik olarak analiz et. Analizin TEK
amacı: "Pim Etiket bu siteden ne öğrenebilir, ne benimser, neyi
yapmaz?" sorusuna kanıt-bazlı cevap ver. Genel tasarım eleştirisi
yapma — Pim Etiket'in bağlamına geri dön.

Mümkünse browser ile siteyi gerçekten gez (Claude in Chrome / Manus
kullanıyorsan). Sadece "sayfa görünüyor" değil, scroll et, hover et,
form aç, mobile view'a geç, link tıkla. Eğer sadece WebFetch ile
çekiyorsan bunu raporun başında belirt — bazı dinamik içerik
göremeyebilirsin.

═══════════════════════════════════════════════════════════════════
ÇIKTI FORMATI — TAM AŞAĞIDAKİ YAPIDA YAZ
═══════════════════════════════════════════════════════════════════

# Referans Site Analizi: [SİTE ADI]

## 0. Özet — 30 saniyede
- **Site:** URL + kısa tanım (1 cümle)
- **Sektör:** [print/sticker/cosmetic/SaaS/...]
- **Pim Etiket'le yakınlık:** [Yüksek/Orta/Düşük] — neden
- **3 cümlede en önemli ders:** (Pim Etiket için aksiyon odaklı)

---

## 1. İlk Bakış (above-the-fold)
- **Hero görsel/video:** ne gösteriyor, hangi ton (foto/illüstrasyon/video,
  ışık, kompozisyon)
- **Ana başlık (H1):** tam metin + analiz (söz konusu vaadin netliği)
- **Alt başlık/açıklama:** ton + uzunluk + bilgi yoğunluğu
- **CTA buton:** rengi + metni + yeri + alternatif aksiyon var mı
- **İlk izlenim:** 5 saniyede ne anladım — Sefa'nın hedef müşterisi ne anlar
- **Pim Etiket için ders:** ✅ benimse / ❌ kaçın / 🔄 uyarla notları

## 2. Marka Kimliği ve Görsel Dil
### 2.1 Renk paleti
- Primary, secondary, accent renkler (HEX yaz mümkünse)
- Sıcaklık-soğukluk dengesi
- Kontrast/erişilebilirlik hissi
- Pim Etiket coral+krem paleti ile çatışma/uyum

### 2.2 Tipografi
- Font ailesi (display + body)
- Heading sistemi (boyut hiyerarşisi)
- Letter-spacing, line-height hissi
- Türkçe karakter desteği (ı, ğ, ş, ç, ö, ü)
- Web fonts mı, system fonts mı

### 2.3 Görsel stili
- Fotoğraf vs illüstrasyon vs hybrid
- Stok foto kokuyor mu, özel mi
- Ürün çekim stili (flat-lay, lifestyle, açılı, beyaz arka plan)
- Mockup kalitesi (Placeit-vari mı, photoshop ustası mı)
- Mascot/character kullanımı

### 2.4 İkonografi
- Custom mu, library mı (Lucide, Heroicons, FontAwesome?)
- Stil tutarlılığı

## 3. İçerik / Copywriting
### 3.1 Marka sesi
- Resmi mi samimi mi
- Birinci tekil mi, ikinci tekil mi (siz/sen)
- Argümentation pattern: vaat → kanıt → CTA
- Emoji kullanımı, mascot konuşması

### 3.2 Mikrokopi
- Form etiketleri
- Hata mesajları (yakalayabildiysen)
- Buton metinleri
- Empty state'leri
- Loading durumları
- 404/500 sayfa tonu (varsa eriş)

### 3.3 Headline + slogan
- En çarpıcı 3 cümle (kopyala — Sefa stil olarak öğreneceği için)
- Anahtar kelime stratejisi tahmini

## 4. Bilgi Mimarisi
### 4.1 Navigasyon
- Üst nav menü item'ları (kopyala tam liste)
- Mega menü mü, basit dropdown mı, full-screen drawer mı
- Footer kategori adetleri ve grupları
- Breadcrumb kullanımı

### 4.2 Ürün hiyerarşisi
- Kaç ana kategori
- Filtreleme/sortlama
- "Ne arıyorsun?" akış (use-case-driven vs material-driven vs şekil-driven)
- "Hızlı sipariş" / "Tasarım stüdyo" / "Şablonla başla" — kaç giriş kapısı

### 4.3 Search ve discovery
- Arama kutusu var mı, ne kadar görünür
- Otomamamla tamamlama, suggestion?
- Filtreleme UX'i

## 5. Ürün Konfigürasyon Akışı (varsa — kritik!)
### 5.1 Configurator UX
- Adımlı wizard mı, tek sayfada her şey mi
- Boyut girişi: serbest mm, preset, ya da slider
- Şekil seçimi: nasıl gösteriliyor
- Malzeme seçimi: thumbnail, açıklama, fiyat yansıması
- Kesim/finish: pop-up, tooltip
- Adet: input + hızlı preset (50, 100, 250...)
- Canlı fiyat hesabı: anlık mı, tıklama sonrası mı
- Adet artınca fiyat düşüyor görsel olarak gösterilir mi (kantar bar)
- Tasarım yükleme: drag-drop, file size limit, format

### 5.2 Live preview
- Etiket önizleme görseli (3D mockup, flat, on-product)
- Boyut ve şekil değişince anlık güncellenir mi
- Renk preview

### 5.3 Fiyat şeffaflığı
- KDV dahil mi, ayrı satır mı
- Kargo ücreti nerede gösteriliyor (sepette mi, configurator'da mı)
- Tax inclusive vs exclusive UX'i

## 6. Konvertasyon Unsurları
### 6.1 Trust signals
- Müşteri yorumları (sayı, format, gerçeklik)
- Müşteri logolar (B2B trust)
- Sertifikalar / rozetler (SSL, ödeme, KVKK)
- Garanti / iade politikası vurgusu
- Sosyal medya takipçi sayıları
- Yıl/sipariş istatistikleri (X mutlu müşteri, Y sipariş)

### 6.2 Aciliyet ve kıtlık
- "Stoklarda son X" tipi mesaj
- Promosyon countdown
- "Bu hafta indirim" banner

### 6.3 Risk azaltıcılar
- Para iade garantisi metni
- Free sample / trial
- "Önce şablon dene" CTA
- WhatsApp Live destek tab

### 6.4 Reciprocity (ücretsiz değer)
- Ücretsiz şablon paketi
- Blog / kılavuz / video
- Email ile reçete

## 7. Müşteri Hizmeti ve Destek
- FAQ var mı, kaç madde, kategoriler
- Live chat (Crisp, Intercom, Tidio, custom?)
- WhatsApp Business button
- E-posta destek SLA vaat ediyor mu
- Yardım merkezi/help center
- İletişim sayfası içeriği (form, telefon, adres, harita)

## 8. Mobile Deneyim
- Bottom navigation var mı (sticky)
- Sticky CTA / cart icon
- Hamburger drawer içeriği
- Touch target boyutları (44×44px standardı)
- Form usability mobile'da
- Image lazy load
- Page weight tahmini (büyük görseller, video autoplay?)

## 9. Performans Hissi
- Sayfa yükleme hızı (subjectif: hızlı/orta/yavaş)
- Görsel kalitesi vs ağırlığı
- Animasyon kullanımı (overdo mu, minimal mi)
- Scroll smoothness

## 10. SEO ve Teknik İpuçları
- Page title tag (kopyala)
- Meta description (kopyala — ilham için)
- H1-H6 hiyerarşisi (yapı doğru mu)
- Schema.org structured data var mı (kontrol etmeye çalış — view-source)
- Open Graph image tag (sosyal paylaşımda nasıl görünüyor)
- URL yapısı (slugify, length, lokalizasyon)

## 11. Yasal ve Compliance
- KVKK / GDPR cookie banner — opt-in mi opt-out mu
- Privacy policy linki nerede (footer mı, kayıt formunda mı)
- Türkçe yasal metinler var mı (Pim Etiket Türk sitesi — KVKK m.10 lazım)
- E-ticarette zorunlu olan "Mesafeli Satış Sözleşmesi", "Cayma Hakkı"
  metinleri görülebilir mi
- Newsletter formunda açık rıza checkbox var mı

## 12. Analytics ve Marketing Stack (tahmini)
- View page source veya browser dev tools ile bakabildiğin kadar tahmin et:
  - Google Analytics 4 (gtag.js)
  - Google Tag Manager
  - Meta Pixel (Facebook)
  - TikTok Pixel
  - PostHog, Hotjar, FullStory (heatmap/session replay)
  - Klaviyo, Mailchimp (email)
  - Intercom, Crisp (chat)
  - Trustpilot widget
- E-ticarette retargeting çekiyorlar mı

## 13. Sahibi olabilecekleri 3 Şey (Pim Etiket'in EKSİĞİ)
Bu site Pim Etiket'e göre NE'de daha iyi? Maksimum 3 maddede yaz —
gerçek farklılaşma noktaları, "rengini sevdim" tarzı yüzeysel değil.

## 14. Pim Etiket'in Sahip olabileceği 3 Şey (REFERANSIN EKSİĞİ)
Pim Etiket bu referansa göre NE'de zaten daha iyi olabilir, hangi
boşluğu doldurabilir? Coral/AI/Türkçe/küçük marka odağı gibi avantajlar.

## 15. AKSIYON LİSTESİ (Pim Etiket için — bunun için açtım analizi)
Önceliklendirilmiş, eylem-odaklı, hemen yapılabilir maddeler:

### 🔥 Hemen al — direkt benimseyebilir (P0)
1. [Çok somut, kopyala-uygula seviyesinde]
2. ...
3. ...

### 🟡 Uyarla — Pim Etiket stiline çevir (P1)
1. ...
2. ...
3. ...

### 🔵 İlham olarak akılda tut (P2)
1. ...
2. ...

### ❌ Yapmama listesi — bu siteden kaçınmamız gerekenler
1. ...
2. ...

═══════════════════════════════════════════════════════════════════
ANALİZ KURALLARI
═══════════════════════════════════════════════════════════════════

1. Spesifik ol: "Renkler güzel" yerine "#FF6B5B coral + #1A1A1A almost-
   black kontrastı, hero'da 70/30 ağırlıkta kullanılmış, eye-flow
   yukarıdan sağa CTA'ya çok yönlü."

2. Kopyala-yapıştır niyetiyle değil, ders çıkarma niyetiyle bak.
   Telif hakkı + dava riski var — fakat patternları öğrenmek serbest.

3. Subjektif değerlendirme yaparken nedenini açıkla. "Çirkin"
   demek yetmez — "1996 dot-com tonunda, 2026 Gen-Z'sini çekmez"
   gibi gerekçeli.

4. Pim Etiket'in marka tonu (sıcak, samimi, kurumsal değil) ile
   çatışan elementleri özel olarak işaretle.

5. Eğer site Türkçe değilse — Pim Etiket Türk pazarına satış yapacak —
   bunu lokalizasyon karşılaştırmasına ekle (örn: "Türkçe karakterlerle
   uyumsuz font kullanmış" şeklinde).

6. Konkret istatistik ver (mümkünse): "10 saniyede 4 CTA göründü",
   "homepage 3.2 MB yüklendi", "scroll depth 8 ekran" gibi.

7. Empati ile yaz — bu sitenin sahibini eleştirmek değil amaç,
   Pim Etiket için ders çıkarmak.

8. Raporun toplamı 1500-3000 kelime arası dengeli olsun — kısa
   yetersiz, uzun okunmuyor.

═══════════════════════════════════════════════════════════════════

İncelenecek site: [BURAYA URL YAPIŞTIR]

Hadi başla. Sistematik, kanıt-bazlı, Pim Etiket aksiyon-odaklı.
```

---

## Kullanım örnekleri

### Örnek 1: Yurt dışı rakip
```
İncelenecek site: https://stickermule.com
```

### Örnek 2: Yerel rakip
```
İncelenecek site: https://etiketsdunyasi.com
```

### Örnek 3: İlham — başka sektör (Stripe)
```
İncelenecek site: https://stripe.com/payments

Ek not: Bu site Pim Etiket'le ürün olarak farklı (ödeme altyapısı
vs etiket baskı) ama brand storytelling + landing page UX
açısından ders almak istiyorum. Aksiyon listesinde "Stripe-vari
hero hangi noktaları benimseyebilir" sorusuna özel cevap ver.
```

### Örnek 4: Mockup kalitesi açısından
```
İncelenecek site: https://moo.com

Ek not: Özellikle ürün galerisi mockup kalitesi + use case
çeşitliliği üzerine yoğunlaş. Gallery item başına ne kadar emek
verilmiş, kategori başına kaç örnek, mockup kalitesi nasıl.
```

---

## Tavsiye edilen referans siteler listesi

Hangi sektörlerden örnek alabileceğin bir kısa liste:

### Doğrudan rakipler (etiket/sticker)
- **Sticker Mule** (stickermule.com) — global lider, hız ve eğlenceli ton
- **Avery** (avery.com) — kurumsal, geniş kategori
- **MOO** (moo.com) — premium kartvizit/etiket, mockup ustası
- **Etsy print shops** — küçük üreticilerin product page tarzı
- **EtiketDünyası**, **EtiketMakinen** — Türkçe rakipler
- **Vistaprint** (vistaprint.com.tr) — Türkçe lokalize

### İlham siteleri (B2B / SaaS UX)
- **Stripe** — hero copy + landing page mastery
- **Linear** — tipografi ve renk minimal
- **Notion** — playful illustration
- **Vercel** — gradient + abi monospace
- **Apple** — product story + hero animation

### Brand storytelling
- **Aesop** — minimalist cosmetic, premium ton
- **Glossier** — community-driven beauty
- **Patagonia** — mission + product harmonisi

### E-ticarette mockup mastery
- **Allbirds** — flat-lay + lifestyle perfect dengesi
- **Hims & Hers** — pricing transparency
- **Casper** — product configurator

### Türk e-ticaret iyi örnekleri
- **Hepsiburada** — bottom nav + sticky CTA
- **Trendyol** — mobile-first sayılır
- **Markaplus**, **Foreks** — niche TR markaları
- **Coffee Manifesto** — TR specialty brand

---

## Sonra ne yapılır?

1. Analiz raporunu al
2. Bana (Claude Code) ya da başka bir AI'a getir
3. Şu komutla devam ettir:

```
İşte [Site Adı] için yapılmış detaylı analiz. Pim Etiket için
aksiyon listesindeki maddeleri implemente edelim. 🔥 P0
maddelerden başla — hangi dosya/component'i nasıl değiştirmemiz
gerek, somut kod/içerik önerisiyle çıkar.

[Rapor metnini buraya yapıştır]
```

4. Ben her P0 maddesi için:
   - Hangi sayfa/component değişir
   - Tam edit önerisi
   - Etkilenecek dosyalar
   - Test planı
   verir, sen onaylarsan implemente ederim.

---

## Bonus — Hızlı analiz reçetesi

3 sitenin hızlı karşılaştırması istiyorsan, prompt'un üst kısmına
şunu ekle:

```
ÖNEMLİ: 1 site değil, 3 site analiz et. Üçünü yan yana
karşılaştırma tablosu çıkar. Her dimension (renk, ton, CTA,
configurator UX vb) için 3 site arasında en iyi/en kötüyü işaretle.
Sonra Pim Etiket için "best-of-three" sentez ver.

Siteler:
1. [URL1]
2. [URL2]
3. [URL3]
```

---

*Bu doküman tekrar tekrar kullanılır — yeni site analizi istediğinde
yukarıdaki blokları kopyala-yapıştır.*
