# Cursor Dashboard Güncellemeleri — `/admin`

> Claude Code (mimari) tarafından hazırlanmıştır.
> Dosya: `src/app/admin/page.tsx` (1563 satır)
> Analytics: `src/lib/admin-analytics.ts` (401 satır)
> 13 görev: 4 düzeltme + 3 sadeleştirme + 5 ekleme + 1 özel tarih

---

## DÜZELTMELER (4)

### GÖREV 1/13 — Secondary API Hata Görünürlüğü

#### Sorun
`customer-stats`, `funnel-metrics`, `auditors` API çağrıları `.catch(() => {})` ile sessizce yutuluyor. Sefa verinin yüklenip yüklenmediğini bilmiyor — sayı 0 mı yoksa API mı patladı?

#### Dosya: `src/app/admin/page.tsx`

Her secondary API için loading + error state ekle:

```typescript
// Mevcut (3 yerde):
// .catch(() => { /* silently */ });

// YENİ — state ekle:
const [statsError, setStatsError] = useState(false);
const [funnelError, setFunnelError] = useState(false);
const [auditorError, setAuditorError] = useState(false);

// customer-stats fetch'inde:
fetch("/api/admin/customer-stats")
  .then((r) => {
    if (!r.ok) { setStatsError(true); return null; }
    setStatsError(false);
    return r.json();
  })
  .then(...)
  .catch(() => setStatsError(true));

// Aynı pattern: funnel-metrics ve auditors için de
```

Hata varsa ilgili bölümde küçük kırmızı rozet göster:

```typescript
// Müşteri istatistikleri kartında:
{statsError && (
  <span className="text-[10px] text-kirmizi ml-2" title="API hatası — veri yüklenemedi">
    ⚠️ yüklenemedi
  </span>
)}
```

---

### GÖREV 2/13 — Prova Yanıt Süresi Hesaplama

#### Sorun
`avgProofResponseHours` hard-coded null — operasyonel metrikler bölümünde "Prova yanıt süresi" her zaman "—" gösteriyor.

#### Dosya: `src/lib/admin-analytics.ts`

`operationalMetrics()` fonksiyonunda prova yanıt süresini hesapla:

```typescript
// Mevcut:
// avgProofResponseHours: null

// YENİ — orders'tan hesapla:
function calcAvgProofResponseHours(orders: CustomerOrder[]): number | null {
  // proof_approved olan siparişlerde:
  // proof_pending başlangıç zamanı → proof_approved zamanı arası fark
  // Yaklaşık: createdAt'ten status'a geçiş süresi
  
  const approvedOrders = orders.filter(o => 
    o.status === 'proof_approved' || 
    o.status === 'ready_to_ship' || 
    o.status === 'in_production' || 
    o.status === 'shipped' || 
    o.status === 'delivered'
  );
  
  if (approvedOrders.length === 0) return null;
  
  // estimatedDelivery ile createdAt farkından yaklaşık proof süresi
  // Gerçek çözüm: order_events tablosundan proof_pending → proof_approved event süreleri
  // Şimdilik funnel-metrics API'deki proof_pending avgSeconds'ı kullan
  return null; // funnel-metrics'ten gelecek
}
```

**Daha iyi çözüm:** `GET /api/admin/funnel-metrics` zaten `proof_pending` için `avgSeconds` dönüyor. Dashboard'da bunu kullan:

```typescript
// Operasyonel metrikler bölümünde:
const proofResponseMetric = funnelMetrics['proof_pending'];
const proofResponseHours = proofResponseMetric 
  ? proofResponseMetric.avgSeconds / 3600 
  : null;

// Kartta:
<div>Prova yanıt süresi</div>
<div className="text-2xl font-bold">
  {proofResponseHours !== null ? formatHours(proofResponseHours) : '—'}
</div>
```

---

### GÖREV 3/13 — Error Boundary

#### Sorun
Herhangi bir component crash'i tüm dashboard'u beyaz sayfa yapar.

#### Dosya: `src/app/admin/error.tsx` (yeni veya mevcut kontrol et)

```typescript
"use client";

import { Pim } from "@/components/Pim";
import { Button } from "@/components/ui";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <Pim pose="sad" size={100} />
      <h2 className="mt-4 text-xl font-semibold text-lacivert">
        Dashboard yüklenirken hata oluştu
      </h2>
      <p className="mt-2 text-sm text-gri-500 max-w-md text-center">
        {error.message || "Beklenmeyen bir hata. Sayfayı yenile veya tekrar dene."}
      </p>
      <Button variant="primary" onClick={reset} className="mt-4">
        Tekrar dene
      </Button>
    </div>
  );
}
```

Eğer `src/app/admin/error.tsx` zaten varsa kontrol et — yoksa oluştur. Next.js App Router bu dosyayı otomatik error boundary olarak kullanır.

---

### GÖREV 4/13 — 500 Sipariş Limiti KPI Doğruluğu

#### Sorun
500+ sipariş olunca client-side KPI hesapları (ciro, sipariş sayısı) eksik veriyle çalışır.

#### Çözüm A (kısa vade — uyarı güçlendir):

Mevcut `ordersTruncated` uyarısını daha belirgin yap:

```typescript
{ordersTruncated && (
  <div className="mb-4 rounded-lg border border-sari bg-sari-soft/30 px-4 py-3 text-sm">
    ⚠️ <strong>Son 500 sipariş gösteriliyor.</strong> KPI değerleri bu aralığa göre hesaplanıyor.
    Tam veriler için <a href="/admin/finans" className="underline">Finans & Raporlar</a> sayfasını kullanın.
  </div>
)}
```

#### Çözüm B (orta vade — server-side aggregate):

`/api/admin/dashboard-stats` yeni endpoint:

```typescript
// GET /api/admin/dashboard-stats?range=7d
// Server-side SQL aggregate — 500 limit yok
// Response: {
//   revenue: number, orderCount: number, aov: number,
//   prevRevenue: number, prevCount: number,
//   aiFlagged: number, proofPending: number, productionPending: number,
// }
```

**Şimdilik Çözüm A yeterli** — 500 sipariş (100 kullanıcı × 5 sipariş) uzun süre aşılmaz.

---

## SADELEŞTİRMELER (3)

### GÖREV 5/13 — Heatmap Koşullu Göster

#### Sorun
İlk 100 müşteride heatmap anlamsız — yeterli veri yoğunluğu yok.

#### Değişiklik

Heatmap bölümünü sipariş sayısına göre koşullu göster:

```typescript
// Mevcut heatmap render bloğunun etrafına:
{orders.length >= 50 ? (
  // Mevcut HeatMap component
  <Card padding="p-4">
    <h3>Saatlik sipariş yoğunluğu</h3>
    <HeatMap data={heatmapData} />
  </Card>
) : (
  <Card padding="p-4" className="!bg-gri-50">
    <div className="flex items-center gap-3 text-gri-500 text-sm">
      <span className="text-2xl">📊</span>
      <div>
        <div className="font-medium">Saatlik yoğunluk haritası</div>
        <div className="text-[12px]">50+ sipariş sonrası aktif olacak ({orders.length}/50)</div>
      </div>
    </div>
  </Card>
)}
```

---

### GÖREV 6/13 — Top 5 Şehir Koşullu Göster

#### Değişiklik

Aynı pattern — 30+ sipariş yoksa sadeleştir:

```typescript
{orders.length >= 30 ? (
  // Mevcut Top 5 Şehir tablosu
) : (
  <Card padding="p-4" className="!bg-gri-50">
    <div className="flex items-center gap-3 text-gri-500 text-sm">
      <span className="text-2xl">🗺️</span>
      <div>
        <div className="font-medium">Şehir dağılımı</div>
        <div className="text-[12px]">30+ sipariş sonrası aktif ({orders.length}/30)</div>
      </div>
    </div>
  </Card>
)}
```

---

### GÖREV 7/13 — AI Insights Koşullu Göster

#### Değişiklik

```typescript
{orders.length >= 10 ? (
  // Mevcut AI Insights kartı
) : null}
// 10 sipariş altında insights gösterme — anlamsız çıktı
```

---

## YENİ EKLEMELER (5)

### GÖREV 8/13 — "Bugünün Geliri" Kartı

#### Sorun
Sefa her gün "bugün kaç ₺ girdi" bilmek istiyor — 7 günlük trend içinde kaybolur.

#### Değişiklik

KPI grid'in EN BAŞINA (ciro kartından ÖNCE) "Bugün" özel kartı ekle:

```typescript
// Bugünün siparişleri — zaman aralığından bağımsız, her zaman bugünü gösterir
const todayStart = useMemo(() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}, []);

const todayOrders = useMemo(
  () => orders.filter(o => o.createdAt >= todayStart),
  [orders, todayStart]
);
const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);
const todayCount = todayOrders.length;

// KPI grid'in başına:
<Card padding="p-4" className="!bg-pim-mercan-tint/20 ring-1 ring-pim-mercan/20">
  <div className="text-[11px] font-bold uppercase tracking-wider text-pim-mercan">
    Bugün
  </div>
  <div className="mt-2 flex items-baseline gap-3">
    <span className="text-[28px] font-bold text-lacivert tabular-nums">
      {formatCurrency(todayRevenue)}
    </span>
    <span className="text-[13px] text-gri-700">
      {todayCount} sipariş
    </span>
  </div>
  {todayCount > 0 && (
    <div className="mt-1 text-[11px] text-gri-500">
      Ort. sepet: {formatCurrency(todayRevenue / todayCount)}
    </div>
  )}
</Card>
```

Bu kart **zaman aralığı toggle'ından bağımsız** — her zaman bugünü gösterir.

---

### GÖREV 9/13 — Sistem Sağlığı Strip

#### Sorun
16 cron çalışıyor, biri patlarsa dashboard'dan fark edilmez.

#### Yeni API: `GET /api/admin/system-health`

```typescript
// assertPermission("settings", "view")
// Kontrol:
// 1. cron_runs → son 24 saatte hata var mı?
// 2. Resend → mail-health status
// 3. Supabase → bağlantı OK mi?
// Response: {
//   crons: { total: 16, healthy: 15, error: 1, lastError?: string },
//   mail: { status: 'ok' | 'error', sent24h: number, bounce: number },
//   db: { status: 'ok' | 'error' },
// }
```

NOT: `cron_runs` tablosu CURSOR-GOREVLER-FINAL.md Görev 2'de oluşturuluyor. O migration apply edilmemişse bu API `cron_runs` tablosu yokken hata verecek — try/catch ile handle et, yoksa skip.

#### Dashboard'da render

KPI grid'in ÜSTÜNE ince strip:

```typescript
// Eğer system-health API varsa:
{systemHealth && (
  <div className={cn(
    "mb-4 rounded-lg px-4 py-2.5 flex items-center gap-4 text-[12.5px]",
    systemHealth.crons.error > 0 || systemHealth.mail.status === 'error'
      ? "bg-kirmizi-soft/30 text-kirmizi-koyu"
      : "bg-yesil-soft/30 text-yesil-koyu"
  )}>
    {/* Cron */}
    <span>
      ⚙️ Cron: {systemHealth.crons.healthy}/{systemHealth.crons.total}
      {systemHealth.crons.error > 0 && (
        <Link href="/admin/sistem/cronlar" className="underline ml-1">
          {systemHealth.crons.error} hata
        </Link>
      )}
    </span>

    <span className="text-gri-300">|</span>

    {/* Mail */}
    <span>
      📧 Mail: {systemHealth.mail.sent24h} gönderildi
      {systemHealth.mail.bounce > 0 && (
        <span className="text-kirmizi ml-1">{systemHealth.mail.bounce} bounce</span>
      )}
    </span>

    <span className="text-gri-300">|</span>

    {/* DB */}
    <span>
      🗄️ DB: {systemHealth.db.status === 'ok' ? '✅' : '❌'}
    </span>
  </div>
)}
```

API silent fail ederse strip gösterilmez (opsiyonel bölüm).

---

### GÖREV 10/13 — Partner Üretim Durumu

#### Sorun
Hangi partner'da kaç sipariş üretimde, gecikmeli var mı — dashboard'dan görünmüyor.

#### Değişiklik

Operasyonel metrikler bölümünün ALTINA mini partner tablosu ekle:

```typescript
// order_assignments verisi gerekli — mevcut orders listesinden çıkarılabilir mi?
// Hayır — ayrı API gerekli.

// YENİ API: GET /api/admin/partner-production-summary
// assertPermission("fason", "view")
// SELECT fp.name, COUNT(*) as active_count,
//   SUM(CASE WHEN oa.estimated_delivery < NOW() THEN 1 ELSE 0 END) as overdue
// FROM order_assignments oa
// JOIN fason_partners fp ON fp.id = oa.fason_partner_id
// WHERE oa.status IN ('assigned', 'acknowledged', 'in_production')
// GROUP BY fp.id, fp.name
// ORDER BY active_count DESC
// LIMIT 5

// Response: { partners: [{ name, activeCount, overdueCount }] }
```

Dashboard UI:

```
┌─ Üretim Partnerleri ────────────────────┐
│ Partner         Üretimde    Gecikmeli    │
│ ──────────────────────────────────────── │
│ Alfa Matbaa       5          0           │
│ Beta Baskı        3          1 ⚠️        │
│ Gama Etiket       2          0           │
│                                          │
│ Toplam: 10 üretimde, 1 gecikmeli       │
└──────────────────────────────────────────┘
```

Gecikmeli > 0 ise satır kırmızı vurgulu.

---

### GÖREV 11/13 — Son 24 Saat Aktivite Akışı

#### Sorun
Kim kayıt oldu, kim sipariş verdi, kim tasarım yükledi — dashboard'da yok.

#### Değişiklik

Dashboard'un en altına (son siparişler altına) aktivite timeline ekle:

```typescript
// Mevcut order_events tablosu zaten var — son 24 saatin event'lerini çek

// YENİ API: GET /api/admin/activity-feed?hours=24&limit=15
// assertPermission("orders", "view")
// SELECT oe.event_type, oe.summary, oe.created_at, oe.order_id,
//   p.display_name as actor_name
// FROM order_events oe
// LEFT JOIN profiles p ON p.id = oe.actor_id
// WHERE oe.created_at > NOW() - INTERVAL '24 hours'
// ORDER BY oe.created_at DESC
// LIMIT 15

// Response: { events: [{ type, summary, createdAt, orderId, actorName }] }
```

Dashboard UI:

```
┌─ Son 24 Saat ───────────────────────────────────┐
│                                                   │
│ 🟢 14:23 · Sipariş #00001245 ödendi              │
│ 📁 13:55 · Ali V. tasarım yükledi (#00001244)   │
│ ✅ 12:30 · Zeynep prova onayladı (#00001240)    │
│ 🏭 11:15 · #00001238 Alfa Matbaa'ya atandı      │
│ 📦 10:00 · #00001235 kargoya verildi             │
│ 👤 09:30 · Yeni müşteri: Mehmet D.               │
│ ...                                               │
│                                   [Tümünü gör →] │
└───────────────────────────────────────────────────┘
```

Event type'a göre emoji:
```typescript
const EVENT_EMOJI: Record<string, string> = {
  paid: '🟢',
  design_uploaded: '📁',
  proof_approved: '✅',
  fason_assigned: '🏭',
  shipped: '📦',
  delivered: '🎉',
  cancelled: '❌',
  refund: '💸',
  user_registered: '👤',
  review_submitted: '⭐',
};
```

---

### GÖREV 12/13 — Mail Kuyruğu Durumu

#### Sorun
Kaç mail gönderildi, kuyrukta ne var, bounce var mı — dashboard'da yok.

#### Değişiklik

Sistem sağlığı strip'ine (Görev 9) mail bilgisi zaten ekleniyor. Ek olarak mail detayı istiyorsan Görev 9'daki strip yeterli.

Alternatif: Ayrı kart olarak değil, sistem sağlığı strip'inde göster (Görev 9 ile birleşik). **Bu görev Görev 9 ile birleştirildi — ayrıca yapma.**

---

## ÖZEL TARİH ARALIĞI

### GÖREV 13/13 — Custom Date Range Picker

#### Sorun
Sadece Bugün/7g/Bu ay/30g preset var. Sefa "geçen ayın 15-25'i" gibi özel aralık seçemiyor.

#### Değişiklik

Mevcut zaman aralığı toggle'ına 5. buton ekle: "📅 Özel"

```typescript
// Mevcut TimeRange type:
// type TimeRange = "today" | "7d" | "mtd" | "30d";

// YENİ:
type TimeRange = "today" | "7d" | "mtd" | "30d" | "custom";

// Custom range state:
const [customFrom, setCustomFrom] = useState<string>('');  // ISO date string
const [customTo, setCustomTo] = useState<string>('');
const [showDatePicker, setShowDatePicker] = useState(false);
```

Toggle bar'a 5. buton ekle:

```typescript
// Mevcut preset butonları yanına:
<button
  type="button"
  onClick={() => {
    setShowDatePicker(s => !s);
    if (range !== "custom") setRange("custom");
  }}
  className={cn(
    "px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors",
    range === "custom"
      ? "bg-lacivert text-white"
      : "bg-gri-100 text-gri-700 hover:bg-gri-200"
  )}
>
  📅 Özel
</button>
```

Tıklanınca altında tarih seçici açılır:

```typescript
{showDatePicker && (
  <div className="mt-2 flex items-center gap-3 p-3 bg-white rounded-lg ring-1 ring-gri-200 shadow-sm">
    <div className="flex items-center gap-2">
      <label className="text-[12px] text-gri-700">Başlangıç:</label>
      <input
        type="date"
        value={customFrom}
        onChange={(e) => setCustomFrom(e.target.value)}
        max={customTo || undefined}
        className="text-[13px] border border-gri-200 rounded px-2 py-1 focus:border-pim-mercan focus:outline-none"
      />
    </div>
    <span className="text-gri-400">→</span>
    <div className="flex items-center gap-2">
      <label className="text-[12px] text-gri-700">Bitiş:</label>
      <input
        type="date"
        value={customTo}
        onChange={(e) => setCustomTo(e.target.value)}
        min={customFrom || undefined}
        max={new Date().toISOString().slice(0, 10)}
        className="text-[13px] border border-gri-200 rounded px-2 py-1 focus:border-pim-mercan focus:outline-none"
      />
    </div>
    <button
      type="button"
      onClick={() => {
        if (customFrom && customTo) {
          setRange("custom");
          setShowDatePicker(false);
        }
      }}
      disabled={!customFrom || !customTo}
      className="px-3 py-1.5 bg-pim-mercan text-white text-[12.5px] font-medium rounded-lg disabled:opacity-40"
    >
      Uygula
    </button>
  </div>
)}
```

#### getRangeWindow güncelle

```typescript
function getRangeWindow(
  range: TimeRange,
  customFrom?: string,
  customTo?: string
): RangeWindow {
  // ... mevcut preset'ler ...

  if (range === "custom" && customFrom && customTo) {
    const from = new Date(customFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(customTo);
    to.setHours(23, 59, 59, 999);
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
    
    // Önceki periyot: aynı uzunlukta, seçilen aralıktan hemen önce
    const duration = to.getTime() - from.getTime();
    return {
      start: from.getTime(),
      prevStart: from.getTime() - duration,
      prevEnd: from.getTime(),
      days,
    };
  }

  // fallback
  return { start: Date.now() - 7 * 24 * 60 * 60 * 1000, prevStart: 0, prevEnd: 0, days: 7 };
}
```

Çağrı:
```typescript
const rangeWindow = getRangeWindow(range, customFrom, customTo);
```

#### RANGE_LABEL güncelle

```typescript
const RANGE_LABEL: Record<TimeRange, string> = {
  today: "Bugün",
  "7d": "7 gün",
  mtd: "Bu ay",
  "30d": "30 gün",
  custom: "Özel",
};

// Custom seçiliyken label:
// "25 May – 25 May 2026" formatında göster
const customLabel = customFrom && customTo
  ? `${new Date(customFrom).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} – ${new Date(customTo).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  : 'Özel';
```

Header'daki "son güncelleme" yanında seçili aralığı göster:

```typescript
{range === "custom" && customFrom && customTo && (
  <span className="text-[12px] text-gri-500 ml-2">
    ({customLabel})
  </span>
)}
```

---

## Uygulama Sırası

| # | Görev | Tip | Süre |
|---|---|---|---|
| 1 | Secondary API hata görünürlüğü | Düzeltme | 20 dk |
| 2 | Prova yanıt süresi hesaplama | Düzeltme | 15 dk |
| 3 | Error boundary | Düzeltme | 10 dk |
| 4 | 500 limit uyarı güçlendirme | Düzeltme | 10 dk |
| 5 | Heatmap koşullu (50+ sipariş) | Sadeleştir | 10 dk |
| 6 | Top 5 Şehir koşullu (30+ sipariş) | Sadeleştir | 10 dk |
| 7 | AI Insights koşullu (10+ sipariş) | Sadeleştir | 5 dk |
| 8 | "Bugünün geliri" kartı | Ekleme | 20 dk |
| 9 | Sistem sağlığı strip (cron + mail + DB) | Ekleme | 45 dk (API dahil) |
| 10 | Partner üretim durumu | Ekleme | 45 dk (API dahil) |
| 11 | Son 24 saat aktivite akışı | Ekleme | 45 dk (API dahil) |
| 12 | ~~Mail kuyruğu~~ → Görev 9 ile birleşik | — | — |
| 13 | Özel tarih aralığı (date picker) | Ekleme | 30 dk |

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
