# Sefa — Bekleyen İşler

Bu dosya Sefa'nın elinde tamamlanmayı bekleyen işlerin listesidir. Tarih sırasıyla.

---

## ⏰ Bu hafta (10–17 Mayıs 2026)

### 1. Telefon numarası
- **Durum**: Henüz alınmadı, hafta içinde aktive edilecek
- **Yapılacaklar**:
  - [ ] Numara satın al (sabit veya GSM)
  - [ ] Bana numarayı yaz, şu yerlere ekleyeceğim:
    - `/iletisim` sayfası (şu an "Pim Sohbet + Email" var, bir de Telefon kartı eklenecek)
    - `/mesafeli-satis` sayfası (taraflar bölümü)
    - `/kvkk` sayfası (veri sorumlusu iletişim)
    - `/on-bilgilendirme` sayfası (satıcı bilgileri)
    - Footer yasal kişi bilgisi
  - [ ] WhatsApp Business hesabı kurulması (telefon aktive olunca)

### 2. Şirket adresi (yakın zamanda değişecek)
- **Durum**: Mevcut adres (Yaşamkent Mah. 3250 Cad. No: 6 A/B Çankaya/Ankara) değişecek
- **Yapılacaklar**:
  - [ ] Yeni iş yeri adresi netleşince bana yaz
  - [ ] Yasal sayfalarda adres "yakında güncellenecek" notu var; gerçek adresle değişmeli:
    - `/mesafeli-satis` — SATICI tebligat adresi
    - `/kvkk` — Veri Sorumlusu adresi
    - `/on-bilgilendirme` — Satıcı adresi
    - Footer bottom strip
  - [ ] Adres değişiminden sonra **vergi dairesi de değişebilir** — yeni vergi levhasını paylaş
  - [ ] PayTR mağaza panelinde de güncelle (müşteri ekran görür)

### 3. PayTR başvurusu
- **Durum**: Site PayTR site denetimine hazır (10 Mayıs 2026)
- **Yapılacaklar**:
  - [ ] 4 evrak topla:
    - [ ] Vergi levhası (✅ elinde mevcut: 2025_SEFA_Vergi_Levhası_05_05_2025_17_31_32.pdf)
    - [ ] Şirket yetkilisi kimlik fotokopisi
    - [ ] İmza sirküleri (Limited şirket için noterden)
    - [ ] Banka hesap teyit belgesi (firma adına IBAN, online şubeden indir)
  - [ ] https://www.paytr.com/uye-isyeri-olun → ön başvuru formu doldur
    - Yetkili: Sefa Yakut
    - E-posta: info@pimetiket.com
    - Şirket: SEFA YAKUT ETİKETBOX KIRTASİYE BASKI TİCARET LİMİTED ŞİRKETİ
    - Ana faaliyet: 464903 - Kırtasiye Ürünleri Toptan Ticareti
  - [ ] PayTR onay mailinden evrakları yükle
  - [ ] 1-3 iş günü içinde onay
  - [ ] Onay sonrası bana 3 key ver:
    - PAYTR_MERCHANT_ID
    - PAYTR_MERCHANT_KEY
    - PAYTR_MERCHANT_SALT
  - [ ] PayTR mağaza panelinde **Bildirim URL** kaydet:
    - `https://pimetiket.com/api/payment/callback`

---

## 📅 Önümüzdeki hafta (17–24 Mayıs)

### 4. MERSİS Numarası
- **Durum**: Limited şirketin için MERSİS varsa eklenmeli
- **Yapılacaklar**:
  - [ ] https://mersis.gtb.gov.tr → şirket adıyla sorgula
  - [ ] Numarayı bana yaz, footer + yasal sayfalara ekleyeceğim

### 5. Resend Domain Setup (mail gönderimi)
- **Durum**: Site şu an mail göndermiyor. Sipariş onayı / iade güncellemeleri için gerekli.
- **Yapılacaklar**:
  - [ ] https://resend.com → hesap aç (yoksa)
  - [ ] Domain: `pimetiket.com` ekle
  - [ ] Resend'in verdiği DKIM/SPF/DMARC TXT kayıtlarını GoDaddy'ye yaz (ben API ile yapabilirim)
  - [ ] API key üret → bana ver, Vercel env'e eklerim
  - [ ] Test mail at, info@ adresine ulaştığını doğrula

### 6. Atölye / üretim partneri netleştirme
- **Durum**: Şu an "Bursa & İstanbul fason atölyeler" diye yazılı
- **Yapılacaklar**:
  - [ ] Hangi şehir(ler)deki fason atölyelerle çalışılacağı netleşince güncelle
  - [ ] Müşteri ziyareti kabul ediliyorsa adres + saatler

---

## 🔮 Daha sonra (geleceğe atılan)

### 7. WhatsApp Business
- Telefon hattı aktive olunca WA Business kurulacak
- `/iletisim` sayfasına ek kart, footer'a ikon
- PayTR site denetiminde olumlu

### 8. Hukuki metin avukat onayı
- KVKK, Gizlilik, Mesafeli Satış, Şartlar — şu an taslak
- Avukat 2-3 saatte gözden geçirir, son rötuşları yapar
- Yapıldığında "son güncelleme: ..." tarihi yenilenir

### 9. Sentry hata takibi
- SENTRY_DSN env eklenince aktif olur
- Production crash'leri otomatik raporlanır
- Free tier yeterli (5K event/ay)

### 10. PostHog analytics
- NEXT_PUBLIC_POSTHOG_KEY env
- KVKK çerez izni gated (zaten kurulu)

### 11. Cloudflare Pages migration (opsiyonel)
- Vercel free tier yetersiz olursa
- Packanalyz ile aynı stack
- Sefa kararı

---

## ✅ Tamamlanmış (10 Mayıs 2026 itibariyle)

- ✅ pimetiket.com canlı (Vercel + GoDaddy DNS)
- ✅ Supabase DB + Auth + 3 Storage bucket
- ✅ AI sohbet (GPT-4o + GPT-4o-mini, persona routing)
- ✅ KVKK + Mesafeli + Ön Bilgilendirme + Çerez sayfaları
- ✅ Footer ödeme rozetleri (Visa/MC/Troy/AmEx + 3DS + SSL + KVKK)
- ✅ GitHub auto-deploy (push → 40sn deploy)
- ✅ Google Workspace mail (info@pimetiket.com)
- ✅ Site denetimi için tüm placeholder içerikler dolduruldu
