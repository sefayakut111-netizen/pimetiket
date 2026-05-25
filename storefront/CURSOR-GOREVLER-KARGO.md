# Cursor Kargo Yönetimi İyileştirmeleri — `/admin/kargo`

> Claude Code (mimari) tarafından hazırlanmıştır.
> Dosya: `src/app/admin/kargo/page.tsx` (647 satır)
> 8 görev: 3 düzeltme + 5 ekleme

---

## DÜZELTMELER (3)

### GÖREV 1/8 — Bulk Poll Sonrası State Yenileme (P1)

#### Sorun
`handleBulkPoll` (satır 233) `window.location.reload()` çağırıyor — tüm filtre/scroll/seçim state'i kayboluyor.

#### Değişiklik

```typescript
// ESKİ (satır 233):
// window.location.reload();

// YENİ:
setSelected(new Set());
// Shipments'ı yeniden fetch et (mevcut useEffect statusFilter/dateRange'e bağlı)
// Trick: state'i zorla tetikle
setStatusFilter(prev => prev); // veya:

// Daha temiz: fetch fonksiyonunu dışarı çıkar, burada çağır
await refreshShipments();
```

`refreshShipments` fonksiyonu — mevcut useEffect içindeki fetch logic'ini fonksiyona çıkar:

```typescript
const refreshShipments = useCallback(async () => {
  setLoading(true);
  const params = new URLSearchParams({
    status: statusFilter,
    dateRange,
    limit: "100",
  });
  if (debounced) params.set("search", debounced);

  try {
    const res = await fetch(`/api/admin/shipments?${params.toString()}`);
    const data = await res.json();
    if (data.error) {
      toast.error(data.error);
      return;
    }
    setShipments(data.shipments ?? []);
    setTotal(data.total ?? 0);
    setSelected(new Set());
  } catch (e) {
    toast.error(`Yükleme hatası: ${(e as Error).message}`);
  } finally {
    setLoading(false);
  }
}, [statusFilter, dateRange, debounced, toast]);

// useEffect'te:
useEffect(() => {
  void refreshShipments();
}, [refreshShipments]);

// handleBulkPoll'da:
await refreshShipments(); // window.location.reload() yerine
```

---

### GÖREV 2/8 — Kargo Etiketi Yazdırma Butonu (P1)

#### Sorun
Operatör kargo etiketi PDF'ini indirmek için sipariş detayına girmek zorunda.

#### Değişiklik

Tablo satırlarında "Detay" butonunun yanına "Etiket" butonu ekle:

```typescript
// Mevcut (satır ~626-631):
// <Link href={`/admin/kargo/${s.order_id}`}>
//   <Button size="sm" variant="secondary">Detay</Button>
// </Link>

// YENİ — yanına:
<td className="px-3 py-3 text-right">
  <div className="flex items-center justify-end gap-2">
    {s.tracking_number && (
      <a
        href={`/api/admin/shipping/label/${s.order_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 h-8 px-2 rounded-lg ring-1 ring-gri-200 bg-white text-[11.5px] font-semibold text-lacivert hover:ring-pim-mercan"
        title="Kargo etiketi PDF indir"
      >
        🏷️ Etiket
      </a>
    )}
    <Link href={`/admin/kargo/${s.order_id}`}>
      <Button size="sm" variant="secondary">Detay</Button>
    </Link>
  </div>
</td>
```

Tracking number yoksa etiket butonu gösterilmez (PDF oluşturulamaz).

---

### GÖREV 3/8 — Sayfalama (P2)

#### Değişiklik

Mevcut 100 limit → client-side pagination:

```typescript
const PAGE_SIZE = 30;
const [page, setPage] = useState(1);

const totalPages = Math.ceil(shipments.length / PAGE_SIZE);
const paged = shipments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
```

Tablo render'da `shipments.map` yerine `paged.map` kullan.

Tablo altına pagination bar ekle (aynı pattern `/admin/siparisler` Görev 4'teki gibi):

```typescript
{totalPages > 1 && (
  <div className="flex items-center justify-between px-4 py-3 border-t border-gri-100">
    <span className="text-[12px] text-gri-500">
      {shipments.length} kargo · Sayfa {page}/{totalPages}
    </span>
    <div className="flex items-center gap-1">
      <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 text-[12px] rounded hover:bg-gri-100 disabled:opacity-30">««</button>
      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 text-[12px] rounded hover:bg-gri-100 disabled:opacity-30">«</button>
      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        const start = Math.max(1, Math.min(page - 2, totalPages - 4));
        const p = start + i;
        if (p > totalPages) return null;
        return (
          <button key={p} onClick={() => setPage(p)}
            className={cn("w-8 h-8 text-[12px] rounded font-semibold",
              p === page ? "bg-lacivert text-white" : "hover:bg-gri-100 text-gri-700"
            )}>
            {p}
          </button>
        );
      })}
      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 text-[12px] rounded hover:bg-gri-100 disabled:opacity-30">»</button>
      <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 text-[12px] rounded hover:bg-gri-100 disabled:opacity-30">»»</button>
    </div>
  </div>
)}
```

Filtre değişince sayfa 1'e dön:

```typescript
useEffect(() => { setPage(1); }, [statusFilter, dateRange, debounced]);
```

---

## EKLEMELER (5)

### GÖREV 4/8 — Tracking Gir Butonu (P2)

#### Sorun
Tracking yoksa listede "—" görünüyor ama tracking girme aksiyonu yok.

#### Değişiklik

Tracking kolonu'nda "—" yerine aksiyon butonu:

```typescript
<td className="px-3 py-3">
  {s.tracking_number ? (
    <code className="rounded bg-gri-100 px-1.5 py-0.5 font-mono text-[11.5px]">
      {s.tracking_number}
    </code>
  ) : (
    <Link
      href={`/admin/siparisler/${s.order_id}#tracking`}
      className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-pim-mercan hover:underline"
    >
      + Tracking gir
    </Link>
  )}
</td>
```

---

### GÖREV 5/8 — Tablo Sıralama (P2)

#### Değişiklik

Aynı pattern — tıklanabilir header:

```typescript
type SortKey = 'date' | 'status' | 'customer' | 'tracking';
type SortDir = 'asc' | 'desc';

const [sortKey, setSortKey] = useState<SortKey>('date');
const [sortDir, setSortDir] = useState<SortDir>('desc');

const toggleSort = (key: SortKey) => {
  if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
  else { setSortKey(key); setSortDir('desc'); }
};

const sorted = useMemo(() => {
  const list = [...shipments];
  list.sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'date':
        cmp = new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
        break;
      case 'status':
        cmp = (a.tracking_status ?? '').localeCompare(b.tracking_status ?? '');
        break;
      case 'customer':
        cmp = (a.customer_name ?? '').localeCompare(b.customer_name ?? '', 'tr');
        break;
      case 'tracking':
        cmp = (a.tracking_number ?? '').localeCompare(b.tracking_number ?? '');
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });
  return list;
}, [shipments, sortKey, sortDir]);
```

`paged` hesabında `shipments` yerine `sorted` kullan.

Header'ları tıklanabilir yap (SortableHeader component — `/admin/siparisler` ile aynı pattern).

---

### GÖREV 6/8 — CSV Export (P2)

#### Değişiklik

Filtre bar'ın sağ üstüne "CSV indir" butonu:

```typescript
<button
  type="button"
  onClick={() => {
    const header = "Sipariş,Müşteri,Email,Şehir,Takip No,Durum,Son Event,Tarih\n";
    const lines = shipments.map(s =>
      `"${s.order_id}","${s.customer_name ?? ''}","${s.customer_email ?? ''}","${s.city ?? ''}","${s.tracking_number ?? ''}","${s.tracking_status ?? ''}","${s.last_event_description ?? ''}","${s.created_at ?? ''}"`
    ).join("\n");
    const blob = new Blob(["﻿" + header + lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kargo-${statusFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }}
  className="text-[12px] font-semibold text-gri-500 hover:text-pim-mercan"
>
  📥 CSV indir ({shipments.length})
</button>
```

---

### GÖREV 7/8 — Tahmini vs Gerçek Teslim Karşılaştırma (P2)

#### Sorun
SLA uyumu takip edilmiyor — tahmini vs gerçek teslim süresi arasındaki fark görünmüyor.

#### Değişiklik

İstatistik bölümüne (ort. teslim süresi kartının yanına) SLA uyum kartı ekle:

```typescript
// Stats API'den gelecek ek veri (veya client-side hesapla):
// delivered kargolar için: estimated_delivery vs actual_delivered_at farkı

<Card className="p-4">
  <div className="text-[11px] text-gri-700">SLA uyumu</div>
  <div className={cn(
    "text-2xl font-bold mt-1",
    stats?.sla_compliance_pct == null ? "text-gri-500"
    : stats.sla_compliance_pct >= 90 ? "text-yesil-koyu"
    : stats.sla_compliance_pct >= 75 ? "text-sari-koyu"
    : "text-kirmizi-koyu"
  )}>
    {stats?.sla_compliance_pct != null ? `%${stats.sla_compliance_pct}` : '—'}
  </div>
  <p className="text-[11px] text-gri-500 mt-1">
    Tahmini süre içinde teslim oranı
  </p>
</Card>
```

Stats API'ye `sla_compliance_pct` ekle:

```sql
-- Tahmini süre içinde teslim olan / toplam teslim × 100
-- estimated_delivery >= delivered_at → on-time
SELECT 
  ROUND(
    COUNT(*) FILTER (WHERE oa.estimated_delivery::date >= oa.delivered_at::date) * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE oa.delivered_at IS NOT NULL), 0)
  ) as sla_compliance_pct
FROM order_assignments oa
WHERE oa.delivered_at IS NOT NULL
AND oa.created_at > NOW() - INTERVAL '30 days';
```

---

### GÖREV 8/8 — Tablo Satırında Teslim Süresi Göster (P3)

#### Değişiklik

Delivered olan kargolarda "Son güncelleme" kolonunun altına teslim süresini göster:

```typescript
// Son event kolonu altına:
{s.tracking_status === 'delivered' && s.created_at && s.last_event_time && (
  <div className="text-[10px] text-yesil-koyu mt-0.5">
    ✅ {Math.ceil((new Date(s.last_event_time).getTime() - new Date(s.created_at).getTime()) / 86400000)} günde teslim
  </div>
)}

// Failed olanlarda:
{s.tracking_status === 'failed' && (
  <div className="text-[10px] text-kirmizi mt-0.5">
    ⚠️ Teslim edilemedi
  </div>
)}
```

---

## Uygulama Sırası

| # | Görev | Süre |
|---|---|---|
| 1 | Bulk poll state yenileme (reload → fetch) | 15 dk |
| 2 | Kargo etiketi yazdırma butonu | 15 dk |
| 3 | Sayfalama | 30 dk |
| 4 | Tracking gir butonu | 10 dk |
| 5 | Tablo sıralama | 30 dk |
| 6 | CSV export | 15 dk |
| 7 | SLA uyum kartı + API | 30 dk |
| 8 | Satırda teslim süresi | 10 dk |

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
