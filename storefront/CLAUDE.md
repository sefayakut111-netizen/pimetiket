@AGENTS.md

# Claude Code — Pim Etiket

Bu dosya Claude Code oturumlarında **AGENTS.md üstüne** okunur. API, migration veya checkout yazmadan önce aşağıdaki **şema–kural uyumu** bölümünü esas al.

## ⚡ Bağlam önbelleği — ÖNCE HARİTAYI OKU (token tasarrufu)

Keşif için glob/grep'e başlamadan önce **`docs/SISTEM-BAGIMLILIK-HARITASI.md`** oku — tek okumayla: 123 sayfa route'u, 241 API ucu (method+guard), en çok import edilen 30 hub modül, mega dosyalar, lib envanteri.

- "X sayfası/API'si nerede, guard'ı ne, merkezi modül hangisi" sorularını ORADAN cevapla; sadece haritada olmayan detay için grep yap.
- Harita üretilmiş dosyadır — elle düzenleme. Bayatsa (büyük refactor sonrası): `npm run context:map` (~5 sn).
- Z raporu ritüelinde harita yenilenir.

---

## Şema ≠ Ürün Kararı (KRİTİK)

`src/lib/supabase/types.ts` ve `supabase/migrations/` **89 migration** içerir. Geçmiş migration'lardan kalan tablolar, kolonlar ve RPC'ler şemada görünebilir; bu **otomatik olarak aktif özellik** anlamına gelmez.

**Tek otorite:** `smart-context/manifest.json` → `core.sefaRules` + bu dosya.

> Tablo şemada var diye API'ye ekleme. Sefa kuralları şemadan üstündür.

### Yasak mantıklar (yeni kod / yeni API)

Aşağıdakileri **hiçbir endpoint, RPC çağrısı, UI akışı veya migration'da yeniden hayata geçirme**:

| Yasak | Açıklama | Referans |
|---|---|---|
| **Cüzdan** | Bakiye, yükleme, harcama, `wallet_*` | Migration **015** `wallet_transactions` drop |
| **Puan** | Puan biriktirme, puanla ödeme, sadakat puanı | Sefa kararı — B2B baskıda standart değil |
| **Üyelik indirimi** | Tier/level bazlı otomatik indirim, “üye olunca %X” | Sefa kararı — kupon ayrı kanal |

**Örnek yasak işler:**
- `wallet_transactions` tablosuna SELECT/INSERT (Mig 015 ile kaldırıldı)
- Müşteri bakiyesi gösteren `/api/wallet/*` endpoint
- Siparişte `wallet_amount > 0` ile ödeme düşme
- Puan kazanma / puan harcama API'si
- “Gold üye %15 indirim” gibi otomatik üyelik tier'ı

### Legacy kolonlar — dokunma ama özellik yapma

| Kolon / kalıntı | Şemada | Kodda ne yapılır |
|---|---|---|
| `payments.wallet_amount` | legacy | **Her zaman `0`** — `payment/init` pattern'ini koru |
| `grant-credit` endpoint | dosya var | **410 Gone** — yeniden implement etme |

### Şemada var, sınırlı kullanım (genişletme yasak)

Bu tablolar **mevcut akışlar** için kalır; yasak üçlüye (cüzdan/puan/üyelik indirimi) dönüştürme:

| Tablo / RPC | İzinli kullanım | Yasak genişletme |
|---|---|---|
| `coupons`, `coupon_uses` | Checkout'ta tek seferlik kupon (`fn_validate_coupon`, `fn_apply_coupon`) | Puan cüzdanı, üyelik tier indirimi |
| `referrals`, `fn_complete_referral` | Davet eden/edilen için **tek seferlik** kupon kredisi | Sürekli puan birikimi |
| `loyalty_grants` | Admin CRM **manuel jest logu** (audit) | Müşteriye görünen bakiye/puan |
| `reviews` + kupon bonusu | Yorum sonrası tek seferlik kupon (mevcut) | Sadakat programı |

Aktif kupon türleri (`.cursor/rules/pricing.mdc`): **VIP, referans, reprint, yorum bonusu** — cüzdan değil.

### API yazarken checklist

Yeni route handler / Server Action / RPC entegrasyonu yazmadan önce:

1. **`types.ts`'te tablo görüyorum** → Sefa yasak listesinde mi? Evetse **kullanma**.
2. **Ödeme akışı** → `wallet_amount: 0`; cüzdan düşümü yok.
3. **İndirim** → Sadece mevcut kupon RPC'leri; üyelik tier veya puan mantığı ekleme.
4. **Admin “kontör / bakiye ver”** → `/admin/kuponlar` (kupon); cüzdan endpoint'i açma.
5. **Migration** → `wallet_transactions` veya benzeri tablo **yeniden oluşturma**.

### Hızlı referans — sefaRules (manifest)

`smart-context/manifest.json` → `core.sefaRules`:

- Cüzdan / puan / üyelik indirimi **YASAK** (Migration 015 kaldırdı)
- Tasarımcı Pim / Kargocu Pim persona dropdown **YASAK** — tek akıllı Pim
- Dalkavuk dil **YASAK**
- “Süresiz” **YASAK** — TKHK m.61
- Yapay empati **YASAK**
- Bursa lokasyon **YASAK**
- Bot menüsü ve hazır chip **YASAK**

### Tip dosyası notu

`npm run supabase:types` şemayı remote'dan üretir. **types.ts'te bir tablo görünmesi**, o özelliğin ürün roadmap'inde olduğu anlamına gelmez. Kod yazarken önce bu dosyayı, sonra sefaRules'u kontrol et.

---

## Modüler şema referansı (API / business logic)

Her endpoint veya iş mantığı **ilgili domain'in migration'larına** odaklanmalı — 89 migration'ın tamamını taramak yasak değil ama verimsiz.

**Kaynak:** `docs/DOMAIN-SCHEMA-REFERENCE.md` + `smart-context/manifest.json` → `schemaMigrations`, `schemaTables`, `typeRefs`

### Okuma sırası

1. `/baglam <hedef-dosya>` veya `npm run context -- --path <dosya>` → domain şema listesi
2. Listelenen `supabase/migrations/*.sql` dosyalarını oku
3. `src/lib/supabase/types.ts` içinde **sadece** ilgili tablo/enum/RPC tiplerine bak
4. Hub kod dosyalarını (`customer-order.ts` vb.) pattern için oku
5. `CLAUDE.md` sefaRules — cüzdan/puan/üyelik indirimi yine yasak

### Komut şablonu (Claude Code'a ver)

```
/baglam <hedef-route-veya-lib>

src/lib/supabase/types.ts dosyasındaki [TABLO1, TABLO2, …] veri tiplerini ve
supabase/migrations/ klasöründeki [001_….sql, 002_….sql, …] dosyalarını referans
alarak, [GÖREV]. CLAUDE.md sefaRules geçerli; cüzdan/puan/üyelik indirimi ekleme.
```

### Örnek — PayTR callback (order domain)

```
/baglam src/app/api/payment/callback/route.ts

src/lib/supabase/types.ts dosyasındaki orders, order_items, payments,
payment_intents, order_events veri tiplerini ve supabase/migrations/ klasöründeki
001_initial_schema.sql, 002_invoice_events_payments.sql, 007_payment_intents.sql,
009_paytr_provider.sql, 033_payment_finalize_atomic.sql, 069_payment_refund_idempotency.sql
dosyalarını referans alarak, PayTR callback mekanizmasını idempotent ve güvenli bir
akışla inşa et. wallet_amount her zaman 0.
```

Domain listesi ve diğer örnek komutlar: **`docs/DOMAIN-SCHEMA-REFERENCE.md`** · Kalıcı sistem kaydı: **`docs/SCHEMA-TYPES-AGENT-GUIDE.md`**

---

## İkon tasarım dili (BAĞLAYICI)

Sisteme eklenen **her yeni ikon** `docs/ICON-DESIGN-SPEC.md` anayasasına uymak zorundadır. Bu, Sefa onaylı kalıcı yönergedir.

- **Tek kaynak:** `src/components/Icon.tsx` (merkezî kütüphane). Yeni ikon buraya component + `Icon` registry kaydı olarak eklenir.
- **Değişmezler:** `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, round cap/join, `baseProps(size)` helper.
- **Stroke skalası:** 1.6 / 1.7 (varsayılan) / 1.8 / 2.0 — istisna yalnız Check (3.0).
- **Marka aksanı:** kontur kesim ipucu mercan kesikli çizgi (`#FF6B5B`, `stroke-dasharray`); renk gövdeye değil aksana.
- **Yasak:** inline SVG ile var olan ikonu kopyalama; renk hard-code; viewBox/stroke skalası dışına çıkma.
- Spec değişirse `docs/ICON-DESIGN-SPEC.md` güncellenir; bu blok ona işaret eder.

---

## İlgili dosyalar

| Dosya | Ne için |
|---|---|
| `smart-context/manifest.json` | sefaRules kaynağı |
| `supabase/migrations/015_drop_wallet.sql` | Cüzdan kaldırma kararı |
| `src/app/api/admin/customers/[id]/grant-credit/route.ts` | 410 Gone — örnek deprecated pattern |
| `.cursor/rules/pricing.mdc` | Kupon vs cüzdan ayrımı |
| `docs/PRICING-MATRIX.md` | Fiyat / indirim matrisi |
| `docs/DOMAIN-SCHEMA-REFERENCE.md` | Domain → migration → tablo → komut şablonları |
| `docs/SCHEMA-TYPES-AGENT-GUIDE.md` | Kalıcı sistem kaydı (24 May oturumu) |
| `docs/ICON-DESIGN-SPEC.md` | İkon tasarım anayasası (bağlayıcı) — yeni ikon kuralları |
