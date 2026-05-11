# Pim Etiket — DR Backup Kurulum Rehberi

> **Hedef:** Supabase Pro'nun 7-gün backup'ından bağımsız haftalık tam
> yedek alıp Cloudflare R2'de 6 ay saklamak.
> **Workflow:** `.github/workflows/backup-supabase.yml` — Pazar 03:00 UTC.

---

## 1. Cloudflare R2 Bucket Aç (10 dk)

Cloudflare hesabın zaten var (Packanalyz için). Aynı hesabı kullan.

1. https://dash.cloudflare.com/ → **R2**
2. **Create bucket** → İsim: `pimetiket-backups`
3. Location: `EEUR` (Doğu Avrupa — Türkiye'ye yakın, KVKK uyumlu)
4. **Object lifecycle rules** ekle:
   - Prefix: `weekly/`
   - Action: Delete after **180 days** (6 ay = 26 hafta)
5. Bucket oluşunca, sol menüden **Account ID**'yi kopyala (URL'de
   ya da Overview sekmesinde)

---

## 2. R2 API Token Üret (5 dk)

1. R2 ana sayfa → sağ üst **Manage R2 API Tokens**
2. **Create API Token**
   - Token name: `pim-backup-writer`
   - Permissions: **Object Read & Write**
   - Bucket: yalnız `pimetiket-backups` (sınırla, full-access ALMA)
   - TTL: **No expiration** (cron'a uzun süreli lazım) ya da 1 yıl
3. **Create API Token** → çıkan değerleri kopyala:
   - Access Key ID
   - Secret Access Key
   - **Bunlar bir daha gösterilmez, hemen GitHub Secrets'a yapıştır.**

---

## 3. Supabase DB Connection String (5 dk)

1. Supabase Dashboard → Projeyi seç → **Project Settings**
2. **Database** → **Connection string** → **URI** sekmesi
3. **Session Mode** (port 5432, doğrudan bağlantı) — pg_dump için
4. Password placeholder'ı **gerçek DB password** ile değiştir:
   ```
   postgresql://postgres.{ref}:{password}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```
5. Bu string'i **gizli tut** — GitHub Secret'a ekleyeceksin.

---

## 4. GitHub Secrets Ekle (5 dk)

Pim Etiket repo'sunda:

1. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Aşağıdaki 7 secret'ı tek tek ekle:

| Secret adı | Değer |
|---|---|
| `SUPABASE_DB_URL` | Adım 3'teki connection string |
| `SUPABASE_PROJECT_REF` | Proje URL'indeki ref (örn `abcdefghijklmnop`) |
| `SUPABASE_SERVICE_KEY` | `service_role` key (Project Settings → API) |
| `R2_ACCOUNT_ID` | Adım 1'deki account ID |
| `R2_ACCESS_KEY_ID` | Adım 2'deki Access Key |
| `R2_SECRET_ACCESS_KEY` | Adım 2'deki Secret Access Key |
| `R2_BUCKET` | `pimetiket-backups` |

---

## 5. İlk Tetikleme (manuel test)

1. Repo → **Actions** sekmesi → **Supabase DR Backup** workflow
2. Sağ üst **Run workflow** → **Run workflow**
3. ~5-10 dk bekle (DB boyutuna bağlı)
4. **Yeşil ✓** olunca R2 bucket'a girip kontrol et:
   ```
   weekly/2026/W19-2026-05-11/
     ├── db.dump
     ├── db.sha256
     ├── storage.tar.gz
     ├── storage.sha256
     └── manifest.json
   ```
5. `db.dump` boyutu ~5-50 MB olmalı (DB boyutuna göre).
6. `storage.tar.gz` boyutu ~tasarım dosyaları toplamı olmalı.

---

## 6. Restore Tatbikatı (3 ayda bir, ~30 dk)

**Amaç:** Yedek gerçekten kurtarılabilir mi öğrenmek. KVKK m.12 +
ISO 27001 best practice.

### Önkoşul
- Yeni boş bir Supabase projesi aç (`pim-restore-test`) — Free tier yeter
- yerel pg_restore (Postgres 16+) ya da Docker image

### Akış
```bash
# 1. R2'den son backup'ı indir
aws s3 cp \
  s3://pimetiket-backups/weekly/2026/W19-2026-05-11/db.dump \
  ./db.dump \
  --endpoint-url https://${ACCOUNT_ID}.r2.cloudflarestorage.com

# 2. SHA256 doğrula
aws s3 cp \
  s3://pimetiket-backups/weekly/2026/W19-2026-05-11/db.sha256 \
  ./db.sha256 \
  --endpoint-url https://${ACCOUNT_ID}.r2.cloudflarestorage.com
sha256sum -c db.sha256  # OK olmalı

# 3. Restore (yeni boş projeye)
pg_restore \
  --no-owner --no-acl \
  --dbname "postgresql://postgres.{TEST_REF}:{TEST_PW}@{HOST}:5432/postgres" \
  ./db.dump

# 4. Smoke test: SQL Editor'de çek
SELECT count(*) FROM orders;
SELECT count(*) FROM design_files;
SELECT count(*) FROM kvkk_requests;
```

### Geçti sayılır
- Migration sayısı eşit (örn 27 migration)
- Row count'lar makul (production'a yakın)
- Random 10 sipariş select ile veri tutarlı

### Geçmediyse
- GitHub Actions log'larına bak (`Run workflow` history)
- pg_dump output'unu ham al, hata mesajını oku
- Sentry'ye otomatik alarm gönder (P0 alert)

---

## 7. Storage Snapshot Notu (büyük dosyalar)

Storage bucket'ları 10 GB'ı aşınca bu basit `curl` yaklaşımı yetersiz
kalır (timeout + memory):

- **10 GB'a kadar:** Mevcut workflow yeterli
- **10-100 GB:** `rclone` ekle, paralel chunked upload
- **100 GB+:** Direct S3 sync (Supabase Storage'ın S3-uyumlu endpoint'i
  geldiğinde, ya da R2'ye Cloudflare Tunnel ile direct)

---

## 8. Maliyet Hesabı

| Kalem | Aylık |
|---|---|
| R2 depo (~50 MB DB × 26 hafta) | ~$0.02 |
| R2 depo (~5 GB Storage × 26 hafta) | ~$2 |
| GitHub Actions süre (Free tier 2000 dk/ay) | $0 |
| Cloudflare R2 egress (sıfır, R2 ücretsiz) | $0 |
| **Toplam** | **~$2/ay** |

---

## 9. Cron Schedule Override

Aylık (1. Pazar) test etmek istersen workflow'da:
```yaml
on:
  schedule:
    - cron: "0 3 1-7 * 0"  # Her ayın ilk Pazarı
```

Günlük dener miyim derse:
```yaml
on:
  schedule:
    - cron: "0 3 * * *"  # Her gün 03:00
```
**Ama 26 hafta saklama yerine 26 gün olur — lifecycle rule güncellenmeli.**
