# Pim Etiket — Operasyon Runbook

> **Amaç:** Sefa solo geliştirici/operatör. Bir gün ekibe asistan, avukat,
> bir başkası katıldığında bu doküman onların 30 dakikalık onboarding'i.
>
> **Son güncelleme:** 11 Mayıs 2026 · **Versiyon:** v1.0

---

## 1. Günlük Operasyonel Akış

### Sabah açılış (5 dk)
1. `/admin` dashboard'a gir
2. **Alert strip** kontrol et:
   - AI QC kuyruğunda kaç sipariş bekliyor?
   - Prova onayı bekleyen var mı?
   - Fason atama bekleyen var mı?
   - Sözleşmesiz fason kaldı mı? (varsa **atama bloklanır**)
3. `/admin/kvkk-talepleri` → "Bekliyor" tab → **48h SLA içinde** sıraya al
4. `/admin/iadeler` → 36h geçen var mı? (otomatik iade cron'u kapsamış olmalı, ama gözle de)

### Gün boyu
- Sipariş geldikçe: `/admin/siparisler/[id]` → durum yönetimi
- Fason atama: smart picker yüksek skor + uygun uzmanlık öner — Sefa onaylar
- Manuel sipariş (telefon/WhatsApp): `/admin/siparis-ekle`

### Akşam kapanış (5 dk)
- `/admin/audit-log` son 24 saat — anormallik var mı?
- `/admin/yedekler` Pazar'a yakınsa son yedek tazeliği yeşil mi?

---

## 2. Fason Ekleme Prosedürü

**Önkoşul:** Veri işleyici sözleşmesi (template `.claude/legal-drafts/01`)
imzalanmış olmalı. **Sözleşmesiz fason'a atama yapılamaz** (KVKK m.12).

### Adımlar
1. `/admin/fason` → **Yeni fason ekle**
2. Modal'ı doldur:
   - Ad / unvan, e-posta, WhatsApp, iletişim kişisi
   - Uzmanlık (virgülle): `etiket, sticker, yaldız, holografik`
   - Tipik teslim (gün): default 7
   - **Sözleşme tarihi:** boş bırakırsan partner pasif sayılır
3. **Kaydet**
4. Kontrat avukat onayından geçtikten sonra dön → "Sözleşme tarihi" gir

### Test
- Yeni partner ile `/admin/siparisler/[id]` → **Fason'a gönder** → smart picker görsün
- Atama yapılınca `/admin/fason` → partner kart → atama geçmişi sağda

---

## 3. KVKK Talebi İşleme Prosedürü

**SLA:** 48 saat (yasal azami 30 gün, KVKK m.13/2)

### Talep tipleri ve eylem
| Tip | Aksiyon |
|---|---|
| **data_export** | Veritabanından kullanıcının tüm sipariş+tasarım+adres+yorum+sohbet kayıtlarını SELECT'le, ZIP'le, müşteriye email at, `result_path` doldur |
| **account_delete** | 48h grace dolunca: `auth.users` sil (cascade FK çoğunu temizler) → invoice/order kayıtları arşivde kalır → admin_note doldur |
| **partial_delete** | scope'taki tablolardan DELETE — örn `pim_chat: true` ise pim_conversations sil (tablo gelince) |
| **correction** | Müşteriyle e-postayla yaz, hangi alan yanlış öğren, manuel UPDATE |
| **objection** | KVKK m.11/h itiraz — manuel değerlendir, gerekirse avukat |
| **restriction** | Profile flag set, otomatik işleme dahil etme |

### Akış
1. `/admin/kvkk-talepleri` → Bekleyen tab → talebe tıkla
2. Detay modal'da müşteri bilgileri + scope + müşteri notu
3. Gerekli işlemleri elden yap (yukarıdaki tabloya göre)
4. Bittiğinde "Tamamlandı olarak işaretle" → admin_note yaz
5. Reddetme gerekiyorsa "Reddet" → gerekçe zorunlu (min 5 char)

### Sınırlı çözebilirlik durumu
- **Fatura kayıtları** silinemez (VUK + TTK 10 yıl) — müşteriye `/kvkk` bölüm 6.4'ü göster
- **Audit log** silinmez (immutable) — silme talebi ret gerekçesi olur
- **Fason'a aktarılmış veri** → fason'a 24 saat içinde "sil" bildirimi gönder (sözleşme gereği 30 gün limit)

---

## 4. Yedek Restore Prosedürü

**Sıklık:** 3 ayda bir tatbikat. Gerçek felaket olursa anlık.

Tam rehber: [`docs/BACKUP_SETUP.md` Adım 6](BACKUP_SETUP.md#6-restore-tatbikatı-3-ayda-bir-30-dk)

### Kısa hatırlatma (felaket senaryosu)
```bash
# 1. R2'den en son backup'ı indir
aws s3 cp s3://pimetiket-backups/weekly/{YEAR}/W{WK}-{DATE}/db.dump ./db.dump \
  --endpoint-url https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com

# 2. Checksum doğrula
aws s3 cp s3://pimetiket-backups/weekly/{YEAR}/W{WK}-{DATE}/db.sha256 ./db.sha256 \
  --endpoint-url https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
sha256sum -c db.sha256

# 3. Yeni Supabase projesi aç ya da mevcut DB'yi sıfırla (DİKKAT!)
pg_restore --no-owner --no-acl --clean --if-exists \
  --dbname "$NEW_DB_URL" ./db.dump

# 4. Storage restore
aws s3 cp s3://pimetiket-backups/weekly/.../storage.tar.gz ./
tar -xzf storage.tar.gz
# Her bucket için API ile upload
```

### Restore başarısız olursa
1. Supabase Pro 7-gün backup'ından restore et (Dashboard → Database → Backups)
2. Sentry'yi kontrol et — hangi tarihten itibaren veri kaybı var?
3. Müşterilere şeffaf bildirim (24 saat içinde, KVKK m.12)

---

## 5. Sentry Alarm Kontrol

`/admin/raporlar` veya doğrudan https://sentry.io

**Acil tepki gerektirenler:**
- Payment callback 5xx (PayTR iade alamamış olabilir)
- Storage upload başarısız tekrar tekrar (kullanıcı kayıp)
- Cron timeout (KVKK silme cron 5+ gün çalışmadıysa **yasal risk**)

---

## 6. Sefa Acil Durum Telefonları

| Durum | Kontak |
|---|---|
| Supabase down | Status: status.supabase.com · Twitter @supabase |
| Vercel down | status.vercel.com |
| Cloudflare R2 down | cloudflarestatus.com |
| PayTR sorun | Vendor desteği (kurulum sonrası) |
| KVKK ihlali şüphesi | Avukat + 72 saat içinde KVKK Kurulu'na bildirim (KVKK m.12/5) |

---

## 7. Migration Yönetimi

**Tek kaynak:** `supabase/migrations/*.sql` — numerik sıralı.

### Yeni migration eklerken
1. Migration numarası: bir önceki + 1 (örn 028 → 029)
2. Dosya adı: `029_<kısa_açıklama>.sql`
3. Idempotent yaz (`create table if not exists`, `do $$ ... end$$` enum)
4. **GRANT'leri DENEMEKsiz revoke etme** — service_role dışındakileri kapat
5. Sefa SQL Editor'de elle çalıştırır (Supabase CLI ileride)

### Migration listesi (son 10)
- 018: Fason aktarım sistemi (Yaklaşım D)
- 019: order_events constraint genişletme
- 020: Fason token + mail outbox
- 021: Fason performans view + skor refresh
- 022: audit_log admin read policy
- 023: Fason token RPC GRANT revoke (güvenlik)
- 024: fn_assign_order_to_fason atomic RPC
- 025: v_fason_performance fix + outbox payload TTL
- 026: design_files saklama altyapısı + rolling window
- 027: kvkk_requests tablosu
- 028: Saklama cron RPC'leri (purge + anonim)

---

## 8. Cron'lar (vercel.json)

| Path | Schedule | Ne yapar |
|---|---|---|
| `/api/cron/auto-refund` | `0 2 * * *` | 36h prova onaysız iptaller |
| `/api/cron/refresh-fason-scores` | `0 3 * * *` | Fason performans cache + outbox PII TTL |
| `/api/cron/process-mail-outbox` | `*/15 * * * *` | Resend gelmediyse pending, geldiğinde send |
| `/api/cron/purge-expired-designs` | `0 4 * * *` | KVKK m.4 — 24 ay sonu tasarımları sil + Pim anonim |

---

## 9. Avukat / Yasal Sorular

`.claude/legal-drafts/` altında 4 taslak var:
1. `01-fason-veri-isleyici-sozlesmesi.md`
2. `02-kvkk-aydinlatma-metin-guncelleme.md`
3. `03-mail-templates-tr.md`
4. `04-saklama-imha-politikasi.md`

**Avukat ile görüşme öncesi:**
- Bu 4 dosyayı dökümün (PDF veya basılı)
- KVKK m.9 Supabase Frankfurt standart sözleşme sorusu
- VERBİS muafiyet teyit
- FSEK ihlal davası kapsamı (hash 10 yıl yeterli mi?)
