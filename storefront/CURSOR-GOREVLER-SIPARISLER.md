# Cursor Sipariş Yönetimi İyileştirmeleri — `/admin/siparisler`

> Claude Code (mimari) tarafından hazırlanmıştır.
> Dosya: `src/app/admin/siparisler/page.tsx` (786 satır)
> 10 görev: 4 düzeltme + 6 ekleme

---

## DÜZELTMELER (4)

### GÖREV 1/10 — Status Dropdown Geçerli Transition Filtresi (P1)

#### Sorun
Tek satır status dropdown'unda `ALL_STATUSES` (tüm 16 status) gösteriliyor. Sefa `paid` siparişi direkt `delivered` yapabilir — iş akışı bozulur. Bulk tarafta `getCommonBulkTransitionTargets` zaten var, tek satırda yok.

#### Dosya: `src/app/admin/siparisler/page.tsx`

`src/lib/order.ts`'te zaten tanımlı olan `VALID_TRANSITIONS` veya benzeri transition map'i kullan. Yoksa oluştur:

```typescript
// src/lib/order.ts'e ekle (veya mevcut map'i kullan):
export const VALID_SINGLE_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  paid: ['qc_pending', 'awaiting_upload', 'cancelled'],
  awaiting_upload: ['qc_pending', 'cancelled'],
  qc_pending: ['proof_generating', 'human_review', 'cancelled'],
  qc_flagged: ['human_review', 'cancelled'],
  human_review: ['proof_generating', 'human_review_failed', 'cancelled'],
  human_review_failed: ['qc_pending', 'cancelled'],
  proof_generating: ['proof_pending', 'human_review'],
  proof_pending: ['proof_approved', 'cancelled'],
  proof_validating: ['proof_pending'],
  proof_approved: ['ready_to_ship'],
  ready_to_ship: ['in_production', 'fason_assigned'],
  fason_assigned: ['in_production'],
  in_production: ['shipped'],
  shipped: ['delivered'],
  delivered: [],  // terminal
  cancelled: [],  // terminal
};

export function getValidTransitions(currentStatus: OrderStatus): OrderStatus[] {
  return VALID_SINGLE_TRANSITIONS[currentStatus] ?? [];
}
```

Siparişler sayfasındaki tek satır dropdown'u güncelle:

```typescript
// Mevcut (satır ~729-742):
// ALL_STATUSES.map(st => <option>...)

// YENİ:
import { getValidTransitions } from "@/lib/order";

// Dropdown içinde:
const validTargets = getValidTransitions(o.status);

<select
  value={o.status}
  onChange={(e) => handleStatusChange(o.id, e.target.value as AdminStatus)}
  disabled={validTargets.length === 0}
  ...
>
  {/* Mevcut status her zaman gösterilir (seçili) */}
  <option value={o.status}>
    {STATUS_META[o.status].label} (mevcut)
  </option>
  {/* Sadece geçerli geçişler */}
  {validTargets.map((st) => (
    <option key={st} value={st}>
      → {STATUS_META[st].label}
    </option>
  ))}
</select>
```

Terminal status'larda (`delivered`, `cancelled`) dropdown disabled olsun.

#### Doğrulama
- `paid` sipariş → dropdown'da sadece `qc_pending`, `awaiting_upload`, `cancelled`
- `delivered` sipariş → dropdown disabled
- `shipped` → sadece `delivered`
- `npx tsc --noEmit` → 0 hata

---

### GÖREV 2/10 — Tarih Aralığı Filtresi (P1)

#### Sorun
"Geçen haftanın siparişleri" veya "Mayıs ayı" gibi tarih filtresi yok.

#### Değişiklik

Filter card'ın içine (arama input'unun soluna) tarih filtresi ekle:

```typescript
const [dateFrom, setDateFrom] = useState<string>('');
const [dateTo, setDateTo] = useState<string>('');
```

UI — mevcut filtre card'ın içinde, status chip'lerinin altına:

```typescript
<div className="flex items-center gap-3 mt-3 pt-3 border-t border-gri-100">
  <span className="text-[11px] uppercase tracking-[0.04em] text-gri-500 font-semibold">
    Tarih:
  </span>
  <input
    type="date"
    value={dateFrom}
    onChange={(e) => setDateFrom(e.target.value)}
    max={dateTo || undefined}
    className="h-9 px-2 text-[12.5px] border border-gri-200 rounded-lg focus:border-pim-mercan focus:outline-none"
  />
  <span className="text-gri-400 text-[12px]">→</span>
  <input
    type="date"
    value={dateTo}
    onChange={(e) => setDateTo(e.target.value)}
    min={dateFrom || undefined}
    max={new Date().toISOString().slice(0, 10)}
    className="h-9 px-2 text-[12.5px] border border-gri-200 rounded-lg focus:border-pim-mercan focus:outline-none"
  />
  {(dateFrom || dateTo) && (
    <button
      type="button"
      onClick={() => { setDateFrom(''); setDateTo(''); }}
      className="text-[11px] text-pim-mercan font-semibold hover:underline"
    >
      Temizle
    </button>
  )}
</div>
```

Filtre logic'e ekle (mevcut `filtered` useMemo içinde):

```typescript
// Mevcut status + search filtresine EK:
if (dateFrom) {
  const fromTs = new Date(dateFrom).setHours(0, 0, 0, 0);
  base = base.filter(o => o.createdAt >= fromTs);
}
if (dateTo) {
  const toTs = new Date(dateTo).setHours(23, 59, 59, 999);
  base = base.filter(o => o.createdAt <= toTs);
}
```

URL sync'e ekle:

```typescript
if (dateFrom) params.set("from", dateFrom);
if (dateTo) params.set("to", dateTo);
```

Mount'ta URL'den oku:

```typescript
const initialFrom = searchParams.get("from") ?? '';
const initialTo = searchParams.get("to") ?? '';
```

#### Doğrulama
- Tarih seç → liste filtreleniyor
- URL'de `?from=2026-05-20&to=2026-05-25` görünüyor
- Temizle butonu çalışıyor
- `npx tsc --noEmit` → 0 hata

---

### GÖREV 3/10 — Tablo Sıralama (P1)

#### Sorun
Tabloda sıralama yok — API döndüğü sırayla gösteriliyor.

#### Değişiklik

```typescript
type SortKey = 'date' | 'total' | 'customer' | 'status';
type SortDir = 'asc' | 'desc';

const [sortKey, setSortKey] = useState<SortKey>('date');
const [sortDir, setSortDir] = useState<SortDir>('desc');

const toggleSort = (key: SortKey) => {
  if (sortKey === key) {
    setSortDir(d => d === 'asc' ? 'desc' : 'asc');
  } else {
    setSortKey(key);
    setSortDir(key === 'total' ? 'desc' : 'asc');
  }
};
```

`filtered` useMemo'nun SONUNA sıralama ekle:

```typescript
const sorted = useMemo(() => {
  const list = [...filtered];
  list.sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'date': cmp = a.createdAt - b.createdAt; break;
      case 'total': cmp = a.total - b.total; break;
      case 'customer': cmp = a.customer.localeCompare(b.customer, 'tr'); break;
      case 'status': cmp = a.status.localeCompare(b.status); break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });
  return list;
}, [filtered, sortKey, sortDir]);
```

Tablo render'da `filtered` yerine `sorted` kullan.

Tablo header'larını tıklanabilir yap:

```typescript
function SortableHeader({ label, sortField }: { label: string; sortField: SortKey }) {
  const isActive = sortKey === sortField;
  return (
    <th
      className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700 cursor-pointer select-none hover:text-lacivert"
      onClick={() => toggleSort(sortField)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-pim-mercan">
            {sortDir === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </span>
    </th>
  );
}

// Kullanım:
<SortableHeader label="Müşteri" sortField="customer" />
<SortableHeader label="Tutar" sortField="total" />
<SortableHeader label="Durum" sortField="status" />
<SortableHeader label="Tarih" sortField="date" />
```

#### Doğrulama
- "Tutar" tıkla → büyükten küçüğe sıralama
- Tekrar tıkla → küçükten büyüğe
- "Tarih" tıkla → en yeni/en eski
- `npx tsc --noEmit` → 0 hata

---

### GÖREV 4/10 — Sayfalama (Pagination) (P2)

#### Sorun
500 sipariş limiti var, pagination yok. Uzun listede performans sorunu + eski siparişler erişilemez.

#### Değişiklik

Client-side pagination (server-side gelecekte eklenebilir):

```typescript
const PAGE_SIZE = 50;
const [page, setPage] = useState(1);

const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
```

Tablo render'da `sorted` yerine `paged` kullan.

Tablo altına pagination bar ekle:

```typescript
{totalPages > 1 && (
  <div className="flex items-center justify-between px-4 py-3 border-t border-gri-100">
    <span className="text-[12px] text-gri-500">
      {sorted.length} sipariş · Sayfa {page}/{totalPages}
    </span>
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setPage(1)}
        disabled={page === 1}
        className="px-2 py-1 text-[12px] rounded hover:bg-gri-100 disabled:opacity-30"
      >
        ««
      </button>
      <button
        type="button"
        onClick={() => setPage(p => Math.max(1, p - 1))}
        disabled={page === 1}
        className="px-2 py-1 text-[12px] rounded hover:bg-gri-100 disabled:opacity-30"
      >
        «
      </button>

      {/* Sayfa numaraları — max 5 göster */}
      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        const start = Math.max(1, Math.min(page - 2, totalPages - 4));
        const p = start + i;
        if (p > totalPages) return null;
        return (
          <button
            key={p}
            type="button"
            onClick={() => setPage(p)}
            className={cn(
              "w-8 h-8 text-[12px] rounded font-semibold",
              p === page
                ? "bg-lacivert text-white"
                : "hover:bg-gri-100 text-gri-700"
            )}
          >
            {p}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
        disabled={page === totalPages}
        className="px-2 py-1 text-[12px] rounded hover:bg-gri-100 disabled:opacity-30"
      >
        »
      </button>
      <button
        type="button"
        onClick={() => setPage(totalPages)}
        disabled={page === totalPages}
        className="px-2 py-1 text-[12px] rounded hover:bg-gri-100 disabled:opacity-30"
      >
        »»
      </button>
    </div>
  </div>
)}
```

Filtre/arama değiştiğinde sayfa 1'e dön:

```typescript
useEffect(() => { setPage(1); }, [statusFilters, search, dateFrom, dateTo, activeView, sortKey, sortDir]);
```

#### Doğrulama
- 100+ sipariş → sayfa navigasyonu görünüyor
- Sayfa değiştir → doğru satırlar
- Filtre değiştir → sayfa 1'e dönüyor
- `npx tsc --noEmit` → 0 hata

---

## EKLEMELER (6)

### GÖREV 5/10 — KPI Strip (P2)

#### Sorun
Sayfanın üstünde özet sayı yok — "toplam kaç sipariş, kaç ₺, kaç beklemede" bilmek için sayfayı taramak lazım.

#### Değişiklik

Header ile filtre arasına 4 KPI kart ekle:

```typescript
const kpiStats = useMemo(() => {
  const total = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const pending = orders.filter(o =>
    ['paid', 'awaiting_upload', 'qc_pending', 'proof_pending', 'operator_review', 'human_review'].includes(o.status)
  ).length;
  const todayCount = orders.filter(o => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return o.createdAt >= d.getTime();
  }).length;
  return { total, totalRevenue, pending, todayCount };
}, [orders]);
```

UI:

```typescript
<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
  <Card padding="p-3">
    <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">Toplam</div>
    <div className="text-[22px] font-bold text-lacivert tabular-nums mt-1">{kpiStats.total}</div>
  </Card>
  <Card padding="p-3">
    <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">Toplam Ciro</div>
    <div className="text-[22px] font-bold text-lacivert tabular-nums mt-1">{fmt(kpiStats.totalRevenue)} ₺</div>
  </Card>
  <Card padding="p-3">
    <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">Beklemede</div>
    <div className="text-[22px] font-bold text-pim-mercan tabular-nums mt-1">{kpiStats.pending}</div>
  </Card>
  <Card padding="p-3">
    <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">Bugün</div>
    <div className="text-[22px] font-bold text-yesil tabular-nums mt-1">{kpiStats.todayCount}</div>
  </Card>
</div>
```

---

### GÖREV 6/10 — Partner Kolonu (P2)

#### Sorun
Hangi siparişin hangi partner'a atandığı listede görünmüyor.

#### Değişiklik

`AdminOrder` interface'ine `fason` zaten var (satır 53) ama doldurulmuyor.

`/api/admin/orders/list` endpoint'inde order_assignments JOIN ekle:

```typescript
// API'de orders çekerken:
// LEFT JOIN order_assignments oa ON oa.order_id = orders.id AND oa.status != 'cancelled'
// LEFT JOIN fason_partners fp ON fp.id = oa.fason_partner_id
// SELECT ... fp.name as fason_name
```

`toAdminOrderRow` fonksiyonunda:

```typescript
// Mevcut:
// fason?: string  (satır 53, hiç set edilmiyor)

// CustomerOrder'a fason_name eklenmişse:
fason: (o as any).fason_name ?? undefined,
```

Tabloya kolon ekle (`Durum` ile `Tarih` arasına):

```typescript
<th>Partner</th>

// Satırda:
<td className="px-4 py-3 text-[12px] text-gri-700">
  {o.fason ? (
    <span className="inline-flex items-center gap-1">
      🏭 {o.fason}
    </span>
  ) : (
    <span className="text-gri-400">—</span>
  )}
</td>
```

NOT: API değişikliği gerekiyor. Eğer API'de `order_assignments` JOIN yoksa, en basit yol: orders listesi çekildikten sonra ayrı bir `order_assignments` sorgusu ile partner adlarını eşleştirmek.

---

### GÖREV 7/10 — Kargo Tracking Kolonu (P2)

#### Sorun
`shipped` status'taki siparişlerin tracking number'ı listede yok.

#### Değişiklik

API'den tracking bilgisi de geliyorsa (order_assignments.tracking_number):

```typescript
// AdminOrder interface'ine:
tracking_number?: string;

// Tabloda "Tarih" kolonunun yanına veya altına:
{o.status === 'shipped' && o.tracking_number && (
  <div className="text-[10px] text-gri-500 mt-0.5 font-mono">
    📦 {o.tracking_number}
  </div>
)}
```

Eğer API'de tracking yok ise, Görev 6'daki order_assignments JOIN'e `tracking_number` da ekle.

Alternatif (API değişikliği yapmadan): Sadece `shipped` + `delivered` status'larda "Kargo takip" linki göster → `/admin/kargo/${o.id}`

---

### GÖREV 8/10 — Acil Satır Renk Vurgulama (P2)

#### Sorun
Tüm satırlar aynı renk — 36h+ prova bekleyen veya AI flag siparişler fark edilmiyor.

#### Değişiklik

Tablo `<tr>` render'ında mevcut `hover:bg-gri-50` + `isSelected` sınıfına ek olarak acillik kontrolü:

```typescript
const isUrgent = useMemo(() => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return (o: AdminOrder) => {
    // 36h+ prova bekleyen
    if (o.status === 'proof_pending' && now - o.createdAt > 1.5 * day) return 'critical';
    // 24h+ AI/operatör kuyruğunda
    if (['qc_pending', 'qc_flagged', 'human_review', 'operator_review'].includes(o.status) && now - o.createdAt > day) return 'warn';
    // Yüksek tutar
    if (o.total >= 5000) return 'high_value';
    return null;
  };
}, []);

// <tr> className'de:
<tr
  key={o.id}
  className={cn(
    "hover:bg-gri-50",
    isSelected && "bg-pim-mercan-tint/40",
    !isSelected && isUrgent(o) === 'critical' && "bg-kirmizi-soft/20",
    !isSelected && isUrgent(o) === 'warn' && "bg-sari-soft/20",
    !isSelected && isUrgent(o) === 'high_value' && "bg-mavi-soft/10",
  )}
>
```

Sol kenarda ince renk çubuğu (opsiyonel):

```typescript
// İlk <td> (checkbox) öncesine:
<td className="w-1 p-0">
  {isUrgent(o) === 'critical' && <div className="w-1 h-full bg-kirmizi" />}
  {isUrgent(o) === 'warn' && <div className="w-1 h-full bg-sari" />}
</td>
```

---

### GÖREV 9/10 — Toplu İptal Sebep Modal (P2)

#### Sorun
Bulk "İptal" yapılırken sebep sorulmuyor — audit log'da neden iptal edildiği belirsiz.

#### Değişiklik

`applyBulkStatus` fonksiyonunda, `bulkStatus === 'cancelled'` ise modal göster:

```typescript
const [showCancelModal, setShowCancelModal] = useState(false);
const [cancelReason, setCancelReason] = useState('');

const CANCEL_REASONS = [
  { id: 'customer_request', label: 'Müşteri talebi' },
  { id: 'payment_issue', label: 'Ödeme sorunu' },
  { id: 'stock_unavailable', label: 'Malzeme temin edilemedi' },
  { id: 'quality_issue', label: 'Kalite sorunu' },
  { id: 'duplicate', label: 'Mükerrer sipariş' },
  { id: 'other', label: 'Diğer' },
];
```

Bulk "Uygula" butonunda:

```typescript
const handleBulkApply = () => {
  if (bulkStatus === 'cancelled') {
    setShowCancelModal(true); // modal aç, direkt API çağırma
    return;
  }
  applyBulkStatus(); // diğer status'lar direkt
};
```

Modal:

```typescript
{showCancelModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <Card padding="p-6" className="w-full max-w-md">
      <h3 className="text-lg font-semibold text-lacivert mb-4">
        {selected.size} siparişi iptal et
      </h3>
      <p className="text-sm text-gri-700 mb-4">
        İptal sebebini seçin — bu bilgi audit log'a kaydedilir.
      </p>
      <div className="space-y-2 mb-4">
        {CANCEL_REASONS.map(r => (
          <label key={r.id} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="cancelReason"
              value={r.id}
              checked={cancelReason === r.id}
              onChange={() => setCancelReason(r.id)}
              className="accent-pim-mercan"
            />
            <span className="text-sm">{r.label}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={() => { setShowCancelModal(false); setCancelReason(''); }}>
          Vazgeç
        </Button>
        <Button
          variant="primary"
          disabled={!cancelReason}
          onClick={async () => {
            // applyBulkStatus'a reason ekle
            await applyBulkStatusWithReason(cancelReason);
            setShowCancelModal(false);
            setCancelReason('');
          }}
          className="!bg-kirmizi hover:!bg-kirmizi/90"
        >
          İptal et
        </Button>
      </div>
    </Card>
  </div>
)}
```

`POST /api/admin/orders/bulk-status` body'sine `reason` alanını ekle (zaten var — mevcut "Toplu güncelleme" string'i yerine seçilen sebep gönderilir).

---

### GÖREV 10/10 — Tümünü / Filtreli CSV İndir (P3)

#### Sorun
CSV indir sadece seçili siparişler için çalışıyor. Tüm listeyi veya filtreli listeyi indirme yok.

#### Değişiklik

Bulk action bar DIŞINDA, sayfanın sağ üstüne (header'da veya filtre card'ında) küçük "İndir" dropdown:

```typescript
// Header bölümüne (h1 yanına):
<div className="flex items-center gap-2">
  <button
    type="button"
    onClick={() => downloadCsv(sorted, 'tum-siparisler')}
    className="text-[12px] font-semibold text-gri-500 hover:text-pim-mercan"
  >
    📥 Tümünü indir ({sorted.length})
  </button>
  {sorted.length !== orders.length && (
    <button
      type="button"
      onClick={() => downloadCsv(sorted, 'filtreli-siparisler')}
      className="text-[12px] font-semibold text-gri-500 hover:text-pim-mercan"
    >
      📥 Filtreli indir ({sorted.length})
    </button>
  )}
</div>
```

Mevcut CSV logic'i (satır ~580-600) fonksiyona çıkar:

```typescript
function downloadCsv(rows: AdminOrder[], filePrefix: string) {
  const header = "ID,Müşteri,Ürün,Adet,Tutar,Durum,Partner,Tarih\n";
  const lines = rows
    .map(o =>
      `"${o.id}","${o.customer}","${o.product}","${o.qty}","${o.total}","${o.status}","${o.fason ?? ''}","${new Date(o.createdAt).toISOString()}"`
    )
    .join("\n");
  const blob = new Blob(["﻿" + header + lines], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

NOT: `﻿` BOM ekle — Excel'de Türkçe karakterler doğru görünsün.

---

## Uygulama Sırası

| # | Görev | Süre |
|---|---|---|
| 1 | Status dropdown geçerli transition | 30 dk |
| 2 | Tarih aralığı filtresi | 45 dk |
| 3 | Tablo sıralama | 45 dk |
| 4 | Sayfalama (pagination) | 1 saat |
| 5 | KPI strip | 30 dk |
| 6 | Partner kolonu | 30 dk |
| 7 | Kargo tracking kolonu | 20 dk |
| 8 | Acil satır renk vurgulama | 20 dk |
| 9 | Toplu iptal sebep modal | 30 dk |
| 10 | Tümünü/filtreli CSV indir | 20 dk |

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
