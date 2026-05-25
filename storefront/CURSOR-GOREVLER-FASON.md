# Cursor Üretim Partnerleri İyileştirmeleri — `/admin/fason`

> Claude Code (mimari) tarafından hazırlanmıştır.
> Dosya: `src/app/admin/fason/page.tsx` (874 satır)
> 9 görev: 4 düzeltme + 5 ekleme

---

## DÜZELTMELER (4)

### GÖREV 1/9 — Partner Pause/Resume/Terminate Aksiyonları (P1)

#### Sorun
Partner status görünüyor ama değiştirme butonu yok. Sefa partner'ı durduramıyor.

#### Değişiklik

Mevcut API'ler zaten var:
- `POST /api/admin/fason/partners/[id]/pause`
- `POST /api/admin/fason/partners/[id]/resume`

Partner kartında (PartnerCard component) skor badge'inin yanına aksiyon dropdown ekle:

```typescript
function PartnerActions({ partner, onUpdated }: { partner: FasonPartner; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const action = async (endpoint: string, confirmMsg: string) => {
    if (!confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/fason/partners/${partner.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: '' }),
      });
      if (res.ok) onUpdated();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="w-8 h-8 rounded-lg hover:bg-gri-100 flex items-center justify-center"
        title="İşlemler"
      >
        <Icon.MoreV size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-20 w-48 rounded-lg bg-white shadow-lg ring-1 ring-gri-200 py-1">
          {partner.status !== 'paused' && partner.active && (
            <button
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-gri-50 text-sari-koyu"
              onClick={() => action('pause', `${partner.name} duraklatılsın mı? Yeni atama almaz.`)}
              disabled={busy}
            >
              ◐ Duraklat
            </button>
          )}
          {(partner.status === 'paused' || !partner.active) && (
            <button
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-gri-50 text-yesil"
              onClick={() => action('resume', `${partner.name} tekrar aktif edilsin mi?`)}
              disabled={busy}
            >
              ▶ Devam ettir
            </button>
          )}
          {partner.status !== 'terminated' && (
            <button
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-gri-50 text-kirmizi"
              onClick={() => action('pause', `${partner.name} kalıcı olarak sonlandırılsın mı? Bu işlem geri alınamaz.`)}
              disabled={busy}
            >
              ✕ Sonlandır
            </button>
          )}
          <div className="border-t border-gri-100 my-1" />
          <Link
            href={`/admin/fason/yeni?edit=${partner.id}`}
            className="block px-3 py-2 text-[13px] hover:bg-gri-50 text-lacivert"
            onClick={() => setOpen(false)}
          >
            ✏️ Düzenle
          </Link>
        </div>
      )}
    </div>
  );
}
```

PartnerCard header'ına ekle (skor badge yanına):

```typescript
<PartnerActions partner={partner} onUpdated={onRefresh} />
```

Click outside kapatma:
```typescript
useEffect(() => {
  if (!open) return;
  const close = () => setOpen(false);
  document.addEventListener('click', close);
  return () => document.removeEventListener('click', close);
}, [open]);
```

---

### GÖREV 2/9 — Partner Arama (P1)

#### Değişiklik

Filtre chip'lerinin yanına arama input'u ekle:

```typescript
const [search, setSearch] = useState('');

// Mevcut filtered useMemo'ya arama ekle:
const filtered = useMemo(() => {
  let list = partners;
  if (filter === 'active') list = list.filter(p => p.active);
  if (filter === 'no_contract') list = list.filter(p => !p.contract_signed_at);

  // Arama filtresi
  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.contact_email.toLowerCase().includes(q) ||
      (p.city ?? '').toLowerCase().includes(q) ||
      (p.contact_person ?? '').toLowerCase().includes(q)
    );
  }

  return list;
}, [partners, filter, search]);
```

UI — filtre chip'lerinin sağına:

```typescript
<div className="flex gap-2 flex-wrap mb-4 items-center">
  {/* Mevcut filtre chip'leri */}

  <div className="ml-auto w-full sm:w-auto sm:min-w-[240px] relative">
    <Input
      type="search"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Partner ara (isim/email/şehir)…"
      className="!h-10 !pl-9"
    />
    <Icon.Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gri-500" />
  </div>
</div>
```

---

### GÖREV 3/9 — Performans Skor Kırılımı (P1)

#### Sorun
Sadece `cached_score` görünüyor, neyden oluştuğu belirsiz.

#### Değişiklik

Sağ panel'de (partner seçiliyken) atama geçmişinin ÜSTÜNE skor kırılımı ekle:

```typescript
function PartnerScoreBreakdown({ partner, history }: { partner: FasonPartner; history: AssignmentRow[] }) {
  // Client-side hesaplama — history'den metrikler çıkar
  const metrics = useMemo(() => {
    if (history.length === 0) return null;

    const completed = history.filter(a => a.status === 'completed' || a.actual_delivery);
    const total = history.length;

    // Teslim süresi uyumu
    const onTime = completed.filter(a => {
      if (!a.estimated_delivery || !a.actual_delivery) return false;
      return new Date(a.actual_delivery) <= new Date(a.estimated_delivery);
    }).length;
    const onTimeRate = completed.length > 0 ? Math.round(onTime / completed.length * 100) : null;

    // Red oranı
    const rejected = history.filter(a => a.status === 'rejected' || a.status === 'cancelled').length;
    const rejectRate = total > 0 ? Math.round(rejected / total * 100) : 0;

    // Ortalama teslim süresi
    const deliveryDays = completed
      .filter(a => a.assigned_at && a.actual_delivery)
      .map(a => (new Date(a.actual_delivery!).getTime() - new Date(a.assigned_at).getTime()) / 86400000);
    const avgDays = deliveryDays.length > 0 ? deliveryDays.reduce((s, d) => s + d, 0) / deliveryDays.length : null;

    return { onTimeRate, rejectRate, avgDays, totalOrders: total, completedOrders: completed.length };
  }, [history]);

  if (!metrics) return null;

  return (
    <div className="mb-4 pb-4 border-b border-gri-100">
      <h4 className="text-[12px] font-bold uppercase text-gri-500 mb-3">Performans kırılımı</h4>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-gri-50 p-2.5">
          <div className="text-[10px] text-gri-500">Zamanında teslim</div>
          <div className={cn("text-[16px] font-bold",
            metrics.onTimeRate === null ? "text-gri-400"
            : metrics.onTimeRate >= 80 ? "text-yesil" : "text-kirmizi"
          )}>
            {metrics.onTimeRate !== null ? `%${metrics.onTimeRate}` : '—'}
          </div>
        </div>
        <div className="rounded-lg bg-gri-50 p-2.5">
          <div className="text-[10px] text-gri-500">Red oranı</div>
          <div className={cn("text-[16px] font-bold",
            metrics.rejectRate <= 5 ? "text-yesil" : "text-kirmizi"
          )}>
            %{metrics.rejectRate}
          </div>
        </div>
        <div className="rounded-lg bg-gri-50 p-2.5">
          <div className="text-[10px] text-gri-500">Ort. teslim</div>
          <div className="text-[16px] font-bold text-lacivert">
            {metrics.avgDays !== null ? `${metrics.avgDays.toFixed(1)} gün` : '—'}
          </div>
        </div>
        <div className="rounded-lg bg-gri-50 p-2.5">
          <div className="text-[10px] text-gri-500">Toplam iş</div>
          <div className="text-[16px] font-bold text-lacivert">
            {metrics.totalOrders}
          </div>
        </div>
      </div>
    </div>
  );
}
```

Sağ panel'de, PartnerCapabilitiesPanel'den sonra:

```typescript
{selected && <PartnerScoreBreakdown partner={selected} history={history} />}
```

---

### GÖREV 4/9 — Atama Geçmişi Pagination (P2)

#### Sorun
Sadece 15 satır gösteriliyor (satır 339: `history.slice(0, 15)`).

#### Değişiklik

```typescript
const [historyPage, setHistoryPage] = useState(1);
const HISTORY_PAGE_SIZE = 10;

const pagedHistory = history.slice(0, historyPage * HISTORY_PAGE_SIZE);
const hasMore = history.length > pagedHistory.length;
```

`history.slice(0, 15)` yerine `pagedHistory` kullan.

Liste altına "Daha fazla" butonu:

```typescript
{hasMore && (
  <button
    type="button"
    onClick={() => setHistoryPage(p => p + 1)}
    className="mt-2 w-full text-center text-[12px] font-semibold text-pim-mercan hover:underline py-2"
  >
    Daha fazla göster ({history.length - pagedHistory.length} kalan)
  </button>
)}
```

Partner değiştiğinde sayfa sıfırla:

```typescript
useEffect(() => { setHistoryPage(1); }, [selected]);
```

---

## EKLEMELER (5)

### GÖREV 5/9 — Kapasite Doluluk Göstergesi (P2)

#### Sorun
Partner'ın şu an kaç aktif siparişi var bilgi yok.

#### Değişiklik

API'den gelen partner verisine `active_order_count` ekle.

`/api/admin/fason/partners` endpoint'inde:

```sql
-- Her partner için aktif atama sayısı
LEFT JOIN LATERAL (
  SELECT COUNT(*) as active_count
  FROM order_assignments oa
  WHERE oa.fason_partner_id = fp.id
  AND oa.status IN ('assigned', 'acknowledged', 'in_production')
) ac ON true
```

Veya client-side: history'den `assigned/acknowledged/in_production` status'lu atamaları say.

Partner kartında, teslim süresi satırının yanına:

```typescript
<span>
  📦 Aktif: <strong className="text-lacivert">{partner.active_order_count ?? '?'}</strong> sipariş
</span>
```

---

### GÖREV 6/9 — Partner Sıralama (P2)

#### Değişiklik

Filtre alanına sıralama dropdown ekle:

```typescript
type SortBy = 'score' | 'name' | 'lead_days' | 'active_orders';
const [sortBy, setSortBy] = useState<SortBy>('score');

const sorted = useMemo(() => {
  const list = [...filtered];
  list.sort((a, b) => {
    switch (sortBy) {
      case 'score': return (b.cached_score ?? 0) - (a.cached_score ?? 0);
      case 'name': return a.name.localeCompare(b.name, 'tr');
      case 'lead_days': return a.default_lead_days - b.default_lead_days;
      case 'active_orders': return (b.active_order_count ?? 0) - (a.active_order_count ?? 0);
    }
  });
  return list;
}, [filtered, sortBy]);
```

UI — filtre chip'lerinin altına:

```typescript
<select
  value={sortBy}
  onChange={(e) => setSortBy(e.target.value as SortBy)}
  className="h-9 px-2 text-[12px] border border-gri-200 rounded-lg"
>
  <option value="score">Skor (yüksek → düşük)</option>
  <option value="name">İsim (A-Z)</option>
  <option value="lead_days">Teslim süresi (hızlı → yavaş)</option>
  <option value="active_orders">Aktif sipariş (çok → az)</option>
</select>
```

Partner kartları `filtered` yerine `sorted` üzerinden render.

---

### GÖREV 7/9 — Sözleşme Dosyası İndirme (P2)

#### Sorun
`contract_pdf_url` var ama sayfada link yok.

#### Değişiklik

Sağ panel iletişim bölümünde (satır ~391-404 civarı) sözleşme satırını güncelle:

```typescript
<div>
  📑 Sözleşme:{" "}
  {selected.contract_signed_at ? (
    <>
      <span className="text-yesil font-semibold">
        {new Date(selected.contract_signed_at).toLocaleDateString("tr-TR")}
      </span>
      {selected.contract_pdf_url && (
        <a
          href={selected.contract_pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-pim-mercan font-semibold hover:underline text-[11px]"
        >
          📥 PDF indir
        </a>
      )}
    </>
  ) : (
    <span className="text-kirmizi font-semibold">İmzasız</span>
  )}
</div>
```

---

### GÖREV 8/9 — Partner'a Sipariş Atama Butonu (P2)

#### Sorun
Atama sadece sipariş detay sayfasından yapılıyor. Partner görünümünden atama yok.

#### Değişiklik

Sağ panel'in altına (atama geçmişi altına) "Sipariş ata" bölümü ekle:

```typescript
function AssignOrderToPartner({ partnerId, partnerName }: { partnerId: string; partnerName: string }) {
  const [unassigned, setUnassigned] = useState<Array<{ id: string; customer: string; total: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const loadUnassigned = async () => {
    setLoading(true);
    try {
      // ready_to_ship + proof_approved siparişleri çek
      const res = await fetch('/api/admin/orders/list?status=ready_to_ship,proof_approved&limit=20');
      const data = await res.json();
      setUnassigned((data.orders ?? []).map((o: any) => ({
        id: o.id,
        customer: o.address?.name ?? '—',
        total: o.total,
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadUnassigned(); }, []);

  const assignOrder = async (orderId: string) => {
    if (!confirm(`${orderId} → ${partnerName} atasın mı?`)) return;
    setAssigning(true);
    try {
      const res = await fetch('/api/admin/fason/assign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, partnerId }),
      });
      if (res.ok) {
        setUnassigned(prev => prev.filter(o => o.id !== orderId));
      }
    } finally {
      setAssigning(false);
    }
  };

  if (unassigned.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gri-100">
      <h4 className="text-[12px] font-bold uppercase text-gri-500 mb-2">
        Atanabilecek siparişler ({unassigned.length})
      </h4>
      <ul className="space-y-1.5">
        {unassigned.slice(0, 5).map(o => (
          <li key={o.id} className="flex items-center justify-between text-[12px]">
            <span className="font-mono text-[11px]">{o.id} · {o.customer}</span>
            <button
              onClick={() => void assignOrder(o.id)}
              disabled={assigning}
              className="text-pim-mercan font-semibold hover:underline text-[11px]"
            >
              Ata →
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Sağ panel'de iletişim bilgisi altına:

```typescript
{selected && <AssignOrderToPartner partnerId={selected.id} partnerName={selected.name} />}
```

---

### GÖREV 9/9 — Partner İletişim Log (P3)

#### Sorun
Kim ne zaman partner'a mail gönderdi bilgi yok.

#### Değişiklik

Sağ panel'de iletişim bilgisi altına (veya ayrı collapse bölüm):

```typescript
// mail_outbox'tan partner'a gönderilen mailleri çek
// API: /api/admin/fason/partners/[id]/mail-log

function PartnerMailLog({ partnerId }: { partnerId: string }) {
  const [mails, setMails] = useState<Array<{ template: string; sentAt: string; status: string }>>([]);

  useEffect(() => {
    fetch(`/api/admin/fason/partners/${partnerId}/mail-log?limit=10`)
      .then(r => r.json())
      .then(d => setMails(d.mails ?? []))
      .catch(() => {});
  }, [partnerId]);

  if (mails.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gri-100">
      <h4 className="text-[11px] font-bold uppercase text-gri-500 mb-2">Son iletişim</h4>
      <ul className="space-y-1">
        {mails.map((m, i) => (
          <li key={i} className="text-[11px] text-gri-600 flex justify-between">
            <span>📧 {m.template.replace(/_/g, ' ')}</span>
            <span className="text-gri-400">
              {new Date(m.sentAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

NOT: API endpoint (`/api/admin/fason/partners/[id]/mail-log`) oluşturulmalı:

```typescript
// GET — partner'a gönderilen son 10 mail
// assertPermission("fason", "view")
// SELECT template_key, sent_at, status FROM mail_outbox
// WHERE recipient_id = partnerId OR metadata->>'partner_id' = partnerId
// ORDER BY created_at DESC LIMIT 10
```

---

## Uygulama Sırası

| # | Görev | Süre |
|---|---|---|
| 1 | Pause/resume/terminate aksiyon dropdown | 30 dk |
| 2 | Partner arama | 15 dk |
| 3 | Performans skor kırılımı | 30 dk |
| 4 | Atama geçmişi pagination | 15 dk |
| 5 | Kapasite doluluk göstergesi | 20 dk |
| 6 | Partner sıralama | 15 dk |
| 7 | Sözleşme PDF indirme linki | 5 dk |
| 8 | Partner'a sipariş atama butonu | 30 dk |
| 9 | Partner iletişim log (API + UI) | 30 dk |

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
