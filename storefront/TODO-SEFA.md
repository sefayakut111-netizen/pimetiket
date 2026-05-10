# Pim Etiket — Çalışma Planı

> **Sefa kararı (10 Mayıs 2026):** Mali işler (PayTR, Resend mail, sanal POS) **1 hafta ertelendi**. Bu hafta tek odak: **mevcut sistemdeki eksikleri tespit + iyileştirme + UX cila**.

---

## 🎯 Bu hafta — ODAK HAFTASI (10–17 Mayıs)

**Hedef:** Site canlıda, otomasyon kurulu — şimdi her köşesini gez, polish et, kullanıcıyı şaşırtacak küçük detayları temizle.

### A. Mali işler — DOKUNMA, ERTELENDİ
- ❌ PayTR başvurusu (sonraki hafta)
- ❌ Resend mail kurulumu (sonraki hafta)
- ❌ Telefon hattı (sonraki hafta)
- ❌ Yeni adres güncellemesi (sonraki hafta — Sefa elinde değil)

### B. Bu hafta yapılacaklar (önem sırası)

#### 1. Sistem audit — sayfa sayfa gez (1-2 saat)
- [ ] Anasayfa açılışı → bot tıklamaları, UX akışı
- [ ] /etiket konfigüratörü → tüm seçenekler çalışıyor mu, fiyat doğru mu
- [ ] /sticker → aynı (Sefa içerik düzeltmesi yapacak)
- [ ] /sepet → guest mode + login mode farkı
- [ ] /panelim → veriler doğru mu (mock vs gerçek)
- [ ] /siparislerim → liste ve detay
- [ ] /admin → her sekme tıklanabilir mi
- [ ] Mobile responsive kontrol (tüm sayfalar)
- [ ] **Dark mode** — şu an sadece light, gerek var mı?
- [ ] 404 / 500 sayfaları custom mu?
- [ ] Loading state'leri var mı her yerde?

#### 2. UX/UI cila (4-6 saat ben + Sefa)
- [ ] Topbar'da arama ikonu var ama search yok — ya çalıştır ya kaldır
- [ ] Footer'da newsletter "mock" — Sefa Resend gelince aktive
- [ ] Galeri sayfası 7 mockup — daha gerçek görseller eklenebilir mi?
- [ ] Blog 5 makale var — yeni makaleler için CMS?
- [ ] Pim chat widget'ın mobile davranışı (pozisyon, boyut)
- [ ] Çerez bannerı animasyonu, gözardı edilmiyor mu?

#### 3. AI Pim chat geliştirme (2-3 saat)
- [ ] Mevcut welcome/designer/shipper test et — gerçek müşteri sorularıyla
- [ ] Eksik persona var mı? (örn: "iadeci Pim", "yardımcı Pim")
- [ ] Designer tool calling sticker boyutunda kıvrak mı?
- [ ] Memory snapshot — kullanıcı adı kayıtlı mı, sohbetten sohbete kalıyor mu
- [ ] Pim'in cevapları bazen uzun — daha kısa system prompt ekle?

#### 4. Performans + SEO (1-2 saat)
- [ ] Lighthouse skoru ölç (mobile + desktop)
- [ ] Images Vercel optimization aktif mi? (next/image kullanılıyor mu her yerde)
- [ ] Sitemap.xml gerçekten doğru tüm sayfaları içeriyor mu
- [ ] Open Graph + Twitter card meta tag kontrolü (link paylaşımı önizleme)
- [ ] Türkçe SEO için Schema.org markup (Product, Organization, BreadcrumbList)
- [ ] Search Console'a kayıt + sitemap submit (yapılmadıysa)

#### 5. Yasal sayfalar son kontrol (1 saat)
- [ ] /kvkk → Limited şirket bilgileri doğru
- [ ] /mesafeli-satis → adres "yakında" notu görünüyor
- [ ] /on-bilgilendirme → temiz
- [ ] /cerez bannerı KVKK 4-kategori gösteriyor mu
- [ ] /iletisim → telefon olmadığı için Pim Sohbet + Mail vurgu doğru
- [ ] Footer altında ödeme rozetleri görünüyor mu

#### 6. Database hijyen (1 saat)
- [ ] Supabase Studio aç → 16 tablo doğru mu
- [ ] RLS policy'ler aktif mi, "Try" et
- [ ] Storage bucket'lar gerçekten kullanılıyor mu (henüz boş)
- [ ] Auth signup test et (gerçek e-posta ile)
- [ ] Magic link mail geldiğinde Spam'a düşüyor mu? (Resend olmadığı için Supabase default)

#### 7. Güvenlik kontrol (30 dk)
- [ ] CSP header'lar production'da aktif mi
- [ ] HTTPS strict (HSTS) çalışıyor mu
- [ ] Sensitive secret'lar GitHub'a sızdırılmamış mı (`.env*` gitignore'da)
- [ ] Vercel env'lerde tüm değerler ayarlı

#### 8. Backup + disaster recovery (1 saat)
- [ ] Supabase Pro upgrade düşün → Point-in-Time Recovery (free tier'da yok)
- [ ] DB schema dump'ı al (bundled-schema.sql zaten var)
- [ ] Vercel deploy history kalıcı, rollback edilebilir → OK
- [ ] GoDaddy DNS yedek (ekran görüntüsü)

#### 9. Gözden kaçan iyileştirmeler
- [ ] WhatsApp Business yokken "Pim Sohbet" CTA'sı gerçekten kullanılıyor mu? Trafik takibi
- [ ] Müşteri "İletişim" sayfasına gidip telefonsuz görünce ne hissediyor?
- [ ] Tasarımcı Pim fiyat verince "/etiket'e git" linki tıklanabilir
- [ ] Sticker hediye adet sistemi çalışıyor (ama Sefa sticker'a dokunmamamı söyledi, sadece test)
- [ ] Cüzdan bakiyesi mock mu gerçek mi
- [ ] Hediye kontör sayacı görünüyor mu yeni kullanıcıda

---

## 📅 Sonraki hafta (17–24 Mayıs) — Mali Hafta

Bu kısım odak haftası bittikten sonra. Şimdi TANIMLAMAK için yazıyorum, çalışma için DEĞİL.

### 1. Telefon
- Numara satın al + bana yaz, 5 yere ekleyeceğim

### 2. Yeni iş yeri adresi
- Netleşince yasal sayfalarda + Footer'da güncelle

### 3. Şirket ünvan değişikliği (varsa)
- Yeni resmi ünvan netleşince bana yaz, yasal sayfaları + footer + README'yi
  yeni ünvan ile değiştireyim
- Yeni vergi levhası al, paylaş

### 4. PayTR sanal POS
- 4 evrak (vergi levhası ✓ — yeni ünvan değişince güncellenecek,
  kimlik, imza sirküleri, banka belgesi)
- Ticaret Sicil Gazetesi (LTD ŞTİ için)
- paytr.com/uye-isyeri-olun
- 3 key Vercel env'e
- Site canlı ödeme alır

### 4. Resend mail
- Resend hesabı (yoksa)
- Domain doğrulama (DKIM/SPF)
- Sipariş onay maili çalışır

### 5. MERSİS
- Sorgula + footer'a ekle

---

## 🔮 Daha sonra (mali hafta sonrası)

- Sentry hata takibi
- PostHog/GA4 analytics
- Avukat onayı (yasal metinler)
- WhatsApp Business
- Cloudflare Pages migration (opsiyonel)
- Üretim partneri netleştirme (atölye adresi)

---

## ✅ 10 Mayıs itibariyle tamamlanmış altyapı

- ✅ pimetiket.com canlı (Vercel + GoDaddy DNS)
- ✅ Supabase DB + Auth + 3 Storage bucket
- ✅ AI sohbet (GPT-4o + GPT-4o-mini, persona routing)
- ✅ KVKK + Mesafeli + Ön Bilgilendirme + Çerez sayfaları (LTD ŞTİ bilgileri)
- ✅ Footer ödeme rozetleri (Visa/MC/Troy/AmEx + 3DS + SSL + KVKK)
- ✅ GitHub auto-deploy (push → 40sn deploy)
- ✅ Google Workspace mail (info@pimetiket.com)
- ✅ Tüm yasal sayfalar Limited Şirket bilgileri ile dolu
- ✅ Mevcut adres "yakında güncellenecek" notu PayTR site denetimi için yeterli

---

## 📌 Bu hafta için kişisel hatırlatma

> Mali işler bir hafta gözden uzak. Sanal POS başvurusuna **bakma bile**. Onun yerine her sayfada gez, mantıksız bir şey gör → bana yaz, çözeyim. Her gün 1-2 saat odaklı sayfada gezme + ben düzeltirim, hafta sonu sistem 2 katı keskin olur.
