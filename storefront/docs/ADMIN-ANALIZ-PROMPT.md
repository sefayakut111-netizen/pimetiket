# Pim Etiket Admin Panel — Bağımsız Analiz Talebi

> Bu prompt'u başka bir AI'ya (ChatGPT, Gemini, Grok vb.) ver.
> Self-contained — kod erişimine gerek yok, tüm bağlam içeride.
> Beklenen çıktı: 3 kategoride detaylı analiz + öncelikli aksiyon listesi.

---

## 🎯 GÖREVİN

Pim Etiket adında **B2B etiket/sticker e-ticaret** sisteminin admin panelini analiz et. Sahibi (Sefa) **solo kurucu** — yani admin panel **bir kişinin** her gün kullanacağı, az çalışanlı (1-3 operatör) bir şirketin operasyon merkezi olmalı.

3 başlıkta detaylı rapor ver:

1. **🟢 İŞE YARAYAN KISIMLAR** — Hangi sayfa/özellik solo bir kurucu için gerçekten değer üretiyor? Neden?
2. **🔴 YARAMAYAN / GEREKSİZ KISIMLAR** — Hangi sayfa/özellik over-engineered, enterprise saplantısı veya kullanılmayacak? Neden?
3. **🟡 EKSİK KISIMLAR** — Solo bir e-ticaret operasyonu için kritik ama panelde olmayan ne var?

Her madde için **gerekçe** ver. Kuru liste değil — "neden işe yarıyor / neden gereksiz / neden eksik" diye düşün.

Son olarak **öncelikli aksiyon listesi** çıkar: hangisi acil sil, hangisi acil ekle, hangisi sadece sadeleştir.

---

## 📋 İŞ BAĞLAMI

### Şirket Profili
- **Ad:** Pim Etiket (pimetiket.com)
- **Ürün:** Etiket, sticker, ambalaj baskısı (sticker, rulo etiket, tabaka etiket)
- **Hedef kitle:** B2B — KOBİ markaları, e-ticaretçiler, üreticiler
- **Konum:** Türkiye (TR-only, KVKK uyumlu)
- **Personel:** Sefa (solo kurucu) + 0-2 operatör + fason üretim partnerleri (3-10 fason atölye)
- **Sipariş hacmi:** Launch öncesi (ay başına ~100-500 sipariş hedef)
- **AOV:** ~₺500-2000 (B2B baskı)
- **Üretim modeli:** Fason — siparişler dış atölyelere atanıyor, Sefa kalite kontrolü + müşteri iletişimi yapıyor

### Teknik Stack
- Next.js (custom version), Supabase, Vercel, PayTR (ödeme), Resend (mail), OpenAI (Pim chatbot + AI QC)
- 117 migration, 85+ API endpoint, 24 cron job

### Yasak Mantıklar (Kurucu kararı — değişmez)
- ❌ **Cüzdan / bakiye sistemi yok** — B2B baskıda standart değil
- ❌ **Puan / sadakat puan yok**
- ❌ **Üyelik tier indirimi yok** ("Gold üye %15 indirim" tarzı)
- ✅ Sadece **kupon** sistemi (VIP, referans, reprint, yorum bonusu)

---

## 🗺️ ADMIN PANEL TAM HARİTASI

### Sidebar Grupları (4 ana grup)

#### **1. OPERASYON (Akış) — Günlük iş**
| Sayfa | Amaç |
|-------|------|
| `/admin` | **Operatör Panosu** — KPI, sipariş funnel, todo, sistem sağlığı, partner üretim, 24h aktivite, bugünün geliri, özel tarih aralığı |
| `/admin/siparisler` | Tüm siparişler tablosu — filtre, partner kolonu, acil satır vurgusu, toplu durum, CSV |
| `/admin/siparis-ekle` | Manuel sipariş (telefon/WhatsApp) — müşteri, ürün, dosya, kupon |
| `/admin/ai-qc` | AI kalite kontrol kuyruğu — 3 karar seçeneği (iyi/kötü/düzelt-ve-prova), retry, geçmiş, toplu onay |
| `/admin/prova` | Müşteri prova onay takibi — SLA sayaç, bıçak/beyaz rozet, durum sekmeleri, WhatsApp paylaşım |
| `/admin/kargo` | Kargo takip — etiket yazdır, CSV, tahmini vs gerçek teslimat |

#### **2. MÜŞTERİ (CRM)**
| Sayfa | Amaç |
|-------|------|
| `/admin/musteriler` | Müşteri listesi — segment (VIP/Repeat/New/Risk/Lost), risk skoru, 2FA, suspend, mail |
| `/admin/musteriler/[id]` | Müşteri detay — sipariş geçmişi, notlar, etiketler, KVKK, kredi |
| `/admin/yorumlar` | Yorum onay/red — onaylanan yorum müşteriye otomatik kupon verir |
| `/admin/iadeler` | İade talepleri — 36 saat otomatik iade kuralı |
| `/admin/tasarimlar` | Müşteri tasarım dosyaları — AI QC sonucu, takılı dosya onarımı |
| `/admin/yardim-talepleri` | Müşteri destek — operatör ticket cevaplama |
| `/admin/destek` | (yardım-talepleri ile mükerrer olabilir) |
| `/admin/kvkk-talepleri` | KVKK silme/erişim talepleri |
| `/admin/aboneler` | Newsletter aboneler |

#### **3. ÜRETİM (Fason Yönetimi)**
| Sayfa | Amaç |
|-------|------|
| `/admin/fason` | Fason partner listesi — performans, kapasite, sözleşme |
| `/admin/fason/[id]` | Partner detay — yetenek (ürün-malzeme hiyerarşi, onaylı/beklemede/ret), iletişim log, atama modalı |
| `/admin/fason/yeni` | Yeni fason ekleme |

#### **4. YÖNETİM & SİSTEM**

**Finans:**
- `/admin/finans` — Gelir, marj, churn, breakdown
- `/admin/odemeler` — PayTR ödeme listesi
- `/admin/odemeler/[id]` — Tek ödeme detay (iade, çift ödeme)
- `/admin/kuponlar` — Kupon CRUD, bütçe takip

**Fiyat:**
- `/admin/fiyatlar` — Tier matrisi, malzeme/kaplama fiyatları, CSV import/export, sticky kaydet, diff modal
- `/admin/fiyat-hesapla` — Hızlı fiyat hesaplayıcı (sticker)
- `/admin/fiyat-hesapla-etiket` — Etiket rulo
- `/admin/fiyat-hesapla-tabaka` — Etiket tabaka

**İçerik (CMS):**
- `/admin/urunler` — Ürün kartları (anasayfa)
- `/admin/blog` — Blog post editör
- `/admin/galeri` — Galeri görselleri
- `/admin/gorseller` — Site görselleri (hero, OG, kapak)

**RBAC & Audit:**
- `/admin/calisanlar` — Personel — rol, izin matrisi, davet
- `/admin/denetciler` — Denetçi (auditor) çalıştırmaları + bulgular
- `/admin/audit-log` — Tüm admin aksiyonları log
- `/admin/raporlar` — İş raporları

**Sistem:**
- `/admin/sistem/bakim` — Bakım modu aç/kapa
- `/admin/sistem/cronlar` — Cron job izleme
- `/admin/mail-health` — Mail teslim durumu, test gönder
- `/admin/yedekler` — DB yedek durumu
- `/admin/arsiv` — R2 arşiv (eski dosya yönetimi)
- `/admin/ayarlar` — Genel ayarlar

#### **5. DEBUG / TEST (canlıda kullanılmaz)**
- `/admin/agents/design-qc-test`
- `/admin/debug/design-qc-test`
- `/admin/test-siparis-simulator`

### Rakamlar
- **~50 sayfa**
- **85+ API endpoint**
- **26 modül + 4 aksiyon (view/create/update/delete) RBAC matrix**
- **24 cron job** (denetçi auditor'ları, otomatik iade, kargo poll, prova hatırlatma, sepet takip vb.)

### Yeni Eklenen Özellikler (Son sprint — bilgin olsun)
- Operatör panosu 3.0 (KPI grid + funnel + 24h aktivite)
- Müşteri CRM v2 (segment + bulk actions)
- Fason detay v2 (yetenek hiyerarşi + atama modalı + performans kartı)
- AI QC bulk (toplu onay)
- Prova badge ve sekme sistemi
- Kargo gün karşılaştırma (tahmini vs gerçek)
- Sistem bakım modu sayfası
- Ödeme detay sayfası
- Pim chatbot artık /onay sayfasında prova bağlamını biliyor

---

## 🤔 ANALİZDE DÜŞÜNMEN GEREKEN SORULAR

### "İşe yarıyor mu?" testi için
- Sefa **günde 1+ kez** açacak mı? Yoksa ayda 1-2 mi?
- Bu özellik olmasaydı sipariş **patlar mıydı**? Yoksa sadece "iyi olur" mu?
- Verisi var mı? Yoksa boş sayfa mı? (örn: 10 müşteri varken segment analizi anlamlı mı?)
- Karar mekanizmasında **eylemde bulunmayı sağlıyor mu**? Yoksa "veri var ama ne yapacağım belli değil" mi?
- Çalışan eğitilebilir mi? (Karmaşık ise solo kurucu için tehlike)

### "Yaramıyor / gereksiz" sinyalleri
- Aynı işlevin **2 ayrı sayfada** olması (yardım-talepleri vs destek gibi)
- **Sıfır veri** olan dashboard'lar (segment, ısı haritası, top şehir vb.)
- Enterprise saplantısı (RBAC 26 modül × 4 aksiyon = 104 izin satırı — solo kurucu için aşırı mı?)
- Cron'ların yarısı henüz veri üretmiyor olabilir
- Auditor sistemi: **9 auditor + günlük digest** — bu solo bir şirket için over-kill mi?
- AI QC "düzelt ve prova hazırla" 3. seçenek — gerçekten kullanılacak mı yoksa nadir mi?

### "Eksik" düşünmen gereken alanlar
- Sefa **WhatsApp**'tan sipariş alıyorsa → admin'de yeterli mi?
- Fason atölye ile **iletişim** (WhatsApp grup, dosya transferi) — manuel mi yapılıyor?
- **Müşteri hesabı toplu işlem** — fatura adresleri, kurumsal/bireysel filtre?
- **Aylık rapor PDF** — muhasebeci için?
- **Kargo entegrasyonu** — sadece manuel mi, Yurtıçi/Aras otomatik mi?
- **E-fatura** entegrasyonu (Paraşüt/Bizim Hesap)
- **Stok takibi yok** — fason üretim yapıldığı için belki gerekmez ama malzeme stok?
- **Telefon araması logu** — B2B'de yaygın

### Türkiye/B2B baskı özelliği soruları
- **TC/Vergi no doğrulama** otomatik mi?
- **MERSIS no** kayıt yerinde mi?
- **e-arşiv fatura** zorunluluğu (5K TL+ siparişler)
- **KVKK aydınlatma metni** versiyonlama

---

## 📝 ÇIKTI FORMATI

Lütfen şu yapıda yanıt ver (markdown):

### 1. 🟢 İŞE YARAYAN KISIMLAR
- En değerli 10 sayfa/özellik — neden işe yaradığını **somut iş senaryosuyla** açıkla
- Format: `**Sayfa adı** — neden kritik (1-3 cümle iş senaryosu)`

### 2. 🔴 YARAMAYAN / GEREKSİZ KISIMLAR
- Silinmeli, sadeleştirilmeli veya ertelenmeli olanları **gerekçesiyle** listele
- Format: `**Sayfa/özellik** — sorun ne, ne yapılmalı (sil/sadeleştir/ertele)`

### 3. 🟡 EKSİK KISIMLAR
- Solo B2B baskı operasyonu için kritik ama panelde olmayan özellikler
- Format: `**Özellik** — neden gerekli, hangi acı noktasını çözer`

### 4. 🎯 ÖNCELİKLİ AKSİYON LİSTESİ
- **Hemen sil** (cognitive load azaltma):
- **Hemen ekle** (kritik eksik):
- **Sadeleştir** (var ama karmaşık):
- **Ertele** (v2/v3'e):

### 5. 💡 BÜYÜK RESİM YORUMU
- 3-5 cümle: Bu admin paneli solo bir B2B kurucu için **çok mu fazla**, **çok mu az**, **dengeli mi**?
- Üzerine ne tür bir **mental model** kurmak gerekir (operatör vs strateji vs raporlama)?

---

## ⚠️ DİKKAT

- "Genel olarak iyi görünüyor" tarzı yüzeysel cevap **isteme** — somut sayfa/özellik adlarıyla konuş
- Yasak mantıkları (cüzdan/puan/üyelik indirimi) **önerme**
- "X eklenirse harika olur" yerine "X olmadan Y acı çekiyor" formülünde düşün
- Solo bir kurucu için **tek sayfada 5 saniyede karar verebileceği** UX'i öncelikle
- Enterprise pattern'leri (kompleks RBAC, segment analytics, A/B test infra) **şüpheyle** karşıla — solo işletme bağlamında çoğu over-engineering

Cevabını Türkçe ver. Detaylı ama gevezelik etme — sayfa adı + 1-3 cümle gerekçe pattern'i tut.
