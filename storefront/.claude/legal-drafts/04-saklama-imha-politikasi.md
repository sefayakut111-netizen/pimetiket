# Kişisel Veri Saklama ve İmha Politikası — Taslak v1.0

> ⚠️ **AVUKAT ONAYI BEKLİYOR** · KVKK Yönetmelik m.5/2 gereği yazılı politika zorunlu.
> **Tarih:** 11 Mayıs 2026 · **Versiyon:** Taslak 1.0
> **Veri sorumlusu:** SEFA YAKUT KIRTASİYE BASKI TİCARET LİMİTED ŞİRKETİ

---

## 1. Amaç

Bu politika, Pim Etiket ("şirket") tarafından işlenen kişisel verilerin
saklanma ve imha süreçlerini, ilgili kanun ve yönetmelik hükümleri
doğrultusunda belirler.

**Yasal dayanaklar:**
- 6698 sayılı KVKK
- Kişisel Veri Saklama ve İmha Politikası Hazırlama Rehberi (KVKK Kurumu, 2017)
- 213 sayılı Vergi Usul Kanunu (VUK m.253-256)
- 6102 sayılı Türk Ticaret Kanunu (TTK m.82)
- 5846 sayılı Fikir ve Sanat Eserleri Kanunu (FSEK)

---

## 2. Kapsam

Şirketin müşterileri, web sitesi ziyaretçileri, çalışanları, tedarikçileri
ve diğer ilgili kişilerin kişisel verileri.

---

## 3. Kişisel Veri Kategorileri ve Saklama Süreleri

| # | Veri Kategorisi | Saklama Süresi | Yasal/İş Dayanağı |
|---|---|---|---|
| 1 | Kimlik bilgileri (ad, T.C., VKN) | Hesap aktif + 10 yıl | KVKK m.5/2-c + TTK m.82 |
| 2 | İletişim (e-posta, telefon, adres) | Hesap aktif olduğu sürece | KVKK m.5/2-c |
| 3 | Müşteri işlem (sipariş, ödeme) | 10 yıl | TTK m.82 + VUK m.253 |
| 4 | Fatura ve mali kayıtlar | 10 yıl | VUK + TTK |
| 5 | **Tasarım dosyaları (orijinal PDF/PNG)** | **Son siparişten 24 ay** (her reorder ile yenilenir) | KVKK m.5/2-c — sözleşmenin devamı |
| 6 | Tasarım hash + metadata | 10 yıl | FSEK m.66 — telif ihlal kanıtı |
| 7 | Versiyon geçmişi (V1, V2...) | Son onaylı versiyon hariç 18 ay | KVKK m.4 orantılılık |
| 8 | Pim asistanı sohbet (PII'li) | 6 ay sonra anonimleştir, 24 ay sonra sil | KVKK m.4 + m.7 |
| 9 | Audit log (admin işlemleri) | 10 yıl (immutable) | KVKK m.12 |
| 10 | İade kayıtları | 10 yıl | VUK + TBK m.231 |
| 11 | Çerez verileri | Çerez Politikasındaki süreler | Açık rıza |
| 12 | Pazarlama izin kaydı | İzin geri alınana kadar | Açık rıza |
| 13 | Görsel kayıtlar (atölye CCTV) | 30 gün | Meşru menfaat (güvenlik) |
| 14 | Fason mail outbox payload PII | 30 gün sonra NULL | KVKK m.4 (Migration 025) |

---

## 4. İmha Yöntemleri (KVKK Yönetmelik m.8)

### 4.1 Silme
Verinin geri getirilemeyecek şekilde kalıcı olarak ortadan kaldırılması.

**Veritabanı:** `DELETE` SQL + cascade FK trigger.
**Dosya:** Supabase Storage API delete + R2 Object delete.
**Yedek:** En son yedek alındıktan sonra ilgili yedekleme döngüsü
sonunda yedeklerden de silinir.

### 4.2 Yok Etme
Fiziksel kayıtlar için ezme/yakma — Pim Etiket fiziksel kayıt tutmaz,
dijital ortamda **silme** ile eşdeğer uygulanır.

### 4.3 Anonimleştirme (KVKK m.28/1-b)
Verinin kişiyle ilişkilendirilemeyecek hale getirilmesi.

**Pim sohbet anonimleştirme prosedürü (6 ay sonra):**
1. `user_id` NULL'a çekilir
2. Mesaj içeriği kişisel veri içeriyorsa (isim, telefon, mail) regex
   ile maskelenir
3. IP adresi son oktet maskelenir (`1.2.3.0`)
4. Audit izi: `anonymized_at` kaydı tutulur

**Geri döndürülemezlik kontrolü:** Anonimleştirilmiş veriler üzerinden
ters mühendislik mümkün olmayacak şekilde sürecin tasarlandığı
test edilir (3 ayda bir bağımsız iç inceleme).

---

## 5. Periyodik İmha Süreçleri

| Süreç | Sıklık | Mekanizma | Sorumlu |
|---|---|---|---|
| Tasarım dosyası TTL kontrolü | Günlük 03:00 | `fn_purge_expired_designs` cron | Sistem |
| Fason mail outbox payload temizliği | Günlük 03:00 | `fn_cleanup_outbox_payload` cron | Sistem |
| Pim sohbet anonimleştirme | Haftalık | `fn_anonymize_pim_conversations` cron | Sistem |
| 10 yıl yasal saklama sonu silme | Aylık | `fn_purge_legal_expired` cron | Sistem |
| KVKK silme talepleri (48 saat) | Talep üzerine | `/admin/kvkk-talepleri` | Veri Sorumlusu Temsilcisi |
| Müşteri yedek erişimi (R2) | Talep üzerine | Manuel restore | Veri Sorumlusu |

---

## 6. KVKK m.11 İlgili Kişi Hakları

Müşteriler `/ayarlar/verilerim` sayfasından self-serve olarak:
- Verilerini ZIP olarak indirebilir (m.11/g)
- Granular silme talebi oluşturabilir (m.11/e)
- Hesabını silebilir (48 saat grace period ile)
- Talep geçmişini takip edebilir

**SLA:**
- Otomatik kategoriler (export, silme): **48 saat** içinde sonuçlandırılır
- Manuel kategoriler (düzeltme, itiraz): **30 gün** (yasal azami — KVKK m.13)

---

## 7. Veri Sorumlusu Temsilcisi

**Sorumlu:** Sefa Yakut
**E-posta:** info@pimetiket.com
**KVKK iletişim:** /iletisim sayfası

---

## 8. Üçüncü Taraf Aktarımı

| Taraf | Veri Kategorisi | Yasal Dayanak | Sözleşme |
|---|---|---|---|
| Fason üretim ortakları | Ad, adres, tasarım, sipariş detay | KVKK m.5/2-c + m.8/2-a | Veri işleyici sözleşmesi (`legal-drafts/01`) |
| PayTR | Ödeme bilgileri | KVKK m.5/2-c | BDDK lisansı + PCI-DSS |
| Supabase (Frankfurt) | Tüm DB + Storage | KVKK m.9 (yurtdışı) | **Standart sözleşme** (avukat bekleniyor) |
| Vercel | Hosting + edge cache | KVKK m.9 | Standart sözleşme |
| Resend | E-posta gönderim | KVKK m.5/2-c | Standart sözleşme |
| OpenAI | Pim sohbet | Açık rıza | API tier (eğitime kullanılmaz) |

---

## 9. Veri Güvenliği Tedbirleri (KVKK m.12)

- TLS 1.3 her bağlantıda
- Bcrypt şifre hashing
- RLS (Row Level Security) tüm tablolarda
- Audit log immutable trigger (Migration 004)
- 3D Secure ödeme
- Signed URL ile tasarım erişimi (15 dk geçerli, her tıklamada fresh)
- Veri işleyici sözleşmesi kontrolü (fason atama bloklanır)
- Yedekleme: aylık `pg_dump` + Storage snapshot → Cloudflare R2
- 3 ayda bir restore tatbikatı

---

## 10. Politika Güncelleme

Bu politika **yılda en az bir kez** veya yasal değişiklik halinde
güncellenir. Son güncelleme tarihi her zaman `/kvkk` ve bu dokümanın
başında belirtilir.

---

> **AVUKAT İÇİN NOT:**
>
> 1. Supabase eu-central-1 → KVKK m.9 standart sözleşme şart mı?
> 2. Fason 30 gün vs müşteri 48 saat çelişkisi nasıl yazılı yönetilir?
> 3. FSEK m.66 ihlali davası için tasarım 24 ay + hash 10 yıl yeterli mi yoksa dosya 10 yıl mı?
> 4. VERBİS muafiyet sorgulanmalı (50 çalışan + 25M TL altı + özel nitelikli veri YOK).
> 5. Çocuk yaş kontrolü (18 altı) prosedürü politikaya eklensin mi?
