# Pim Etiket — Çalışma Planı

> **Master plan:** `C:\Users\msı\Desktop\PIMETIKET-TODO list.md` v1.3 (11 May)
> **Aktif execution:** `EXECUTION-PLAN.md` (gitignored — proje root'ta)
> **4 Aşama:** Bu hafta P0 / Mali pencere açılınca / Launch ilk hafta / Launch +2-4 hafta

> **Sefa kararı (10 Mayıs 2026):** Mali işler (PayTR, Resend mail, sanal POS) **1 hafta ertelendi**. Bu hafta tek odak: **mevcut sistemdeki eksikleri tespit + iyileştirme + UX cila**.

---

## 🎯 Bu hafta — ODAK HAFTASI (10–17 Mayıs)

**Hedef:** Site canlıda, otomasyon kurulu — şimdi her köşesini gez, polish et, kullanıcıyı şaşırtacak küçük detayları temizle.

### A. Mali işler — DOKUNMA, ERTELENDİ
- ❌ PayTR başvurusu (sonraki hafta)
- ❌ Resend mail kurulumu (sonraki hafta)
- ❌ Telefon hattı (sonraki hafta)
- ❌ Yeni adres güncellemesi (sonraki hafta — Sefa elinde değil)

### B. Bu hafta yapılacaklar (10 Mayıs — bugün maraton)

> **10 Mayıs durumu:** ~80 madde + 12 commit + 4 yeni migration tamamlandı.
> Bkz: `SESSION-LOG-2026-05-10.md` (local, gitignored).

#### 1. ✅ Sistem audit + UX/UI cila (10 May)
- [x] Admin role sistemi + view-mode toggle (Migration 011)
- [x] Dashboard 1.0 → 2.0 → 3.0 → Sidebar layout (4 iterasyon)
- [x] /admin/siparisler/[id] yeni sayfa (status update + prova upload UI)
- [x] /admin/siparis-ekle manuel sipariş formu (Migration 013 ile DB'ye yazar)
- [x] Skeleton loading: siparislerim, iadelerim, tasarimlarim
- [x] Footer newsletter "YAKINDA" rozeti + telefon yakında
- [x] Galeri "KONSEPT" disclaimer (TKHK riski sıfır)
- [x] Hero görsel + 3 floating ürün önizleme
- [x] Trust strip 4 sütun (3D Secure / kargo / AI / KVKK)
- [x] Hakkımızda persona temizliği (3 alt → 3 yetenek)
- [x] Mobile responsive audit (büyük sorun yok)
- [ ] **Dark mode** — şu an sadece light, gerek var mı? (ertelendi)
- [ ] 404 / 500 sayfaları custom mu? (kontrol bekliyor)

#### 2. ✅ AI Pim chat geliştirme (10 May)
- [x] Persona dropdown UI'dan KALDIRILDI (Sefa kararı: tek akıllı sistem)
- [x] KNOWLEDGE_BASE temizlik: cüzdan +%2 kaldırıldı, teslim 8-12/5-7
- [x] Welcome Pim 5 use case sistem prompt'u
- [x] "Tasarımcı Pim/Kargocu Pim bahsetme" kuralı
- [x] Hazır cevap chip ÖNERME kuralı
- [x] Memory snapshot zaten çalışıyor (localStorage + KVKK consent)
- [ ] Persona test — gerçek müşteri sorularıyla (sen test edeceksin)

#### 3. ✅ Performans + SEO (10 May)
- [x] Schema.org JSON-LD: SchemaJsonLd kit + 5 helper (FAQ/Product/Breadcrumb/Article/LocalBusiness)
- [x] /sss FAQ schema, /etiket + /sticker Product+Breadcrumb
- [x] Sitemap audit: /yorumlar + /on-bilgilendirme eklendi
- [x] Open Graph + Twitter card: /etiket + /sticker zenginleştirildi
- [x] next/image audit: hiç raw `<img>` yok ✓
- [ ] **Lighthouse skoru ölç** — Chrome DevTools (sen yapacaksın)
- [ ] Search Console'a kayıt + sitemap submit (sen yapacaksın)

#### 4. ✅ Yorum sistemi DB integration (10 May)
- [x] Anasayfa fake yorumlar KALDIRILDI (Defne/Ezgi/Burak silindi)
- [x] /sticker sayfasına ProductReviews mount
- [x] /admin/yorumlar Supabase reviews tablosuna bağlandı
- [x] Yeni endpoint: GET /api/admin/reviews, PATCH /api/admin/reviews/[id]

#### 5. ✅ Operasyonel pipeline (10 May)
- [x] Manuel sipariş gerçek DB (Migration 013 + fn_create_manual_order RPC)
- [x] Operatör prova upload UI (Migration 014 + designs/proofs/ path)
- [x] Müşteri prova onay/reddet endpoint (/api/orders/[id]/proof-respond)
- [x] Admin status update + audit log (/api/admin/orders/[id]/status)
- [x] Auto-confirm endpoint (Resend gelene kadar geçici)

#### 6. ✅ Güvenlik audit (10 May)
- [x] 18 tablo RLS aktif + ≥1 policy
- [x] CSP production'da aktif
- [x] HSTS + X-Frame + Permissions-Policy comprehensive
- [x] Service role key Vercel env'de
- [ ] **Admin şifre değiştir** (`adminadmin` çok zayıf — sen yapacaksın)

#### 7. ⚠️ Backup + disaster recovery (ertelendi)
- [ ] Supabase Pro upgrade düşün → Point-in-Time Recovery (free tier'da yok)
- [ ] DB schema dump'ı al (bundled-schema.sql zaten var)
- [x] Vercel deploy history kalıcı, rollback edilebilir → OK
- [ ] GoDaddy DNS yedek (ekran görüntüsü — sen yapacaksın)

#### 8. ⚠️ Yasal sayfalar son kontrol (ertelendi)
- [x] CookieConsent + 4 kategori (zaten vardı)
- [x] /iletisim telefonsuz, 3 kanal (Pim/E-posta/Atölye)
- [ ] Avukat onayı — yasal metinler (Sefa avukatı)
- [ ] VERBİS muafiyet sorgusu (Sefa)

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

### 5. Resend mail
- Resend hesabı (yoksa)
- Domain doğrulama (DKIM/SPF/DMARC) — GoDaddy DNS API ile ben yazarım
- API key Vercel env'e
- Test mail at, info@'a ulaştığını doğrula
- Sonra **Yorum mail otomasyonu** aktifleşir (Madde 7'deki Aşama 2)

### 6. MERSİS
- Sorgula + footer'a ekle

### 7. Yorum sistemi — Aşama 2 (Resend gelince)
- pg_cron job veya Supabase Edge Function: kargo teslim sonrası 24 saat
  bekle, sonra Resend ile yorum talebi maili at
- Mail template: Pim wave + brand voice + 1-tıkla "Yorum yaz" butonu
- Token-based yorum sayfası (login olmadan, mail linkinden gelirse)
- Email open/click tracking (Resend dashboard)
- 30 gün dolan `review_requests` için cron: status='expired'

### 8. ✅ Yorum sistemi — Sticker entegrasyonu (10 May)
- `/sticker` sayfasının sonuna `<ProductReviews productType="sticker" />`
  mount edildi

### 9. ✅ Yorum sistemi — DB integration (10 May)
- `/admin/yorumlar` Supabase reviews tablosuna bağlandı
- Yeni endpoint: `GET /api/admin/reviews`, `PATCH /api/admin/reviews/[id]`
- Status mapping: pending/published/rejected/hidden (4 enum)
- Real-time hala yok (Faz 4)

### 10. ✅ Anasayfa fallback yorumları kaldırıldı (10 May)
- HomeReviews.tsx'ten FALLBACK_REVIEWS dizisi silindi
- /yorumlar fallback'leri silindi
- TKHK m.61 yanıltıcı reklam riski SIFIR
- DB boş ise "İlk yorumu sen yaz" empty state

---

## 🔮 Daha sonra (mali hafta sonrası)

- Sentry hata takibi
- PostHog/GA4 analytics
- Avukat onayı (yasal metinler)
- WhatsApp Business
- Cloudflare Pages migration (opsiyonel)
- Üretim partneri netleştirme (atölye adresi)
- **Yorum hediye sistemi** — yorum yazana cüzdana 50 TL puan kredisi
  (cüzdan aktif olunca)
- **Yorum analytics** — admin panelinde KPI dashboard:
  - Teslim → yorum oranı (hedef %30+)
  - Mail open/click rate
  - Banner CTR
  - Average rating trend
- **Yorum filtreleri** — `/yorumlar` sayfasında yıldız bazlı filtre, foto
  varlığı filtresi
- **Yorumlara cevap** — admin yoruma cevap yazabilir (özellikle 1-2 yıldız
  için empati + çözüm)

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
