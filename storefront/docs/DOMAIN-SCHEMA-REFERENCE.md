# Domain → Şema Referansı (Modüler Geliştirme)

> **Amaç:** API endpoint veya business logic yazarken **tüm 89 migration'ı taramak yerine** ilgili domain'in SQL + TypeScript tiplerine odaklan.
>
> **Kaynak:** `smart-context/manifest.json` → her domain'de `schemaMigrations`, `schemaTables`, `typeRefs`  
> **Kalıcı kayıt:** `docs/SCHEMA-TYPES-AGENT-GUIDE.md`
>
> **Kural:** Önce domain SQL'leri oku → `types.ts`'te sadece ilgili tablolar → kod yaz. `CLAUDE.md` sefaRules her zaman geçerli.

---

## Komut şablonu (Claude Code)

```
/baglam <hedef-dosya-veya-domain>

src/lib/supabase/types.ts dosyasındaki [TABLO LİSTESİ] tiplerini ve
supabase/migrations/ klasöründeki [MIGRATION LİSTESİ] dosyalarını referans alarak,
[GÖREV AÇIKLAMASI].
```

### Örnek — Sipariş & Ödeme (PayTR callback)

```
/baglam src/app/api/payment/callback/route.ts

src/lib/supabase/types.ts dosyasındaki orders, order_items, payments,
payment_intents, order_events veri tiplerini ve supabase/migrations/ klasöründeki
001_initial_schema.sql, 002_invoice_events_payments.sql, 007_payment_intents.sql,
009_paytr_provider.sql, 033_payment_finalize_atomic.sql, 069_payment_refund_idempotency.sql
dosyalarını referans alarak, PayTR callback mekanizmasını idempotent ve güvenli bir
akışla inşa et. wallet_amount her zaman 0; cüzdan mantığı ekleme (CLAUDE.md).
```

### Örnek — Fason / Partner

```
/baglam src/app/api/partner/orders/[id]/route.ts

types.ts: fason_partners, order_assignments, orders, order_items.
Migration: 018_fason_aktarim.sql, 024_fn_assign_order_to_fason.sql,
067_partner_extension.sql, 086_partner_contract_alignment.sql.
Partner sipariş detay endpoint'ini RLS + mevcut assignment status enum'una uygun yaz.
```

---

## Domain haritası

CLI ile şema listesini görmek:

```bash
npm run context -- --path src/app/api/payment/callback/route.ts
npm run context -- --query "sipariş ödeme"
npm run context -- --json --path src/lib/customer-order.ts
```

---

### order — Sipariş & Ödeme

| Alan | Değer |
|---|---|
| **Tablolar** | `cart_items`, `orders`, `order_items`, `order_events`, `payments`, `payment_intents` |
| **TypeScript** | `Tables<'orders'>`, `Tables<'order_items'>`, `Tables<'payments'>`, `Tables<'payment_intents'>`, `Enums<'order_status'>`, `Enums<'payment_intent_status'>` |
| **RPC** | `fn_create_order`, `fn_finalize_paid_order`, `fn_consume_payment_intent`, `fn_apply_coupon` |
| **Migration'lar** | `001`, `002`, `007`, `009`, `015`†, `019`, `033`, `053`, `057`, `058`, `061`, `065`, `069`, `070`, `072`, `073`, `078` |

† `015_drop_wallet.sql` — cüzdan kaldırıldı; callback'te `wallet_amount: 0`

**Hub kod:** `src/lib/customer-order.ts`, `src/lib/customer-cart.ts`, `src/app/api/payment/callback/route.ts`

---

### pricing — Fiyat Motoru

| Alan | Değer |
|---|---|
| **Tablolar** | `pricing_config`, `pricing_config_history`, `coupons`, `coupon_uses`, `site_settings` |
| **TypeScript** | `Tables<'pricing_config'>`, `Tables<'coupons'>`, `Enums<'coupon_kind'>` |
| **RPC** | `fn_validate_coupon`, `fn_apply_coupon` |
| **Migration'lar** | `005`, `029`, `047`, `048`, `049`, `050`, `030`, `043` |

**Not:** Kupon = tek seferlik (VIP/referans/reprint/yorum). Cüzdan/puan YASAK.

---

### configurator — Tasarım & Cutline

| Alan | Değer |
|---|---|
| **Tablolar** | `design_files`, `design_temp_uploads`, `design_quality_checks`, `cutline_designs`, `cart_items` |
| **TypeScript** | `Tables<'design_files'>`, `Enums<'design_file_status'>`, `Tables<'cutline_designs'>` |
| **Migration'lar** | `003`, `008`, `026`, `038`, `039`, `059`, `060`, `062`, `063`, `066`, `071`, `072`, `077` |

**Enum ayrımı:** `design_file_status` (`qc_passed`, `qc_warned`) ≠ `order_status` (`qc_pending`, `qc_flagged`)

---

### partner — Fason / Partner

| Alan | Değer |
|---|---|
| **Tablolar** | `fason_partners`, `partner_contacts`, `partner_capabilities`, `order_assignments`, `fason_access_tokens`, `fason_link_access_log` |
| **TypeScript** | `Tables<'fason_partners'>`, `Tables<'order_assignments'>`, `Enums<'assignment_status'>` |
| **RPC** | `fn_assign_order_to_fason`, `fn_generate_fason_token`, `fn_find_best_partner` |
| **Migration'lar** | `018`, `020`, `021`, `023`, `024`, `025`, `067`, `068`, `083`, `084`, `086`, `089` |

---

### admin — Admin Paneli & CRM

| Alan | Değer |
|---|---|
| **Tablolar** | `admin_role_permissions`, `customer_notes`, `customer_tags`, `customer_invoice_profiles`, `audit_log`, `v_admin_customers` |
| **Migration'lar** | `004`, `022`, `044`, `046`, `054`, `055`, `056`, `087` |
| **RPC** | `fn_log_audit`, assert-admin pattern |

---

### mail — E-posta

| Alan | Değer |
|---|---|
| **Tablolar** | `fason_mail_outbox`, `mail_suppressions`, `email_subscribers`, `notification_prefs` |
| **RPC** | `fn_enqueue_mail`, `fn_record_suppression`, `fn_is_suppressed` |
| **Migration'lar** | `004`, `034`, `035`, `037`, `076` |

---

### auth — Kimlik Doğrulama

| Alan | Değer |
|---|---|
| **Tablolar** | `profiles`, `auth.users` (Supabase managed) |
| **Migration'lar** | `001`, `002`, `011`, `042`, `088` |

---

### agents — Auditor

| Alan | Değer |
|---|---|
| **Tablolar** | `auditor_runs`, `auditor_findings`, `auditor_pending_actions`, `auditor_action_log`, `auth_failed_logins` |
| **Migration'lar** | `040`, `041` |

---

### legal — KVKK

| Alan | Değer |
|---|---|
| **Tablolar** | `kvkk_requests` |
| **Migration'lar** | `027` |

---

### database — Tam şema (sadece migration/RPC yazarken)

Tüm `supabase/migrations/*.sql` + `src/lib/supabase/types.ts` + `npm run supabase:types`

---

## Geliştirme akışı (5 adım)

1. **Domain seç** — manifest `id` veya `/baglam` ile dosyadan otomatik tespit
2. **SQL oku** — listedeki migration'ları sırayla (FK/RPC sırası için)
3. **types.ts filtrele** — sadece `schemaTables` satırları; tüm dosyayı ezberleme
4. **sefaRules kontrol** — `CLAUDE.md` yasak listesi
5. **Kod yaz** — hub dosyaları + mevcut route pattern'leri

---

## types.ts yenileme

Migration push sonrası:

```bash
npm run supabase:types
npx tsc --noEmit
```

Domain referansı değişmez; tablo içeriği güncellenir.

---

## İlgili dosyalar

| Dosya | Rol |
|---|---|
| `docs/SCHEMA-TYPES-AGENT-GUIDE.md` | Kalıcı sistem kaydı — dosya haritası, akış, changelog |
| `SESSION-LOG-2026-05-24.md` | Oturum detayı |
| `smart-context/manifest.json` | Domain → schemaMigrations / schemaTables |
| `CLAUDE.md` | sefaRules + komut şablonu özeti |
| `scripts/smart-context.mjs` | CLI çıktısında şema listesi |
| `.claude/commands/baglam.md` | Claude slash komut workflow |
