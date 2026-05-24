# Şema & Types — Smoke Test Checklist

> **Ne zaman:** Migration apply, `types.ts` regenerate veya `as never` temizliği sonrası  
> **Süre:** ~10 dakika (manuel) + `tsc` / `context` CLI (otomatik)

---

## Otomatik (her oturum sonu)

```bash
cd pim-etiket/core/storefront
npx tsc --noEmit
npm run context -- --path src/app/api/payment/callback/route.ts
npm run context -- --path src/lib/design-file-status.ts
npm run context -- --path src/app/admin/tasarimlar/page.tsx
```

**Beklenen:** exit 0 · context çıktısında `schemaMigrations` / `schemaTables` görünür

---

## 1. Admin tasarımlar — status filter

| Adım | Beklenen |
|---|---|
| `/admin/tasarimlar` aç (admin login) | Sayfa yüklenir |
| Filtre: **Tümü** | Liste gelir |
| Filtre: **AI işliyor** (`analyzing`) | API `?status=analyzing` — 200, boş liste OK |
| Filtre: **Yüklendi**, **AI ✓**, **Uyarı**, **Sorunlu**, **Onaylı** | Her biri 200, UI badge renkleri doğru |

API doğrudan:
```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Cookie: <admin-session>" \
  "http://localhost:3000/api/admin/designs?status=analyzing&limit=5"
# Beklenen: 200 (403 = session yok)
```

---

## 2. Ödeme akışı (types + RPC)

| Adım | Beklenen |
|---|---|
| `/odeme` → PayTR init | `payment_intents` insert (status pending) |
| PayTR test callback (success) | `fn_finalize_paid_order` → order oluşur |
| Aynı `merchant_oid` tekrar | Idempotent — duplicate order yok |
| PayTR fail callback | `payment_intents.status=failed`, `failure_reason` dolu |

**Kontrol SQL (Dashboard):**
```sql
SELECT id, status, failure_reason, order_id
FROM payment_intents
ORDER BY created_at DESC LIMIT 5;
```

---

## 3. Tasarım yükleme — usable status kümesi

| Adım | Beklenen |
|---|---|
| GET `/api/orders/{id}/upload-status` (müşteri session) | `items[].hasDesign` bool |
| `design_files.status` ∈ uploaded/analyzing/qc_warned/qc_passed/approved | `hasDesign: true` |
| `qc_failed` veya `superseded` | `hasDesign: false` |

---

## 4. Auditor mail alıcıları

| Adım | Beklenen |
|---|---|
| `AUDITOR_NOTIFY_EMAILS` env set | O adreslere gider |
| Env yok | `profiles.role IN (admin,staff)` → auth.users email |
| `notify_sefa` aksiyonu | Recipient listesi boş değil |

---

## 5. Migration 085–089 (apply sonrası)

Apply sırası: **085 → 086 → 087 → 088 → 089** (Dashboard SQL Editor veya `scripts/apply-migrations-085-089.mjs`)

| Migration | Verify |
|---|---|
| **085** | `fn_log_failed_login` — authenticated EXECUTE yok |
| **086** | Partner contract assign guard |
| **087** | `audit_action` customer.* enum değerleri |
| **088** | `SELECT * FROM fn_find_auth_user_by_email('test@example.com')` — tek satır veya boş |
| **089** | `fason_access_tokens.token_hash` kolonu dolu |

Apply sonrası:
```bash
npm run supabase:types
npx tsc --noEmit
```

---

## Regresyon işaretleri (kırmızı bayrak)

- `tsc` hata veriyor → types/enum uyumsuzluğu
- Admin designs filtresi 400 → Zod enum drift (`design-file-status.ts` vs DB)
- Payment callback intent bulunamıyor → `.eq("id", merchant_oid)` (kolon `id`)
- Auditor mail "No admin recipients" → `profiles.email` kullanımı (yasak — auth lookup kullan)
