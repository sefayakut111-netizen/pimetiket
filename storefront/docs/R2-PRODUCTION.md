# R2 Production Checklist

Cloudflare R2 cold archive + cutline hot path production devreye alma rehberi.

## Ortam değişkenleri (Vercel Production)

| Değişken | Açıklama |
|----------|----------|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_ENDPOINT` | EU: `https://<account_id>.eu.r2.cloudflarestorage.com` |
| `R2_BUCKET` | `pim-etiket-archive` (varsayılan) |
| `R2_ARCHIVE_DRY_RUN` | **`false`** — cold archive cron gerçek taşıma yapar |

## DRY_RUN ayrımı (R2-A)

- **`R2_ARCHIVE_DRY_RUN`** yalnızca `archive-service` + `archive-inactive` cron'unu etkiler.
- **Hot path** (cutline upload, manifest signed URL, purge delete, KVKK delete) her zaman gerçek R2 kullanır.

## Smoke test sırası

```bash
cd pim-etiket/core/storefront

# 1) Hot path R2
npm run verify:r2 -- --fetch

# 2) Upload zinciri (statik)
npm run verify:upload-chain

# 3) Cold archive (test müşterisi — DRY_RUN=true ile önce)
node scripts/test-r2-archive.mjs <test_user_uuid>

# 4) Production arşiv açıkken tekrar (R2_ARCHIVE_DRY_RUN=false)
R2_ARCHIVE_DRY_RUN=false node scripts/test-r2-archive.mjs <test_user_uuid>

# 5) Restore URL
node scripts/test-r2-restore.mjs <design_file_uuid> <user_uuid>

# 6) Manifest + URL smoke (canlı sipariş)
node scripts/verify-manifest-restore.mjs --order <orderId>
```

## Operasyon checklist

1. Test sipariş → prova kaydet → R2 dashboard'da `customer-cutlines/` key görünüyor mu?
2. `/admin/arsiv` → R2 badge **hot path: bağlı** gösteriyor mu?
3. `R2_ARCHIVE_DRY_RUN=false` sadece arşiv cron'unu etkiliyor mu?
4. Staging'de `purge-expired-designs` → R2 `archive_path` + cutline key silindi mi?
5. `cleanup-temp-designs` cron → expired temp storage temizlendi mi?

## EU endpoint doğrulama

R2 bucket EU bölgesindeyse endpoint mutlaka `.eu.r2.cloudflarestorage.com` içermeli.
Yanlış endpoint → upload 403 veya timeout.

## İlgili cron'lar (vercel.json)

| Cron | Schedule |
|------|----------|
| `archive-inactive` | 03:30 UTC |
| `cleanup-temp-designs` | 03:15 UTC |
| `cleanup-stale-uploads` | 03:45 UTC |
| `purge-expired-designs` | 04:00 UTC |
| `cleanup-orphan-previews` | Pazar 04:00 UTC |
