# Kritik Bug Fix — Para + KVKK + Veri Kaybı

> 4 bulgu Claude tarafından koddan DOĞRULANDI. Bağımlılık sırasına göre uygula.
> Her görev sonrası `npx tsc --noEmit` + commit.
> CLAUDE.md sefaRules: cüzdan/puan/üyelik indirimi YASAK (reprint kuponu İZİNLİ — tek seferlik).

---

## BULGU ÖZETİ (doğrulanmış)

| # | Bug | Kök neden | Etki |
|---|-----|-----------|------|
| K1 | KVKK iptali çalışmıyor | `cancel/route.ts` = reprint handler (yanlış dosya); UI body'siz POST → 400 | KVKK uyumluluk |
| K2 | cart_items.meta kolonu yok | `itemToInsert`/`rowToItem` meta taşımıyor | formFactor + çoklu customization kaybı (login) |
| K3 | Çoklu tasarım fiyat uyumsuzluğu | server `quote(tier×designCount)` ≠ client `quote(tier)×designCount×iskonto` | undercharge / meşru sepet reddi |

> K2 + K3 birbirine bağlı: meta kolonu (K2) hem veri kaybını hem K3'ün formFactor/customization recalc'ını çözer. **Önce K2, sonra K3.**

---

## GÖREV K1 — KVKK İptal Route'unu Düzelt

### Sorun (doğrulanmış)
`src/app/api/me/kvkk-requests/[id]/cancel/route.ts` içeriği **reprint-coupon handler** (`POST /api/loyalty/reprint-coupon` yorumu, `sourceOrderId` bekliyor). UI (`ayarlar/verilerim/page.tsx:181`) body'siz POST atıyor → `400 Invalid JSON`. İptal hiç çalışmıyor, sadece optimistik UI gösteriyor.

### Adım 1 — Reprint handler'ı doğru yere taşı
- Reprint kodu meşru (reprint kuponu CLAUDE.md'de izinli kupon türü) ama **yanlış dosyada**.
- Nereden çağrıldığını bul (`grep -rn "reprint-coupon" src`). Eğer `/api/loyalty/reprint-coupon` çağrılıyorsa → `src/app/api/loyalty/reprint-coupon/route.ts` oluştur, içeriği oraya taşı.
- Hiçbir yerden çağrılmıyorsa (dead) → reprint dosyasını sil, kodu koru git history'de.

### Adım 2 — Gerçek KVKK iptal handler'ı yaz
`src/app/api/me/kvkk-requests/[id]/cancel/route.ts`:
```typescript
// POST /api/me/kvkk-requests/[id]/cancel
// Müşteri kendi KVKK talebini grace period içinde iptal eder.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = serviceClient();

  // Talep kullanıcıya ait + iptal edilebilir durumda mı?
  const { data: row } = await admin
    .from("kvkk_requests")
    .select("id, user_id, status, grace_period_until")
    .eq("id", id)
    .maybeSingle();

  if (!row || row.user_id !== user.id)
    return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });

  // Sadece confirmed/pending iptal edilebilir; processing/completed edilemez
  if (!["confirmed", "pending"].includes(row.status))
    return NextResponse.json({ error: "Bu talep artık iptal edilemez" }, { status: 409 });

  // Atomic: sadece hâlâ iptal edilebilir durumdaysa güncelle (TOCTOU önleme)
  const { data: updated, error } = await admin
    .from("kvkk_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["confirmed", "pending"])
    .select("id, status, cancelled_at")
    .maybeSingle();

  if (error || !updated)
    return NextResponse.json({ error: "İptal edilemedi" }, { status: 409 });

  // Audit log
  await logServerAudit(admin, {
    actorId: user.id, actorEmail: user.email ?? null, actorRole: "customer",
    action: "profile.update", targetType: "kvkk_request", targetId: id,
    summary: "KVKK talebi iptal edildi",
  });

  return NextResponse.json({ request: updated });
}
```
- `serviceClient()` ve `logServerAudit` pattern'i `kvkk-requests/route.ts`'ten al.

### Doğrulama
- `/ayarlar/verilerim` → KVKK talebi oluştur → "Vazgeç" → talep gerçekten `cancelled` oluyor (DB'de)
- `processing` durumdaki talep iptal edilemiyor (409)

---

## GÖREV K2 — cart_items.meta Kolonu + Taşıma

### Migration 122
`supabase/migrations/122_cart_items_meta.sql`:
```sql
alter table public.cart_items
  add column if not exists meta jsonb;

comment on column public.cart_items.meta is
  'Konfigüratör meta: formFactor (rulo/tabaka), customizations[], designCount vb.';
```
Prod'a apply et.

### customer-cart.ts
`itemToInsert` — insert objesine meta ekle:
```typescript
// itemToInsert içinde:
return {
  cart_id: cartId,
  product_id: item.productId,
  qty: item.qty,
  unit_price: item.unitPrice,
  customization_id: item.customizationId ?? null,
  meta: item.meta ?? null,   // YENİ
  // ... mevcut alanlar
};
```

`rowToItem` — meta'yı oku:
```typescript
// rowToItem içinde:
return {
  // ... mevcut alanlar
  meta: (row.meta as CustomerCartItem["meta"]) ?? undefined,   // YENİ
};
```

`types.ts` — regenerate veya manuel: `cart_items` Row/Insert/Update'e `meta: Json | null` ekle.

### Doğrulama
- Login kullanıcı: tabaka etiket + Spot UV + Yaldız ekle → sayfa yenile → formFactor + her iki customization korunuyor
- `cart_items` DB'de `meta` dolu

---

## GÖREV K3 — Ödeme Doğrulaması: designCount + İskonto + Çoklu Customization

### Sorun (doğrulanmış)
`payment-validation.ts` `recalcSticker`/`recalcEtiket` yalnızca `qty: item.qty` ile tek bulk quote yapıyor. Konfigüratör ise `perDesignQuote(tier) × designCount × iskonto` hesaplıyor. İkisi eşit değil.

### Çözüm: Aynı fiyat yolunu paylaş
Konfigüratör ve server **aynı** hesaplama mantığını kullanmalı.

#### Adım 1 — Quote fonksiyonlarına designCount + discount + customizations[] ekle
`src/lib/customer-pricing-from-config.ts`:
```typescript
// quoteStickerFromConfig / quoteEtiketFromConfig imzasına ekle:
interface QuoteInput {
  // ... mevcut
  designCount?: number;          // varsayılan 1
  customizationIds?: string[];   // çoklu — tek customizationId yerine
}

// Hesaplama:
// 1. perDesignTotal = quote(tier)  // tek tasarım, bulk tier fiyatı
// 2. customization multiplier = customizationIds'in çarpımı (mevcut multi logic)
// 3. designDiscountFactor = designCount'a göre iskonto (konfigüratördeki aynı tablo)
// 4. total = perDesignTotal × designCount × designDiscountFactor × customizationMult
```
**KRİTİK:** Konfigüratördeki iskonto tablosunu (`designDiscountFactor`) ve çoklu customization çarpanını birebir kopyala — tek kaynak olsun. Mümkünse ortak helper'a çıkar.

#### Adım 2 — payment-validation meta'dan oku
`recalcSticker`/`recalcEtiket`:
```typescript
// item.meta'dan al (K2 ile artık DB'de):
const designCount = item.meta?.designCount ?? 1;
const customizationIds = item.meta?.customizations ?? 
  (item.customizationId ? [item.customizationId] : []);
const formFactor = item.meta?.formFactor ?? inferEtiketFormFactor(item);

const expectedTotal = quoteEtiketFromConfig({
  ...config,
  qty: item.qty / designCount,   // tek tasarım adedi (tier)
  designCount,
  customizationIds,
});
// Karşılaştır: Math.abs(item.total - expectedTotal) <= tolerance
```

#### Adım 3 — Tolerans
Mevcut `max(0.5, expected*0.02)` toleransı kalsın ama artık doğru baz ile.

### Doğrulama
- 3 tasarım × 500 adet sticker, iskontolu → checkout `recalc_total_mismatch` VERMİYOR
- Manipüle edilmiş düşük total → REDDEDILIYOR (undercharge korunuyor)
- Tek tasarım (designCount=1) → eski davranış, regression yok

---

## UYGULAMA SIRASI

1. **K2** — meta kolonu (Mig 122) + taşıma — 30 dk (K3'ün temeli)
2. **K3** — fiyat doğrulama (designCount+iskonto+customization) — 60 dk
3. **K1** — KVKK iptal route — 30 dk (bağımsız)

**Toplam: ~2 saat.** Mig 122 önce DB'ye.

## GENEL KURALLAR
- `npx tsc --noEmit` + commit her görev sonrası
- Önek: `fix(payment):` (K2,K3) · `fix(kvkk):` (K1)
- K3'te konfigüratör fiyat mantığını **birebir** kopyala — sapma para kaybı demek
- Test: hem undercharge (manipülasyon) hem meşru çoklu tasarım sepeti
- CLAUDE.md: reprint kuponu izinli, cüzdan/puan değil

## SONRAKİ BATCH (bu bitince)
Yüksek güvenlik: orders/cancel atomic+refund rollback (H1,H2), admin bypass-checkout validateCartPricing (H3), payment/refund assertPermission (H4), dev mock-checkout prod guard (H5), support ownership (H6), middleware fail-closed (M7). Ayrı prompt gelecek.
