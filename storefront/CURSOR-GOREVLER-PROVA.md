# Cursor Prova Kuyruğu İyileştirmeleri — `/admin/prova`

> Claude Code (mimari) tarafından hazırlanmıştır.
> Dosya: `src/app/admin/prova/page.tsx` (396 satır)
> 9 görev: 4 düzeltme + 5 ekleme

---

## DÜZELTMELER (4)

### GÖREV 1/9 — Hatırlatma Gerçek Mail Gönderimi (P1)

#### Sorun
`handleReminder` sadece toast gösteriyor (satır 185-187). Müşteriye gerçek hatırlatma gitmiyor.

#### Değişiklik

```typescript
const handleReminder = async (order: CustomerOrder) => {
  try {
    // mail_outbox'a INSERT — process-mail-outbox cron gönderecek
    const res = await fetch(`/api/admin/orders/${order.id}/remind-proof`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channel: "email", // gelecekte: "whatsapp" | "sms"
      }),
    });

    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(`Hatırlatma gönderilemedi: ${j.error ?? res.status}`);
      return;
    }

    toast.success(`${order.id} müşterisine prova hatırlatma maili gönderildi`);
  } catch {
    toast.error("Hatırlatma gönderilemedi (ağ hatası)");
  }
};
```

#### Yeni API: `src/app/api/admin/orders/[id]/remind-proof/route.ts`

```typescript
// POST — müşteriye prova hatırlatma maili gönder
// assertPermission("proof", "update")
// 1. Sipariş proof_pending mi kontrol et
// 2. Son 24 saatte hatırlatma gönderilmiş mi? (idempotency — spam önle)
//    SELECT FROM order_events WHERE order_id=X AND event_type='proof_reminder_sent'
//    AND created_at > NOW() - INTERVAL '24 hours'
//    Varsa → 429 "24 saat içinde zaten gönderildi"
// 3. mail_outbox INSERT (template: proof_reminder)
// 4. order_events INSERT (event_type: proof_reminder_sent, actor: admin)
// Response: { ok: true, sent: true }
```

#### Doğrulama
- "Hatırlat" tıkla → gerçek mail gönderildi toast
- 24 saat içinde tekrar tıkla → "zaten gönderildi" uyarı
- `npx tsc --noEmit` → 0 hata

---

### GÖREV 2/9 — Tüm Proof Statuslarını Göster (P1)

#### Sorun
Sadece `proof_pending` filtreleniyor. `proof_generating`, `proof_validating`, `proof_approved` görünmüyor.

#### Değişiklik

Mevcut filtre (satır 118):
```typescript
// ESKİ:
setItems(all.filter((o) => o.status === "proof_pending"));

// YENİ — tüm proof ilgili statuslar:
const PROOF_STATUSES = [
  'proof_generating',
  'proof_validating',
  'proof_pending',
  'proof_approved',
] as const;

setItems(all.filter((o) => (PROOF_STATUSES as readonly string[]).includes(o.status)));
```

Her kart'taki status badge'ini güncelle — sadece "Onay bekliyor" değil, gerçek status göster:

```typescript
const PROOF_STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  proof_generating: { label: 'Hazırlanıyor', bg: 'bg-gri-100', color: 'text-lacivert' },
  proof_validating: { label: 'Doğrulanıyor', bg: 'bg-gri-100', color: 'text-lacivert' },
  proof_pending: { label: 'Onay bekliyor', bg: 'bg-sari-soft', color: 'text-sari-koyu' },
  proof_approved: { label: 'Onaylandı ✓', bg: 'bg-yesil-soft', color: 'text-yesil-koyu' },
};
```

Butonları status'a göre koşullu göster:
- `proof_generating` / `proof_validating` → buton yok (sistem işliyor)
- `proof_pending` → Üretime al / Hatırlat / İptal (mevcut)
- `proof_approved` → Sadece "Üretime al" (müşteri zaten onaylamış)

---

### GÖREV 3/9 — SLA Countdown Göster (P1)

#### Sorun
36 saat deadline'a ne kadar kaldığı görünmüyor. Tüm kartlar aynı aciliyette görünüyor.

#### Değişiklik

Her kart'a SLA countdown ekle:

```typescript
function ProofSlaTag({ createdAt, status }: { createdAt: number; status: string }) {
  if (status !== 'proof_pending') return null;

  const elapsedMs = Date.now() - createdAt;
  const elapsedHours = elapsedMs / 3600000;
  const remainingHours = 36 - elapsedHours;

  if (remainingHours <= 0) {
    return (
      <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-kirmizi text-white text-[11px] font-bold animate-pulse">
        ⏰ SLA AŞILDI — otomatik iade tetiklenecek
      </span>
    );
  }

  if (remainingHours <= 6) {
    return (
      <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-kirmizi-soft text-kirmizi-koyu text-[11px] font-bold">
        🔴 {Math.floor(remainingHours)} sa kaldı
      </span>
    );
  }

  if (remainingHours <= 12) {
    return (
      <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-sari-soft text-sari-koyu text-[11px] font-bold">
        ⏰ {Math.floor(remainingHours)} sa kaldı
      </span>
    );
  }

  return (
    <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-gri-100 text-gri-700 text-[11px] font-semibold">
      ⏳ {Math.floor(remainingHours)} sa kaldı
    </span>
  );
}
```

Kart header'daki status badge'nin yanına ekle:

```typescript
<div className="flex items-center gap-2.5 mb-2 flex-wrap">
  <span className="font-mono text-[12.5px] text-gri-700">{p.id}</span>
  <span className={cn("inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold", meta.bg, meta.color)}>
    {meta.label}
  </span>
  <ProofSlaTag createdAt={p.createdAt} status={p.status} />
</div>
```

---

### GÖREV 4/9 — Bıçak + Beyaz Katman Status Rozeti (P2)

#### Sorun
Her item'da bıçak çizildi mi, beyaz katman üretildi mi bilgi yok.

#### Değişiklik

Tasarım thumbnail strip'inin altına mini status ikonları ekle.

Bu bilgi `cutline_designs` ve `proof_validations` tablolarından gelir. API'de ek sorgu gerekli.

Kısa vadede **basit yaklaşım** — status'a göre tahmini göster:

```typescript
function ProofReadinessIndicator({ status }: { status: string }) {
  const steps = [
    {
      label: 'Bıçak',
      done: ['proof_pending', 'proof_approved', 'proof_validating'].includes(status),
      icon: '✂️',
    },
    {
      label: 'Beyaz',
      done: ['proof_pending', 'proof_approved', 'proof_validating'].includes(status),
      icon: '⬜',
    },
    {
      label: 'Doğrulama',
      done: ['proof_pending', 'proof_approved'].includes(status),
      icon: '🤖',
    },
  ];

  return (
    <div className="flex items-center gap-3 mt-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1 text-[11px]">
          <span>{s.icon}</span>
          <span className={s.done ? 'text-yesil font-semibold' : 'text-gri-400'}>
            {s.label} {s.done ? '✓' : '…'}
          </span>
        </div>
      ))}
    </div>
  );
}
```

Her kart'ta tasarım thumbnail'ların altına ekle:

```typescript
<ProofReadinessIndicator status={p.status} />
```

---

## EKLEMELER (5)

### GÖREV 5/9 — Status Filtre Tab'ları (P2)

#### Değişiklik

Sayfa başlığı altına filtre tab'ları ekle:

```typescript
type ProofFilter = 'all' | 'generating' | 'pending' | 'approved';

const [filter, setFilter] = useState<ProofFilter>('pending');

const filteredItems = useMemo(() => {
  switch (filter) {
    case 'generating': return items.filter(o => o.status === 'proof_generating' || o.status === 'proof_validating');
    case 'pending': return items.filter(o => o.status === 'proof_pending');
    case 'approved': return items.filter(o => o.status === 'proof_approved');
    default: return items;
  }
}, [items, filter]);

const counts = useMemo(() => ({
  all: items.length,
  generating: items.filter(o => o.status === 'proof_generating' || o.status === 'proof_validating').length,
  pending: items.filter(o => o.status === 'proof_pending').length,
  approved: items.filter(o => o.status === 'proof_approved').length,
}), [items]);
```

UI:

```typescript
<div className="flex gap-2 mb-5 flex-wrap">
  {[
    { id: 'pending' as const, label: 'Onay Bekliyor', emoji: '⏳' },
    { id: 'generating' as const, label: 'Hazırlanıyor', emoji: '⚙️' },
    { id: 'approved' as const, label: 'Onaylandı', emoji: '✅' },
    { id: 'all' as const, label: 'Tümü', emoji: '📋' },
  ].map(f => (
    <button
      key={f.id}
      type="button"
      onClick={() => setFilter(f.id)}
      className={cn(
        "px-4 py-2 rounded-full text-[13px] font-semibold transition-colors",
        filter === f.id
          ? "bg-lacivert text-white"
          : "bg-gri-100 text-gri-700 hover:bg-gri-200"
      )}
    >
      {f.emoji} {f.label} ({counts[f.id]})
    </button>
  ))}
</div>
```

Kart listesinde `items` yerine `filteredItems` kullan.

---

### GÖREV 6/9 — SLA'ya Göre Sıralama (P2)

#### Değişiklik

`filteredItems`'ı SLA kalan süreye göre sırala — en az kalan üstte:

```typescript
const sortedItems = useMemo(() => {
  return [...filteredItems].sort((a, b) => {
    // proof_pending olanlar üstte (SLA aktif)
    if (a.status === 'proof_pending' && b.status !== 'proof_pending') return -1;
    if (a.status !== 'proof_pending' && b.status === 'proof_pending') return 1;
    // İkisi de proof_pending → en eski üstte (SLA'ya en yakın)
    return a.createdAt - b.createdAt;
  });
}, [filteredItems]);
```

Kart listesinde `filteredItems` yerine `sortedItems` kullan.

---

### GÖREV 7/9 — Toplu Üretime Al (proof_approved) (P2)

#### Değişiklik

`proof_approved` olanlar varsa, filtre tab'larının üstüne toplu aksiyon strip:

```typescript
const approvedOrders = items.filter(o => o.status === 'proof_approved');

{approvedOrders.length > 0 && (
  <div className="mb-4 rounded-lg bg-yesil-soft/30 ring-1 ring-yesil/30 px-4 py-3 flex items-center justify-between">
    <span className="text-[13px] text-yesil-koyu font-medium">
      ✅ {approvedOrders.length} sipariş müşteri tarafından onaylandı — üretime alınabilir
    </span>
    <Button
      variant="primary"
      size="sm"
      className="!bg-yesil hover:!bg-yesil-koyu"
      onClick={async () => {
        if (!confirm(`${approvedOrders.length} siparişi üretime almak istediğinize emin misiniz?`)) return;
        let ok = 0;
        for (const o of approvedOrders) {
          const success = await callStatusApi(o.id, 'in_production', 'Toplu üretime alma (admin)');
          if (success) ok++;
        }
        toast.success(`${ok}/${approvedOrders.length} sipariş üretime alındı`);
      }}
    >
      Tümünü üretime al ({approvedOrders.length})
    </Button>
  </div>
)}
```

---

### GÖREV 8/9 — Prova Linkini Kopyala + WhatsApp Gönder (P2)

#### Değişiklik

Her kart'ın buton grubuna 2 yeni buton ekle:

```typescript
// Prova linki
const proofUrl = `${window.location.origin}/onay/${p.id}`;

<div className="flex flex-col gap-2 shrink-0">
  {/* Mevcut butonlar: Üretime al, Hatırlat, İptal */}

  {/* YENİ: Link kopyala */}
  <Button
    variant="ghost"
    size="sm"
    onClick={() => {
      navigator.clipboard.writeText(proofUrl);
      toast.success("Prova linki kopyalandı");
    }}
  >
    🔗 Link kopyala
  </Button>

  {/* YENİ: WhatsApp gönder */}
  <a
    href={`https://wa.me/${p.address?.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(
      `Merhaba ${p.address?.name ?? ''}, siparişinizin baskı provası hazır! Onaylamak için:\n${proofUrl}`
    )}`}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg ring-1 ring-gri-200 bg-white text-[12.5px] font-semibold text-yesil hover:ring-yesil"
  >
    💬 WhatsApp
  </a>
</div>
```

NOT: WhatsApp linki `wa.me/{phone}` formatında — telefon numarasından TR kodu (+90) eklenmeli. `p.address?.phone` "0532..." formatındaysa:

```typescript
const whatsappPhone = (p.address?.phone ?? '')
  .replace(/\D/g, '')
  .replace(/^0/, '90'); // 0532 → 90532
```

---

### GÖREV 9/9 — Mini İstatistik Bölümü (P3)

#### Değişiklik

Pim ipucu kartının ÜSTÜNE (veya KPI strip'in altına) son 30 gün istatistik:

```typescript
// Basit client-side hesaplama — allOrders'tan:
const last30Stats = useMemo(() => {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = allOrders.filter(o => o.createdAt >= cutoff);

  const approved = recent.filter(o =>
    ['proof_approved', 'ready_to_ship', 'in_production', 'shipped', 'delivered'].includes(o.status)
  ).length;

  const cancelled = recent.filter(o => o.status === 'cancelled').length;

  // Ortalama proof süresi (yaklaşık)
  const proofDone = recent.filter(o =>
    ['in_production', 'shipped', 'delivered'].includes(o.status)
  );
  // Yaklaşık: createdAt → estimated delivery arası
  const avgDays = proofDone.length > 0
    ? proofDone.reduce((s, o) => s + ((Date.now() - o.createdAt) / 86400000), 0) / proofDone.length
    : 0;

  return { approved, cancelled, total: recent.length, avgDays };
}, [allOrders]);
```

UI — KPI strip altına küçük banner:

```typescript
<div className="mb-5 text-[12px] text-gri-500 flex gap-4">
  <span>📊 Son 30 gün: {last30Stats.total} sipariş</span>
  <span>✅ {last30Stats.approved} onaylandı</span>
  <span>❌ {last30Stats.cancelled} iptal</span>
  {last30Stats.avgDays > 0 && (
    <span>⏱ Ort. süreç: {last30Stats.avgDays.toFixed(1)} gün</span>
  )}
</div>
```

---

## Uygulama Sırası

| # | Görev | Süre |
|---|---|---|
| 1 | Hatırlatma gerçek mail (API + UI) | 45 dk |
| 2 | Tüm proof statuslarını göster | 20 dk |
| 3 | SLA countdown | 30 dk |
| 4 | Bıçak + beyaz status rozeti | 15 dk |
| 5 | Status filtre tab'ları | 20 dk |
| 6 | SLA'ya göre sıralama | 10 dk |
| 7 | Toplu üretime al (proof_approved) | 20 dk |
| 8 | Prova linki kopyala + WhatsApp | 15 dk |
| 9 | Mini istatistik | 15 dk |

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
