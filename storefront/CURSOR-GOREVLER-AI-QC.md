# Cursor AI QC Kuyruğu İyileştirmeleri — `/admin/ai-qc`

> Claude Code (mimari) tarafından hazırlanmıştır.
> Dosya: `src/app/admin/ai-qc/page.tsx` (472 satır)
> API: `src/app/api/admin/ai-qc/queue/route.ts` + `decide/route.ts`
> 10 görev: 4 düzeltme + 6 ekleme

---

## DÜZELTMELER (4)

### GÖREV 1/10 — Tasarım Dosyası Önizleme (P1)

#### Sorun
Sadece dosya adı + DPI görünüyor, tasarımın kendisi yok. Operatör kör karar veriyor.

#### API güncelle: `src/app/api/admin/ai-qc/queue/route.ts`

Mevcut design_files sorgusu zaten dosya bilgisi çekiyor. Signed URL ekle:

```typescript
// Mevcut filesMap oluşturulduktan sonra (satır ~115-124 civarı):
// Her dosya için signed URL üret

import { createAdminClient } from "@/lib/supabase/admin";

// filesMap oluşturduktan sonra:
const signedUrlMap = new Map<string, string>();
for (const [fileId, file] of filesMap) {
  const { data: signedData } = await admin
    .storage
    .from("designs")
    .createSignedUrl(file.storage_path, 600); // 10 dk
  if (signedData?.signedUrl) {
    signedUrlMap.set(fileId, signedData.signedUrl);
  }
}

// qcRuns map'inde ekle:
previewUrl: q.design_file_id ? signedUrlMap.get(q.design_file_id) ?? null : null,
downloadUrl: q.design_file_id ? signedUrlMap.get(q.design_file_id) ?? null : null,
```

#### Sayfa güncelle: `src/app/admin/ai-qc/page.tsx`

QCRun interface'ine ekle:
```typescript
previewUrl: string | null;
downloadUrl: string | null;
```

Her QC run kartının içine thumbnail ekle:

```typescript
{run.previewUrl && (
  <div className="mt-3 rounded-lg overflow-hidden ring-1 ring-gri-200 bg-gri-50">
    <img
      src={run.previewUrl}
      alt={run.fileName ?? 'Tasarım'}
      className="w-full max-h-[300px] object-contain"
      loading="lazy"
    />
  </div>
)}
```

PNG/JPG doğrudan gösterilir. PDF/AI/PSD için `previewUrl` null olacak — bu durumda:

```typescript
{!run.previewUrl && run.fileName && (
  <div className="mt-3 rounded-lg bg-gri-50 ring-1 ring-gri-200 p-6 text-center">
    <Icon.Doc size={32} className="text-gri-400 mx-auto mb-2" />
    <div className="text-[12px] text-gri-500">{run.fileName}</div>
    <div className="text-[11px] text-gri-400 mt-1">
      Önizleme desteklenmiyor — dosyayı indirip kontrol edin
    </div>
  </div>
)}
```

---

### GÖREV 2/10 — "Düzelt ve Prova Hazırla" 3. Karar Seçeneği (P1)

#### Sorun
Sadece onayla/reddet var. "Küçük sorun var, ben düzelteyim" seçeneği yok.

#### API güncelle: `src/app/api/admin/ai-qc/decide/route.ts`

Decision enum'a `fix_and_proof` ekle:

```typescript
const BodySchema = z.object({
  orderId: z.string().min(1),
  decision: z.enum(["approve", "reject", "fix_and_proof"]),  // YENİ
  note: z.string().max(2000).optional(),
});

// Karar mapping:
const nextStatus =
  body.decision === "approve" ? "ready_to_ship"
  : body.decision === "fix_and_proof" ? "proof_generating"  // YENİ
  : "human_review_failed";
```

#### Sayfa güncelle

Karar bölümüne 3. buton ekle:

```typescript
<div className="flex flex-wrap gap-3 items-center">
  <Button
    variant="primary"
    size="lg"
    onClick={() => void decide("approve")}
    disabled={deciding}
    className="!bg-yesil hover:!bg-yesil-koyu"
  >
    <Icon.Check size={16} /> Onayla → Baskıya
  </Button>

  {/* YENİ */}
  <Button
    variant="secondary"
    onClick={() => void decide("fix_and_proof")}
    disabled={deciding}
  >
    🔧 Düzelt → Prova hazırla
  </Button>

  <Button
    variant="secondary"
    onClick={() => void decide("reject")}
    disabled={deciding}
    className="!text-kirmizi !ring-kirmizi/30 hover:!bg-kirmizi-soft/20"
  >
    ✗ Reddet → Müşteriye geri
  </Button>
</div>
```

"Düzelt → Prova hazırla" seçildiğinde:
- Status: `proof_generating` — POC bıçak + beyaz katman akışına girer
- Operatör düzeltmesini sonra `/admin/prova/[orderId]`'den yapar
- Event log: `qc_fixed_by_operator`

---

### GÖREV 3/10 — QC Tekrar Çalıştır Butonu (P1)

#### Sorun
Müşteri dosya düzeltip yükledi ama QC sonucu eski kalıyor.

#### Sayfa güncelle

Detay panelde, QC sonuçları kartının üstüne:

```typescript
<div className="flex items-center justify-between mb-3">
  <h3 className="font-semibold text-base">
    AI QC Sonuçları ({active.qcRuns.length} dosya)
  </h3>
  <Button
    variant="ghost"
    size="sm"
    onClick={async () => {
      if (!confirm('AI QC tekrar çalıştırılsın mı? (10-30 saniye sürebilir)')) return;
      setDeciding(true);
      try {
        const res = await fetch(`/api/agents/design-qc`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orderId: active.orderId, force: true }),
        });
        if (res.ok) {
          toast?.success?.('QC tekrar çalıştırıldı');
          // 5sn bekle + yenile (AI işleniyor)
          setTimeout(() => void fetchQueue(), 5000);
        } else {
          toast?.error?.('QC başlatılamadı');
        }
      } finally {
        setDeciding(false);
      }
    }}
    disabled={deciding}
  >
    🔄 QC tekrar çalıştır
  </Button>
</div>
```

NOT: `/api/agents/design-qc` endpoint'i zaten mevcut. `force: true` parametresi eklenirse mevcut QC sonucu ignore edilip yeniden çalıştırılır. Endpoint'te bu parametreyi handle et:

```typescript
// design-qc route.ts'de:
// force=true ise mevcut check var mı kontrolünü atla, yeniden çalıştır
```

---

### GÖREV 4/10 — Operatör Notu Her Kararda Kayıt (P2)

#### Sorun
Not alanı var ama sadece reject'te anlamlı. Approve'da da iç not bırakılabilir olmalı.

#### Değişiklik

Not alanı placeholder'ını güncelle:

```typescript
<textarea
  value={note}
  onChange={(e) => setNote(e.target.value)}
  placeholder="İç not (her kararda kaydedilir — operatör notları audit log'a gider)"
  rows={2}
  ...
/>
```

API'de `note` zaten her decision'da `logOrderEvent` detail'ına yazılıyor (satır 98-101) — değişiklik gerekmiyor. Sadece UI placeholder metni güncelle.

---

## EKLEMELER (6)

### GÖREV 5/10 — KPI Strip (P2)

#### Değişiklik

Sayfa başlığı ile kuyruk listesi arasına 4 KPI kart ekle:

```typescript
// Kuyruk verisinden hesapla:
const kpiStats = useMemo(() => {
  const total = queue.length;
  const avgWaitHours = queue.length > 0
    ? queue.reduce((s, q) => s + (Date.now() - new Date(q.createdAt).getTime()), 0) / queue.length / 3600000
    : 0;
  const kotu = queue.filter(q => q.qcRuns[0]?.verdict === 'kotu').length;
  const error = queue.filter(q => q.qcRuns[0]?.verdict === 'error').length;
  return { total, avgWaitHours, kotu, error };
}, [queue]);
```

UI:

```typescript
<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
  <Card padding="p-3">
    <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">Kuyrukta</div>
    <div className="text-[22px] font-bold text-lacivert tabular-nums mt-1">{kpiStats.total}</div>
  </Card>
  <Card padding="p-3">
    <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">Ort. bekleme</div>
    <div className="text-[22px] font-bold text-lacivert tabular-nums mt-1">
      {kpiStats.avgWaitHours < 1 ? `${Math.round(kpiStats.avgWaitHours * 60)} dk` : `${kpiStats.avgWaitHours.toFixed(1)} sa`}
    </div>
  </Card>
  <Card padding="p-3">
    <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">Kötü verdict</div>
    <div className={cn("text-[22px] font-bold tabular-nums mt-1", kpiStats.kotu > 0 ? "text-kirmizi" : "text-lacivert")}>
      {kpiStats.kotu}
    </div>
  </Card>
  <Card padding="p-3">
    <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">Hata</div>
    <div className={cn("text-[22px] font-bold tabular-nums mt-1", kpiStats.error > 0 ? "text-kirmizi" : "text-lacivert")}>
      {kpiStats.error}
    </div>
  </Card>
</div>
```

---

### GÖREV 6/10 — Verdict Filtre (P2)

#### Değişiklik

KPI strip altına filtre chip'leri ekle:

```typescript
const [verdictFilter, setVerdictFilter] = useState<string | null>(null);

const filteredQueue = useMemo(() => {
  if (!verdictFilter) return queue;
  return queue.filter(q => q.qcRuns[0]?.verdict === verdictFilter);
}, [queue, verdictFilter]);
```

UI:

```typescript
<div className="flex gap-2 mb-4 flex-wrap">
  {[
    { id: null, label: 'Tümü', count: queue.length },
    { id: 'kotu', label: '✗ Kötü', count: queue.filter(q => q.qcRuns[0]?.verdict === 'kotu').length },
    { id: 'normal', label: '~ Normal', count: queue.filter(q => q.qcRuns[0]?.verdict === 'normal').length },
    { id: 'error', label: '! Hata', count: queue.filter(q => q.qcRuns[0]?.verdict === 'error').length },
    { id: 'iyi', label: '✓ İyi', count: queue.filter(q => q.qcRuns[0]?.verdict === 'iyi').length },
  ].filter(f => f.count > 0 || f.id === null).map(f => (
    <button
      key={f.id ?? 'all'}
      type="button"
      onClick={() => setVerdictFilter(f.id)}
      className={cn(
        "px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors",
        verdictFilter === f.id
          ? "bg-lacivert text-white"
          : "bg-gri-100 text-gri-700 hover:bg-gri-200"
      )}
    >
      {f.label} ({f.count})
    </button>
  ))}
</div>
```

Sol panel kuyruk listesinde `queue` yerine `filteredQueue` kullan.

---

### GÖREV 7/10 — Dosya İndirme Linki (P2)

#### Değişiklik

QC run kartında, dosya adının yanına indirme butonu ekle:

```typescript
{run.downloadUrl && (
  <a
    href={run.downloadUrl}
    download={run.fileName ?? 'design'}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1 text-[11px] font-semibold text-pim-mercan hover:underline ml-2"
  >
    📥 İndir
  </a>
)}
```

Ayrıca detay panelin üstünde (sipariş header kartında) "Tüm dosyaları indir" linki:

```typescript
<a
  href={`/admin/siparisler/${active.orderId}#designs`}
  className="text-[12px] font-semibold text-pim-mercan hover:underline"
>
  📁 Tüm dosyalar →
</a>
```

---

### GÖREV 8/10 — Geçmiş Kararlar (P2)

#### Yeni API: `GET /api/admin/ai-qc/history?days=30&limit=50`

```typescript
// assertPermission("ai_qc", "view")
// SELECT oe.order_id, oe.event_type, oe.summary, oe.created_at, oe.detail,
//   p.display_name as operator_name
// FROM order_events oe
// LEFT JOIN profiles p ON p.id = oe.actor_id
// WHERE oe.event_type IN ('qc_approved', 'qc_rejected', 'qc_fixed_by_operator')
// AND oe.created_at > NOW() - INTERVAL '30 days'
// ORDER BY oe.created_at DESC
// LIMIT 50

// Response: { ok, history: [{ orderId, decision, operatorName, createdAt, note }], stats: { approved, rejected, fixed } }
```

#### Sayfa güncelle

Sayfa başlığı yanına "Geçmiş" butonu (toggle):

```typescript
const [showHistory, setShowHistory] = useState(false);

// Header'da:
<Button variant="ghost" size="sm" onClick={() => setShowHistory(s => !s)}>
  {showHistory ? 'Kuyruk göster' : '📋 Geçmiş kararlar'}
</Button>
```

Geçmiş aktifken:

```
┌─ Son 30 Gün Kararları ──────────────────────────┐
│ ✅ 24 onay  ·  ❌ 3 red  ·  🔧 2 düzeltme      │
├──────────────────────────────────────────────────┤
│ ✅ #00001245 · Ali V.     · Sefa · 2sa önce     │
│ ❌ #00001243 · Zeynep D.  · Sefa · 5sa önce     │
│    "DPI 72, minimum 300 gerekli"                 │
│ ✅ #00001240 · Mehmet K.  · Sefa · 1gün önce    │
│ ...                                               │
└──────────────────────────────────────────────────┘
```

---

### GÖREV 9/10 — Toplu Onay (verdict=iyi olanlar) (P2)

#### Sorun
5 sipariş "iyi" verdict ama human_review'da — muhtemelen mixed verdict (1 dosya iyi, 1 dosya normal) yüzünden buraya düşmüş.

#### Değişiklik

Kuyrukta verdict=iyi olan sipariş sayısı > 0 ise, üstte toplu onay strip'i:

```typescript
const goodVerdictOrders = queue.filter(q => {
  const runs = q.qcRuns;
  return runs.length > 0 && runs.every(r => r.verdict === 'iyi');
});

{goodVerdictOrders.length > 0 && (
  <div className="mb-4 rounded-lg bg-yesil-soft/30 ring-1 ring-yesil/30 px-4 py-3 flex items-center justify-between">
    <span className="text-[13px] text-yesil-koyu font-medium">
      ✓ {goodVerdictOrders.length} sipariş tüm dosyaları "İYİ" — toplu onaylanabilir
    </span>
    <Button
      variant="primary"
      size="sm"
      className="!bg-yesil hover:!bg-yesil-koyu"
      onClick={async () => {
        if (!confirm(`${goodVerdictOrders.length} siparişi toplu onaylayalım mı?`)) return;
        for (const o of goodVerdictOrders) {
          await fetch("/api/admin/ai-qc/decide", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ orderId: o.orderId, decision: "approve", note: "Toplu onay — tüm dosyalar iyi" }),
          });
        }
        toast?.success?.(`${goodVerdictOrders.length} sipariş onaylandı`);
        await fetchQueue();
      }}
      disabled={deciding}
    >
      Tümünü onayla ({goodVerdictOrders.length})
    </Button>
  </div>
)}
```

---

### GÖREV 10/10 — Revizyon Karşılaştırma (P3)

#### Sorun
Müşteri revize dosya yükledi — eski vs yeni yan yana görünmüyor.

#### Değişiklik

Aynı sipariş için birden fazla QC run varsa (revizyon), "Karşılaştır" butonu göster:

```typescript
{active.qcRuns.length > 1 && (
  <div className="mb-3 rounded-lg bg-mavi-soft/20 ring-1 ring-mavi-koyu/20 px-4 py-2 text-[12.5px]">
    📊 Bu sipariş için {active.qcRuns.length} QC çalıştırması var (revizyon tespit edildi)
  </div>
)}
```

QC sonuçları kartında, runs yan yana gösterilebilir (grid layout):

```typescript
{active.qcRuns.length > 1 ? (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {active.qcRuns.slice(0, 2).map((run, idx) => (
      <div key={run.runId} className="rounded-lg ring-1 ring-gri-200 p-4">
        <div className="text-[11px] font-bold uppercase mb-2">
          {idx === 0 ? '🆕 Son versiyon' : '📄 Önceki versiyon'}
        </div>
        {/* Mevcut QC run render — thumbnail + findings */}
      </div>
    ))}
  </div>
) : (
  // Mevcut tek run render
)}
```

Yan yana görünce operatör farkları hemen görebilir.

---

## Uygulama Sırası

| # | Görev | Süre |
|---|---|---|
| 1 | Tasarım dosyası önizleme (signed URL) | 45 dk |
| 2 | "Düzelt ve prova hazırla" 3. buton | 20 dk |
| 3 | QC tekrar çalıştır butonu | 20 dk |
| 4 | Operatör notu her kararda | 5 dk |
| 5 | KPI strip | 20 dk |
| 6 | Verdict filtre chip'leri | 15 dk |
| 7 | Dosya indirme linki | 10 dk |
| 8 | Geçmiş kararlar (API + UI) | 45 dk |
| 9 | Toplu onay (verdict=iyi) | 20 dk |
| 10 | Revizyon karşılaştırma (yan yana) | 30 dk |

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
