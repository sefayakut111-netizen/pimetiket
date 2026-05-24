# Şema, TypeScript Tipleri & Agent Referans Rehberi

> **Sistem kaydı:** 24 Mayıs 2026 Cursor oturumu  
> **Oturum detayı:** `SESSION-LOG-2026-05-24.md`  
> **Durum:** Kayıtlı — commit `886933c`, push `origin/main` (24 May 2026)

Bu dosya, veritabanı şeması + `types.ts` + agent kuralları + modüler domain geliştirmenin **tek giriş noktasıdır**. Claude Code, Cursor ve `/baglam` bu rehberi referans alır.

---

## 1. Dosya haritası (sistemde nerede ne var)

| Konu | Dosya | Rol |
|---|---|---|
| **TypeScript tipleri** | `src/lib/supabase/types.ts` | Remote şemadan CLI üretimi (~4053 satır) |
| **Tip yenileme** | `package.json` → `npm run supabase:types` | Regenerate komutu |
| **SQL kaynak** | `supabase/migrations/` (001–089) | Tek gerçek şema kaynağı |
| **Domain → SQL haritası** | `docs/DOMAIN-SCHEMA-REFERENCE.md` | Modüler geliştirme, komut şablonları |
| **Şema ≠ ürün kararı** | `CLAUDE.md` | sefaRules, cüzdan/puan yasağı, API checklist |
| **Agent rehberi** | `AGENTS.md` | Smart Context, domain listesi |
| **Manifest** | `smart-context/manifest.json` | `schemaMigrations`, `schemaTables`, `typeRefs` |
| **CLI bağlam** | `scripts/smart-context.mjs` | `npm run context -- --path <dosya>` |
| **Claude slash** | `.claude/commands/baglam.md` | `/baglam` workflow |
| **Cursor DB kuralı** | `.cursor/rules/database.mdc` | Migration + types uyarıları |
| **Cursor order kuralı** | `.cursor/rules/order-flow.mdc` | Order domain migration listesi |
| **Backend agent** | `.claude/agents/backend.md` | Endpoint yazım yasakları |
| **Cüzdan kaldırma** | `supabase/migrations/015_drop_wallet.sql` | `wallet_transactions` drop |

**Supabase proje ref:** `ucmpwxnoaqjpzhijnxtp`

---

## 2. Üç çalışma paketi (24 May 2026)

### Paket A — Şema envanteri

- 89 migration (`001_initial_schema.sql` → `089_fason_token_hash.sql`)
- 50+ tablo, 5 view, 40+ RPC, 15 enum
- `wallet_transactions` Mig **015** ile kaldırıldı (types.ts'te yok)

### Paket B — TypeScript tipleri regenerate

```bash
cd pim-etiket/core/storefront
npm run supabase:types
npx tsc --noEmit
```

| Metrik | Önce | Sonra |
|---|---|---|
| Satır | ~727 | ~4053 |
| Kaynak | El yazımı (mig 001–006) | CLI remote şema |
| Helper | Manuel `interface` | `Tables`, `Enums`, `Constants` |

**Düzeltilen TS hataları (10 → 0):**

| Dosya | Konu |
|---|---|
| `archive/customers/route.ts` | `archive_status` enum |
| `admin/designs/route.ts` | `design_file_status` Zod |
| `upload-proof/route.ts` | MIME guard |
| `odeme-sonuc/page.tsx` | order vs design enum karışıklığı |
| `customer-order.ts` | `Tables<'orders'>` + Json cast |

### Paket C — Agent kuralları & modüler referans

1. **Şema ≠ Ürün** (`CLAUDE.md`) — şemada tablo görünmesi özellik aktif etmez
2. **sefaRules öncelikli** — cüzdan / puan / üyelik indirimi YASAK
3. **Domain modülerliği** — API yazarken 89 migration değil, domain listesi

---

## 3. Geliştirme akışı (standart)

```
Migration push (Sefa/manuel)
    ↓
npm run supabase:types
    ↓
npx tsc --noEmit
    ↓
npm run context -- --path <hedef-dosya>   → domain migration listesi
    ↓
İlgili supabase/migrations/*.sql oku
    ↓
types.ts → sadece schemaTables satırları
    ↓
CLAUDE.md sefaRules kontrol
    ↓
Kod yaz (hub pattern'leri takip et)
```

---

## 4. Modüler komut şablonu (Claude Code)

```
/baglam <hedef-dosya>

src/lib/supabase/types.ts dosyasındaki [TABLO…] veri tiplerini ve
supabase/migrations/ klasöründeki [MIGRATION…] dosyalarını referans alarak,
[GÖREV]. CLAUDE.md sefaRules geçerli; cüzdan/puan/üyelik indirimi ekleme.
```

### PayTR callback (order domain — referans örnek)

```
/baglam src/app/api/payment/callback/route.ts

types.ts: orders, order_items, payments, payment_intents, order_events
migrations: 001, 002, 007, 009, 033, 069
→ PayTR callback idempotent; wallet_amount: 0
```

Domain detayları: **`docs/DOMAIN-SCHEMA-REFERENCE.md`**

---

## 5. sefaRules vs şema (özet)

| Durum | Kural |
|---|---|
| `coupons`, `coupon_uses` şemada var | Sadece tek-seferlik kupon (VIP/referans/reprint/yorum) |
| `wallet_transactions` | Mig 015 drop — **kullanma** |
| `payments.wallet_amount` | Legacy — **her zaman 0** |
| `loyalty_grants` | Admin audit log — müşteri puan/cüzdan değil |
| `types.ts`'te 50+ tablo | Hepsine API yazma — domain filtresi uygula |

---

## 6. Enum tuzağı (sık hata)

| Enum | Tablo | Örnek |
|---|---|---|
| `order_status` | `orders.status` | `qc_pending`, `qc_flagged`, `proof_pending` |
| `design_file_status` | `design_files.status` | `qc_passed`, `qc_warned`, `qc_failed` |

`qc_passed` / `qc_warned` **sipariş değil**, tasarım dosyası durumudur.

---

## 7. Tamamlanan işler (24 May 2026 oturumu)

| # | İş | Durum |
|---|---|---|
| 1 | Git commit + push (`886933c`) | ✅ |
| 2 | `admin/designs` UI — status filter enum | ✅ |
| 3 | `Tables<>` + RPC `as never` (yüksek trafik) | ✅ |
| 4 | `supabase/README.md` header (89 mig) | ✅ |
| 5 | `design-file-status.ts` tek kaynak | ✅ |

### Opsiyonel devam (teknik borç)

| # | İş | Durum |
|---|---|---|
| 1 | Migration 085–089 remote apply | ⏳ `scripts/apply-migrations-085-089.mjs` |
| 2 | Kalan `as never` (~150) | 🔄 agents/proof/design temizlendi |
| 3 | Smoke test checklist | ✅ `docs/SCHEMA-SMOKE-TEST.md` |
| 4 | `admin-recipients` + `auth-user-lookup` | ✅ |

---

## 8. Hızlı komutlar

```bash
cd pim-etiket/core/storefront

npm run supabase:types
npx tsc --noEmit
npm run context -- --path src/app/api/payment/callback/route.ts
npm run context -- --query "sipariş ödeme"
```

---

## 9. Değişen dosyalar (24 May — tam liste)

| # | Dosya |
|---|---|
| 1 | `src/lib/supabase/types.ts` |
| 2 | `package.json` |
| 3 | `src/lib/customer-order.ts` |
| 4 | `src/app/api/admin/archive/customers/route.ts` |
| 5 | `src/app/api/admin/designs/route.ts` |
| 6 | `src/app/api/admin/orders/[id]/upload-proof/route.ts` |
| 7 | `src/app/odeme-sonuc/page.tsx` |
| 8 | `CLAUDE.md` |
| 9 | `AGENTS.md` |
| 10 | `.cursor/rules/00-core.mdc` |
| 11 | `.cursor/rules/database.mdc` |
| 12 | `.cursor/rules/order-flow.mdc` |
| 13 | `.claude/agents/backend.md` |
| 14 | `.claude/commands/baglam.md` |
| 15 | `docs/DOMAIN-SCHEMA-REFERENCE.md` *(yeni)* |
| 16 | `docs/SCHEMA-TYPES-AGENT-GUIDE.md` *(yeni — bu dosya)* |
| 17 | `smart-context/manifest.json` |
| 18 | `scripts/smart-context.mjs` |
| 19 | `SESSION-LOG-2026-05-24.md` |
| 20 | `supabase/README.md` *(header güncelleme)* |
| 21 | `docs/MIGRATIONS-APPLIED.md` *(types bölümü)* |
| 22 | `docs/BEKLEYEN-ISLER.md` *(tamamlananlar)* |
