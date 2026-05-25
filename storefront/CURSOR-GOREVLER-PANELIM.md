# Cursor Müşteri Paneli İyileştirmeleri — `/panelim`

> Claude Code (mimari) tarafından hazırlanmıştır.
> Dosya: `src/app/panelim/page.tsx` (946 satır)
> 10 görev: 4 düzeltme + 6 ekleme
> Bakış açısı: MÜŞTERİ — "siparişim ne durumda, ne yapmam lazım?"

---

## DÜZELTMELER (4)

### GÖREV 1/10 — statusToPhaseIndex Tüm 16 Status (P1 Bug)

#### Sorun
`statusToPhaseIndex()` (satır 183-205) sadece 8 status tanıyor. `awaiting_upload`, `human_review`, `human_review_failed`, `proof_generating`, `proof_validating`, `ready_to_ship`, `fason_assigned` → hepsi `default: return 0` (ilk faz). Timeline yanlış gösteriyor.

#### Fix

```typescript
function statusToPhaseIndex(status: OrderStatus): number {
  switch (status) {
    case "paid":                return 1;  // Ödendi
    case "awaiting_upload":     return 2;  // Tasarım bekleniyor
    case "qc_pending":          return 3;  // AI kontrol
    case "qc_flagged":          return 3;  // AI flag
    case "human_review":        return 3;  // İnsan inceleme
    case "human_review_failed": return 3;  // Düzeltme bekliyor
    case "operator_review":     return 3;  // Operatör inceleme
    case "proof_generating":    return 4;  // Prova hazırlanıyor
    case "proof_validating":    return 4;  // Düzenleme doğrulanıyor
    case "proof_pending":       return 4;  // Onay bekliyor
    case "proof_approved":      return 5;  // Onaylandı
    case "ready_to_ship":       return 5;  // Üretime hazır
    case "fason_assigned":      return 5;  // Partnere atandı
    case "in_production":       return 5;  // Üretimde
    case "shipped":             return 6;  // Kargoda
    case "delivered":           return 7;  // Teslim
    case "cancelled":           return -1; // İptal
    default:                    return 0;
  }
}
```

---

### GÖREV 2/10 — Aksiyon Odaklı Sipariş Kartları (P1)

#### Sorun
Kartlar pasif — sadece status gösteriyor, müşteri ne yapacağını bilmiyor.

#### Değişiklik

Her sipariş kartının alt kısmına, status'a göre aksiyon CTA ekle. Mevcut "Detay" butonunun ALTINA veya YANINA:

```typescript
// Sipariş kartı render'ında (satır ~585-689 civarı), Button "Detay" altına:

function OrderActionCta({ order, c }: { order: CustomerOrder; c: typeof COPY.tr }) {
  switch (order.status) {
    case 'awaiting_upload':
      return (
        <Button variant="primary" size="sm" href={`/siparis/${order.id}/tasarim-yukle`} className="w-full mt-2">
          📁 Tasarım yükle
        </Button>
      );

    case 'proof_pending':
    case 'proof_validating':
      return (
        <Button variant="primary" size="sm" href={`/onay/${order.id}`} className="w-full mt-2">
          ✋ Provayı incele ve onayla
        </Button>
      );

    case 'shipped': {
      // Tracking number varsa göster
      const tracking = (order as any).tracking_number;
      return (
        <div className="mt-2 space-y-1.5">
          {tracking && (
            <div className="text-[12px] text-gri-700 font-mono bg-gri-50 rounded px-2 py-1">
              📦 Takip no: {tracking}
            </div>
          )}
          <Button variant="secondary" size="sm" href={`/siparis/${order.id}`} className="w-full">
            Kargo takip et →
          </Button>
        </div>
      );
    }

    case 'delivered':
      return (
        <div className="flex gap-2 mt-2">
          <Button variant="secondary" size="sm" href={`/yorum-yaz/${order.id}`} className="flex-1">
            ⭐ Yorum yaz
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleQuickReorder(order)}
            disabled={reordering}
            className="flex-1"
          >
            🔄 Tekrarla
          </Button>
        </div>
      );

    case 'qc_pending':
    case 'human_review':
    case 'proof_generating':
      return (
        <div className="mt-2 flex items-center gap-2 text-[12px] text-gri-500">
          <span className="w-3 h-3 rounded-full bg-sari animate-pulse shrink-0" />
          İnceleniyor — birkaç dakika içinde sonuç çıkacak
        </div>
      );

    case 'human_review_failed':
      return (
        <Button variant="primary" size="sm" href={`/siparis/${order.id}/tasarim-yukle`} className="w-full mt-2 !bg-pim-mercan">
          ⚠️ Tasarımını düzelt ve tekrar yükle
        </Button>
      );

    case 'in_production':
      return (
        <div className="mt-2 text-[12px] text-gri-500">
          🏭 Üretimde — tahmini {order.estimatedDelivery
            ? new Date(order.estimatedDelivery).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
            : 'birkaç gün içinde'} kargoda
        </div>
      );

    case 'cancelled':
      return (
        <div className="mt-2 text-[12px] text-kirmizi">
          İptal edildi {order.total > 0 ? '— iade işlemi başlatıldı' : ''}
        </div>
      );

    default:
      return null;
  }
}
```

Kart render'ında "Detay" butonunun altına:

```typescript
<OrderActionCta order={o} c={c} />
```

`handleQuickReorder` ve `reordering` state'ini `OrderActionCta`'ya prop olarak geçir veya component'i inline yaz.

---

### GÖREV 3/10 — Sipariş Tutarı Göster (P1)

#### Sorun
Kart sadece ürün adı + adet gösteriyor, ₺ yok.

#### Değişiklik

Sipariş kartında adet satırının yanına tutar ekle (satır ~623-625 civarı):

```typescript
// ESKİ:
<div className="text-[13px] text-gri-700 tabular-nums">
  {fmt(totalQty)} {c.pcs} · {matSummary}
</div>

// YENİ:
<div className="text-[13px] text-gri-700 tabular-nums">
  {fmt(totalQty)} {c.pcs} · {matSummary} · <strong className="text-lacivert">{fmt(o.total)} ₺</strong>
</div>
```

---

### GÖREV 4/10 — QuickAction Kartları Geri Getir (P1)

#### Sorun
QuickAction component tanımlı (satır 882-945) ama kullanılmıyor. "Yeni etiket / sticker / tekrar sipariş" kaldırılmış (satır 527 yorum).

#### Değişiklik

Aktif siparişler section'ının ÜSTÜNE 3 QuickAction kartı geri getir:

```typescript
{/* QUICK ACTIONS — hero altına, aktif siparişler üstüne */}
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
  <QuickAction
    icon={<Icon.Roll size={20} />}
    title={c.qaNewEtiket}
    desc={c.qaNewEtiketDesc}
    href="/etiket"
    primary
  />
  <QuickAction
    icon={<Icon.Sticker size={20} />}
    title={c.qaNewSticker}
    desc={c.qaNewStickerDesc}
    href="/sticker"
  />
  {lastReorderTarget ? (
    <QuickAction
      icon={<Icon.Refresh size={20} />}
      title={c.qaReorder}
      desc={
        lastEtiketItem
          ? c.qaReorderEtiket(`${fmt(lastEtiketQty)} ad`)
          : lastStickerItem
            ? c.qaReorderSticker(lastStickerItem.title)
            : c.qaReorderSoon
      }
      onClick={() => void handleQuickReorder(lastReorderTarget)}
      disabled={reordering}
    />
  ) : (
    <QuickAction
      icon={<Icon.Refresh size={20} />}
      title={c.qaReorder}
      desc={c.qaReorderSoon}
      href="/siparislerim"
    />
  )}
</div>
```

---

## EKLEMELER (6)

### GÖREV 5/10 — Eksik Profil Linkleri (P2)

#### Sorun
4 link var ama tasarımlar, iadeler, destek, bildirim eksik.

#### Değişiklik

`PROFILE_LINKS` array'ini genişlet (satır 403-408):

```typescript
const PROFILE_LINKS = [
  { ...c.profileSettings, href: "/profil" },
  { ...c.addressBook, href: "/adreslerim" },
  { ...c.invoiceInfo, href: "/fatura-bilgileri" },
  // YENİ:
  {
    t: locale === 'en' ? 'My designs' : 'Tasarımlarım',
    d: locale === 'en' ? 'Uploaded design files' : 'Yüklenen tasarım dosyaları',
    href: '/tasarimlarim',
  },
  {
    t: locale === 'en' ? 'My returns' : 'İadelerim',
    d: locale === 'en' ? 'Return requests & status' : 'İade taleplerim ve durumu',
    href: '/iadelerim',
  },
  {
    t: locale === 'en' ? 'Support' : 'Destek',
    d: locale === 'en' ? 'Create a support ticket' : 'Destek talebi oluştur',
    href: '/destek',
  },
  {
    t: locale === 'en' ? 'Notifications' : 'Bildirim tercihleri',
    d: locale === 'en' ? 'Email & SMS preferences' : 'E-posta ve SMS ayarları',
    href: '/bildirim-tercihleri',
  },
  { ...c.helpCenter, href: "/sss" },
];
```

---

### GÖREV 6/10 — Toplam Harcama Stat Kartı (P2)

#### Değişiklik

Mevcut 2 stat kartının yanına 3. kart ekle (grid 2 kolon → 3 kolon):

```typescript
// Hesaplama:
const thisYearTotalSpent = orders
  .filter((o) => {
    try { return new Date(o.createdAtIso).getFullYear() === thisYear; } catch { return false; }
  })
  .filter((o) => o.status !== 'cancelled')
  .reduce((sum, o) => sum + (typeof o.total === 'number' ? o.total : 0), 0);

const totalOrderCount = orders.filter(o => o.status !== 'cancelled').length;
```

Grid'i 3 kolona çevir:

```typescript
// ESKİ: <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-7 max-w-[520px]">
// YENİ:
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-7 max-w-[780px]">
  <Stat
    label={c.statActive}
    value={hydrated ? activeCount.toString() : "—"}
    sub={...}
    icon={<Icon.Box size={18} />}
    accent="text-pim-mercan"
  />
  <Stat
    label={c.statPrintedYear(thisYear)}
    value={hydrated ? fmt(thisYearTotalQty) : "—"}
    sub={c.statPrintedSub}
    icon={<Icon.Sparkle size={18} />}
    accent="text-turuncu"
  />
  {/* YENİ */}
  <Stat
    label={locale === 'en' ? `Spent in ${thisYear}` : `${thisYear} harcama`}
    value={hydrated ? `${fmt(thisYearTotalSpent)} ₺` : "—"}
    sub={locale === 'en' ? `${totalOrderCount} orders total` : `${totalOrderCount} sipariş toplamı`}
    icon={<Icon.Wallet size={18} />}
    accent="text-yesil"
  />
</div>
```

---

### GÖREV 7/10 — Son Teslim Edilen Sipariş + Yorum CTA (P2)

#### Sorun
Aktif siparişler gösteriliyor ama teslim edilenler panelde yok. Yorum yazma teşviki yok.

#### Değişiklik

Aktif siparişler section'ının ALTINA, profil kısayollarının ÜSTÜNE:

```typescript
{/* SON TESLİM EDİLEN — yorum yazma + tekrar sipariş teşviki */}
{(() => {
  const recentDelivered = orders
    .filter(o => o.status === 'delivered')
    .slice(0, 2);

  if (recentDelivered.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="text-[18px] font-semibold tracking-tight mb-3">
        {locale === 'en' ? 'Recently delivered' : 'Son teslim edilenler'}
      </h2>
      <div className="space-y-2">
        {recentDelivered.map(o => {
          const title = o.items.length === 1
            ? o.items[0].title
            : `${o.items.length} ürün`;
          return (
            <Card key={o.id} padding="p-4" className="!bg-yesil-soft/20">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px] truncate">{title}</div>
                  <div className="text-[12px] text-gri-700">
                    {fmt(o.total)} ₺ · Teslim edildi ✓
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="secondary" size="sm" href={`/yorum-yaz/${o.id}`}>
                    ⭐ Yorum yaz
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleQuickReorder(o)}
                    disabled={reordering}
                  >
                    🔄
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
})()}
```

---

### GÖREV 8/10 — Bildirim Mini Listesi (P2)

#### Sorun
Panelde hiç bildirim yok — QC sonucu, kargo güncelleme, prova hatırlatma hepsi mail kutusunda kalıyor.

#### Değişiklik

Sağ panelde kupon kartının ÜSTÜNE bildirim kartı ekle:

```typescript
{/* BİLDİRİMLER */}
<NotificationsMini orderId={orders[0]?.id} />
```

Yeni component: `src/components/customer/NotificationsMini.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";

interface Notification {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  read: boolean;
  href?: string;
}

const EVENT_ICON: Record<string, string> = {
  paid: '🟢',
  design_uploaded: '📁',
  qc_passed: '✅',
  qc_flagged: '⚠️',
  proof_ready: '🎨',
  proof_approved: '✅',
  shipped: '📦',
  delivered: '🎉',
  refund: '💸',
};

export function NotificationsMini() {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    // order_events'ten son 5 event çek
    fetch('/api/customer/notifications?limit=5', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setItems(d.items ?? []))
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <Card padding="p-4">
      <h3 className="font-semibold text-[14px] mb-3">Son bildirimler</h3>
      <div className="space-y-2">
        {items.map(n => (
          <div key={n.id} className="flex items-start gap-2 text-[12px]">
            <span className="shrink-0 mt-0.5">
              {EVENT_ICON[n.type] ?? '📋'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-gri-700 leading-snug">{n.message}</div>
              <div className="text-[10.5px] text-gri-400 mt-0.5">
                {new Date(n.createdAt).toLocaleDateString('tr-TR', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  timeZone: 'Europe/Istanbul',
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

#### Yeni API: `src/app/api/customer/notifications/route.ts`

```typescript
// GET — müşterinin son N bildirimi
// Auth: müşteri kendi event'lerini görebilir
// Kaynak: order_events WHERE actor_role='system' AND order.user_id = auth.uid()
// + Dönüşüm: event_type → human readable message
// Response: { items: [{ id, type, message, createdAt, href }] }

// Event type → mesaj dönüşümü:
const EVENT_MESSAGES: Record<string, (orderId: string) => string> = {
  paid: (id) => `Sipariş #${id.slice(-6)} ödemen alındı`,
  design_uploaded: (id) => `#${id.slice(-6)} tasarımın yüklendi`,
  qc_approved: (id) => `#${id.slice(-6)} AI kontrolden geçti ✓`,
  qc_rejected: (id) => `#${id.slice(-6)} tasarımında düzeltme gerekli`,
  proof_ready: (id) => `#${id.slice(-6)} provan hazır — onayla`,
  proof_approved: (id) => `#${id.slice(-6)} provayı onayladın — üretime geçildi`,
  shipped: (id) => `#${id.slice(-6)} kargoya verildi 📦`,
  delivered: (id) => `#${id.slice(-6)} teslim edildi ✓`,
  auto_refund_stale_proof: (id) => `#${id.slice(-6)} 36sa onay verilmedi — otomatik iade`,
};
```

---

### GÖREV 9/10 — Kargo Takip Bilgisi (P2)

#### Sorun
Shipped sipariş kartında tracking number ve kargo bilgisi yok.

#### Değişiklik

Bu bilgi `order_assignments` tablosundan gelir. Mevcut `CustomerOrder` type'ında `tracking_number` alanı olmayabilir.

**Basit yaklaşım:** Sipariş kartında "Kargoda" status'tayken sipariş detay sayfasına yönlendir — orada tracking bilgisi zaten var.

Görev 2'deki `OrderActionCta` component'inde `shipped` case zaten handling yapıyor:

```typescript
case 'shipped':
  return (
    <Button variant="secondary" size="sm" href={`/siparis/${order.id}`} className="w-full mt-2">
      📦 Kargo takip et →
    </Button>
  );
```

**Gelişmiş yaklaşım** (API değişikliği gerekirse): `refreshCustomerOrders` fonksiyonunda `order_assignments` JOIN ekle → `tracking_number` ve `tracking_status` çek → kart'ta göster.

Şimdilik basit yaklaşım yeterli — sipariş detay sayfası tracking bilgisini gösteriyor.

---

### GÖREV 10/10 — Dead Code Temizlik (P3)

#### Değişiklik

QuickAction component'i Görev 4'te kullanıma alındı → dead code DEĞİL artık. Ama kontrol et:

1. `QuickAction` component (satır 882-945) → Görev 4'te aktif edildi → **KORU**
2. Satır 527 yorumundaki "Yeni etiket / sticker / tekrar sipariş kaldırıldı" notu → **GÜNCELLE**: "Görev 4 ile geri getirildi"
3. Satır 694-695'teki "upsell kartı kaldırıldı" yorumu → **KORU** (upsell geri getirilmedi)

Ek temizlik:
- `COPY` objesinde kullanılmayan key'ler varsa kaldır
- `import` listesinde kullanılmayan import varsa kaldır
- `eslint-disable` yorumları gereksizse kaldır

---

## Uygulama Sırası

| # | Görev | Süre |
|---|---|---|
| 1 | statusToPhaseIndex 16 status fix | 10 dk |
| 2 | Aksiyon odaklı sipariş kartları (her status CTA) | 30 dk |
| 3 | Sipariş tutarı göster | 5 dk |
| 4 | QuickAction kartları geri getir | 15 dk |
| 5 | Eksik profil linkleri (tasarımlar, iadeler, destek, bildirim) | 10 dk |
| 6 | Toplam harcama stat kartı | 15 dk |
| 7 | Son teslim edilen + yorum CTA | 20 dk |
| 8 | Bildirim mini listesi (component + API) | 35 dk |
| 9 | Kargo takip bilgisi | 10 dk |
| 10 | Dead code temizlik | 10 dk |

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
