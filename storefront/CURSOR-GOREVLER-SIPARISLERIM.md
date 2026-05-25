# Cursor — /siparislerim Sayfa İyileştirmeleri

> Claude Code (mimari) tarafından hazırlanmıştır · 26 May 2026
> Dosya: `src/app/siparislerim/page.tsx` (423 satır)
> Tasarım önizleme eklendi (Claude tarafından), 7 ek iyileştirme.

---

## ZATEN YAPILDI (Claude)

- [x] Sipariş kartlarına tasarım thumbnail eklendi (56×56 rounded, fallback ikon)

---

## GÖREV 1/7 — Status'a Göre Aksiyon CTA Ekle

### Sorun
Panelim'de `OrderActionCta` var (Tasarım yükle / Provayı onayla / Kargo takip et) ama siparislerim'de sadece "Detay" butonu var. Kullanıcı hangi siparişte ne yapacağını bilmiyor.

### Fix
Her kart için status'a göre ikinci CTA ekle:

```typescript
// Detay butonunun yanına:
{o.status === "awaiting_upload" && (
  <Button variant="primary" size="sm" href={`/siparis/${o.id}/tasarim-yukle`} className="!bg-pim-mercan">
    Tasarım yükle
  </Button>
)}
{(o.status === "proof_pending" || o.status === "proof_validating") && (
  <Button variant="primary" size="sm" href={`/onay/${o.id}`}>
    Provayı onayla
  </Button>
)}
{o.status === "human_review_failed" && (
  <Button variant="primary" size="sm" href={`/siparis/${o.id}/tasarim-yukle`} className="!bg-pim-mercan">
    Tasarımı düzelt
  </Button>
)}
```

Mevcut `delivered` → "Tekrar sipariş" butonu kalabilir.

---

## GÖREV 2/7 — Pagination (10 sipariş/sayfa)

### Sorun
Tüm siparişler tek seferde render ediliyor. 50+ siparişte sayfa kasabilir.

### Fix

```typescript
const ORDERS_PER_PAGE = 10;
const [page, setPage] = useState(1);
const paged = filtered.slice(0, page * ORDERS_PER_PAGE);
const hasMore = filtered.length > paged.length;

// Liste sonuna:
{hasMore && (
  <Button
    variant="secondary"
    size="sm"
    onClick={() => setPage((p) => p + 1)}
    className="w-full mt-3"
  >
    Daha fazla göster ({filtered.length - paged.length} kaldı)
  </Button>
)}
```

---

## GÖREV 3/7 — Mini Progress Timeline

### Sorun
Panelim'de her sipariş kartında mini timeline dots var (8 nokta, aktif fase vurgulanıyor). Siparislerim'de sadece status rozeti var — kullanıcı siparişin kaçıncı aşamada olduğunu göremez.

### Fix
Panelim'deki `statusToPhaseIndex` + mini timeline kodunu buraya da ekle (satır 898-941 panelim/page.tsx). Veya shared component oluştur.

```typescript
// Kart content'inin altına (status rozetinin altı):
<div className="flex items-center gap-0.5 mt-2">
  {phases.map((_, i) => (
    <span
      key={i}
      className={cn(
        "w-1.5 h-1.5 rounded-full",
        i < phase ? "bg-yesil" : i === phase ? s.color.replace("text-", "bg-") : "bg-gri-200"
      )}
    />
  ))}
</div>
```

---

## GÖREV 4/7 — "Tekrar sipariş" Gerçek Reorder Akışı

### Sorun (satır 362-365)
"Tekrar sipariş" butonu `/etiket`'e yönlendiriyor — siparişin konfigürasyonunu taşımıyor. Kullanıcı sıfırdan başlıyor.

### Fix
`reorderFromOrder` fonksiyonu zaten var (`src/lib/customer-reorder.ts`). Buton tıklandığında:

```typescript
import { reorderFromOrder } from "@/lib/customer-reorder";

// Butonda:
onClick={() => void reorderFromOrder(o.id)}
```

---

## GÖREV 5/7 — Sıralama Seçeneği

### Sorun
Sadece filtre + search var. Tarihe veya tutara göre sıralama yok.

### Fix
Filter bar'ın sağına dropdown ekle:

```typescript
const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "total_desc">("date_desc");

// filtered sonrası sort:
const sorted = [...filtered].sort((a, b) => {
  if (sortBy === "date_asc") return new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime();
  if (sortBy === "total_desc") return b.total - a.total;
  return 0; // date_desc default (DB'den zaten böyle geliyor)
});
```

NOT: `dateIso` field'ı Order interface'ine eklenmeli.

---

## GÖREV 6/7 — Filtre Sayacı (Badge)

### Sorun
Filtre butonlarında o kategoride kaç sipariş olduğu görünmüyor.

### Fix

```typescript
// Her filtre butonunun yanına count badge:
const countByGroup = useMemo(() => {
  const map: Record<string, number> = {};
  for (const o of orders) {
    const g = getCustomerStatusInfo(o.status).group;
    map[g] = (map[g] ?? 0) + 1;
  }
  return map;
}, [orders]);

// Buton içinde:
<span className="ml-1 text-[10px] opacity-60">
  ({countByGroup[f.id] ?? 0})
</span>
```

---

## GÖREV 7/7 — Boş State CTA İyileştirmesi

### Sorun (satır 277-291)
Boş state'te sadece "Etiket bastır" ve "Sticker bastır" butonları var. Yeni kullanıcı için yeterli değil.

### Fix
Pim mesajı ekle:

```typescript
// Pim ikonunun altına:
<p className="text-sm text-gri-500 mt-2">
  İlk siparişinde %10 hoş geldin indirimi otomatik uygulanır.
</p>
```

NOT: Bu sadece kupon sistemi aktifse yapılmalı. Yoksa atlayın.

---

## UYGULAMA SIRASI

| # | Görev | Süre |
|---|-------|------|
| 1 | Status CTA | 10 dk |
| 2 | Pagination | 5 dk |
| 3 | Mini timeline | 15 dk |
| 4 | Gerçek reorder | 5 dk |
| 5 | Sıralama | 10 dk |
| 6 | Filtre badge | 5 dk |
| 7 | Boş state CTA | 3 dk |

Her görev sonrası: `npx tsc --noEmit` + commit (`feat(siparislerim):` prefix)

---

*Hazırlayan: Claude Code (mimari) · 26 May 2026*
