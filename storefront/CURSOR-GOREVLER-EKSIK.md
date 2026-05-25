# Cursor Eksik Admin Sayfaları — 25 Mayıs 2026

> Claude Code (mimari) tarafından hazırlanmıştır.
> 3 yeni sayfa + 1 ayarlar güncellemesi.
> Her görev bağımsız commit edilebilir.

---

## GÖREV 1/3 — Ödeme Detay Sayfası `/admin/odemeler` (P1)

### Neden gerekli

Finans sayfası sadece KPI gösteriyor (toplam gelir, AOV, trend). Sefa tek tek ödeme arayamıyor, refund başlatamıyor, PayTR settlement eşleştiremiyyor. `payment_intents` ve `payments` tabloları dolu ama admin'den erişim yok.

### Dosya 1: `src/app/admin/odemeler/page.tsx`

```
Sayfa yapısı:
┌──────────────────────────────────────────────────┐
│ Ödemeler                                          │
├──────────────────────────────────────────────────┤
│ [4 KPI kart]                                      │
│  Toplam gelir  |  Bekleyen  |  İade edilen  |  Başarısız │
├──────────────────────────────────────────────────┤
│ [Filtre bar]                                      │
│  Status: [Tümü] [Başarılı] [Bekleyen] [İade] [Başarısız] │
│  Tarih: [son 7g] [30g] [tümü] [özel aralık]      │
│  Arama: sipariş ID veya müşteri adı              │
├──────────────────────────────────────────────────┤
│ [Tablo]                                           │
│  Tarih | Sipariş | Müşteri | Tutar | Status | İşlem │
│  ───────────────────────────────────────────────  │
│  25.05 | 00001234 | Ali V.  | ₺890  | ✅      | 👁️   │
│  25.05 | 00001233 | Zeynep  | ₺1250 | 🔄 iade | 👁️   │
│  ...                                              │
├──────────────────────────────────────────────────┤
│ [Detay panel — tıklanan ödeme]                    │
│  PayTR referans: XXXX                             │
│  Auth code: YYYY                                  │
│  Kart: **** 4532                                  │
│  3DS: ✅                                          │
│  [İade başlat] butonu (sadece success status'ta)  │
└──────────────────────────────────────────────────┘
```

### Veri kaynağı

```typescript
// payment_intents → sipariş oluşturma öncesi snapshot
// payments → gerçek ödeme kayıtları (success, refund, failed)
// orders → sipariş bağlantısı

// API: GET /api/admin/payments
// Query params: ?status=success|pending|failed|refunded&from=ISO&to=ISO&q=search
// Response: { ok, payments: PaymentRow[], totals: { revenue, pending, refunded, failed } }
```

### API: `src/app/api/admin/payments/route.ts`

```typescript
// GET — ödeme listesi + KPI toplamları
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const auth = await assertPermission("finans", "view");
  if (!auth) return Response.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");    // success|pending|failed|refunded
  const from = url.searchParams.get("from");         // ISO date
  const to = url.searchParams.get("to");             // ISO date
  const q = url.searchParams.get("q");               // search (order ID or customer name)

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // payments tablosundan çek, orders + profiles JOIN
  let query = admin
    .from("payments")
    .select(`
      id, order_id, action, status, amount, currency,
      provider_ref, auth_code, masked_card, created_at,
      orders!inner(id, user_id, profiles:user_id(display_name, email))
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // KPI toplamları
  const totals = {
    revenue: 0, pending: 0, refunded: 0, failed: 0
  };
  for (const p of data ?? []) {
    if (p.status === "success" && p.action === "charge") totals.revenue += p.amount;
    if (p.status === "pending") totals.pending += p.amount;
    if (p.action === "refund" && p.status === "success") totals.refunded += p.amount;
    if (p.status === "failed") totals.failed += p.amount;
  }

  return Response.json({ ok: true, payments: data, totals });
}
```

### Refund API: `src/app/api/admin/payments/refund/route.ts`

```typescript
// POST — manuel iade başlat
// Body: { paymentId: string, amount?: number, reason: string }
// Mevcut /api/payment/refund endpoint'indeki PayTR refund logic'ini çağır
// assertPermission("finans", "update") ile koru
// audit_log INSERT (actor, payment_id, amount, reason)
// İade tutarı orijinal tutarı aşamaz guard'ı ekle
```

### Sayfa component'leri

- `PaymentKpiStrip` — 4 kart (gelir, bekleyen, iade, başarısız)
- `PaymentFilters` — status chip'ler + tarih + arama
- `PaymentTable` — tablo satırları, tıkla → detay panel aç
- `PaymentDetailPanel` — sağ slide-over veya modal, PayTR ref + auth + kart + refund butonu

### Sidebar ekleme

`src/components/layout/AdminShell.tsx` → Yönetim grubuna, "Finans & Raporlar" altına ekle:

```typescript
{
  href: "/admin/odemeler",
  label: "Ödemeler",
  icon: <Icon.Wallet size={16} />,  // veya CreditCard ikonu varsa
  module: "finans",
},
```

### PATH_TITLES ekleme

```typescript
"/admin/odemeler": "Ödemeler",
```

### Doğrulama
- `/admin/odemeler` → tablo yükleniyor, KPI'lar hesaplanıyor
- Status filtresi çalışıyor
- Refund butonu sadece success ödemelerde görünüyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 2/3 — Cron İzleme Paneli `/admin/sistem/cronlar` (P1)

### Neden gerekli

16 cron job var, hiçbirinin son çalışma durumu admin'den görünmüyor. Cron patlarsa Sefa bilmiyor — sadece Sentry'den hata gelirse fark edilir.

### Mimari karar

Cron çalışma logları için yeni tablo GEREKMEZ. Mevcut `auditor_runs` tablosu pattern'i takip edilebilir, ama daha basit bir yaklaşım: her cron çalışınca `site_settings` veya ayrı bir `cron_runs` localStorage/DB key'ine son durum yazar.

**En basit yaklaşım:** Her cron endpoint'inin başına/sonuna log eklemek yerine, `/api/admin/cron-status` endpoint'i Vercel API'sinden son function çalışma loglarını çeker.

**Ama Vercel API gereksiz karmaşık.** Bunun yerine:

### Yeni migration: `supabase/migrations/097_cron_runs.sql`

```sql
create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  cron_name varchar(60) not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status varchar(20) not null default 'running'
    check (status in ('running', 'success', 'error')),
  duration_ms integer,
  summary text,
  error_message text,
  items_processed integer default 0,
  created_at timestamptz default now()
);

create index cron_runs_name_idx on public.cron_runs(cron_name, started_at desc);

-- Son 30 gün tutulan: eski kayıtlar purge edilebilir
-- RLS: admin-only
alter table public.cron_runs enable row level security;

drop policy if exists "Admin reads cron runs" on public.cron_runs;
create policy "Admin reads cron runs"
  on public.cron_runs for select to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  ));
```

### Cron helper: `src/lib/cron-logger.ts`

```typescript
interface CronRunContext {
  cronName: string;
  run: { id: string; startedAt: Date };
  complete: (summary: string, itemsProcessed?: number) => Promise<void>;
  fail: (error: string) => Promise<void>;
}

export async function startCronRun(cronName: string): Promise<CronRunContext> {
  // INSERT cron_runs status='running'
  // return context with complete() and fail() methods
  // complete → UPDATE status='success', finished_at, duration_ms, summary
  // fail → UPDATE status='error', finished_at, error_message
}
```

### Mevcut 16 cron'a entegre

Her cron route.ts'in başına ve sonuna:

```typescript
export async function GET(req: Request) {
  const guard = assertCronAuth(req);
  if (guard) return guard;

  const cron = await startCronRun("auto-refund");  // ← YENİ
  try {
    // ... mevcut logic ...
    await cron.complete(`${processed} sipariş işlendi`, processed);  // ← YENİ
    return Response.json({ ok: true });
  } catch (err) {
    await cron.fail((err as Error).message);  // ← YENİ
    return Response.json({ error: "Internal" }, { status: 500 });
  }
}
```

**16 dosya güncellenir:**
- `src/app/api/cron/auto-refund/route.ts`
- `src/app/api/cron/archive-inactive/route.ts`
- `src/app/api/cron/poll-shipments/route.ts`
- `src/app/api/cron/process-mail-outbox/route.ts`
- `src/app/api/cron/detect-abandoned-carts/route.ts`
- `src/app/api/cron/cleanup-orphan-previews/route.ts`
- `src/app/api/cron/cleanup-stale-uploads/route.ts`
- `src/app/api/cron/cleanup-temp-designs/route.ts`
- `src/app/api/cron/paytr-reconciler/route.ts`
- `src/app/api/cron/purge-expired-designs/route.ts`
- `src/app/api/cron/refresh-fason-scores/route.ts`
- `src/app/api/cron/request-reviews/route.ts`
- `src/app/api/cron/upload-reminders/route.ts`
- `src/app/api/cron/admin-daily-summary/route.ts`
- `src/app/api/cron/auditors/daily-digest/route.ts`
- `src/app/api/cron/auditors/[name]/route.ts`

### API: `src/app/api/admin/cron-status/route.ts`

```typescript
// GET — tüm cron'ların son çalışma durumu
// assertPermission("settings", "view")
// Her cron_name için son kayıt: status, started_at, duration_ms, summary, error_message

// Response:
// {
//   ok: true,
//   crons: [
//     { name: "auto-refund", schedule: "0 2 * * *", lastRun: {...}, status: "success" },
//     { name: "poll-shipments", schedule: "0 */4 * * *", lastRun: {...}, status: "error" },
//     ...
//   ]
// }
```

### Manuel tetikleme: `src/app/api/admin/cron-status/trigger/route.ts`

```typescript
// POST — cron'u manuel çalıştır
// Body: { cronName: string }
// assertPermission("settings", "update")
// İlgili cron endpoint'ine internal fetch (CRON_SECRET ile)
// audit_log INSERT
```

### Sayfa: `src/app/admin/sistem/cronlar/page.tsx`

```
Sayfa yapısı:
┌──────────────────────────────────────────────────┐
│ Cron İzleme                                       │
├──────────────────────────────────────────────────┤
│ [Özet bar]                                        │
│  16 toplam | 14 ✅ sağlıklı | 1 ⚠️ yavaş | 1 ❌ hata │
├──────────────────────────────────────────────────┤
│ [Tablo]                                           │
│  Cron         | Schedule     | Son çalışma | Durum | Süre   | İşlem    │
│  ─────────────────────────────────────────────────────────────────────  │
│  auto-refund  | Her gün 02:00| 25.05 02:01 | ✅    | 1.2s   | [▶ Çalıştır] │
│  poll-ships   | Her 4 saat   | 25.05 08:00 | ❌    | 45s    | [▶ Çalıştır] │
│  mail-outbox  | Her gün      | 25.05 03:00 | ✅    | 0.8s   | [▶ Çalıştır] │
│  ...          |              |             |       |        |          │
├──────────────────────────────────────────────────┤
│ [Detay — tıklanan cron]                           │
│  Son 7 gün çalışma geçmişi (mini bar chart)      │
│  Son hata mesajı (varsa)                          │
│  İşlenen item sayısı                              │
└──────────────────────────────────────────────────┘
```

**Cron listesi (hardcoded registry):**

```typescript
const CRON_REGISTRY = [
  { name: "auto-refund", schedule: "0 2 * * *", label: "Otomatik iade (36sa)" },
  { name: "archive-inactive", schedule: "0 3 * * *", label: "Arşiv (90gün)" },
  { name: "poll-shipments", schedule: "0 */4 * * *", label: "Kargo takip" },
  { name: "process-mail-outbox", schedule: "0 3 * * *", label: "Mail kuyruğu" },
  { name: "detect-abandoned-carts", schedule: "0 4 * * *", label: "Terk edilmiş sepet" },
  { name: "cleanup-orphan-previews", schedule: "0 4 * * *", label: "Orphan preview temizlik" },
  { name: "cleanup-stale-uploads", schedule: "0 4 * * *", label: "Stale upload temizlik" },
  { name: "cleanup-temp-designs", schedule: "0 4 * * *", label: "Temp tasarım temizlik" },
  { name: "paytr-reconciler", schedule: "30 3 * * *", label: "PayTR mutabakat" },
  { name: "purge-expired-designs", schedule: "0 4 * * *", label: "Eski tasarım silme (KVKK)" },
  { name: "refresh-fason-scores", schedule: "0 3 * * *", label: "Partner skor güncelle" },
  { name: "request-reviews", schedule: "0 10 * * *", label: "Yorum daveti" },
  { name: "upload-reminders", schedule: "0 9 * * *", label: "Upload hatırlatma" },
  { name: "admin-daily-summary", schedule: "0 9 * * *", label: "Günlük özet mail" },
  { name: "auditors-daily-digest", schedule: "0 8 * * *", label: "Denetçi günlük rapor" },
  { name: "auditors-agent", schedule: "varies", label: "Denetçi agent'ları" },
];
```

### Sidebar ekleme

`AdminShell.tsx` → Sistem grubuna, Denetçiler altına ekle:

```typescript
{
  href: "/admin/sistem/cronlar",
  label: "Cron İzleme",
  icon: <Icon.Refresh size={16} />,
  module: "settings",
},
```

### PATH_TITLES ekleme

```typescript
"/admin/sistem/cronlar": "Cron izleme",
```

### Doğrulama
- Migration 097 apply → `cron_runs` tablosu oluştu
- `/admin/sistem/cronlar` → 16 cron listesi görünüyor
- Cron çalıştıktan sonra son durum güncelleniyor
- "Çalıştır" butonu → cron tetikleniyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 3/3 — Bakım Modu (`/admin/ayarlar` + middleware) (P1)

### Neden gerekli

Production'da acil sorun olduğunda müşteri tarafını kapatmanın yolu yok. Vercel rollback var ama "bakım yapılıyor" sayfası gösteremiyorsun.

### Adım 1: `site_settings`'e kolon ekle

Yeni migration: `supabase/migrations/098_maintenance_mode.sql`

```sql
alter table public.site_settings
  add column if not exists maintenance_mode boolean not null default false,
  add column if not exists maintenance_message text default 'Kısa süreli bakım yapılıyor. Birkaç dakika içinde tekrar deneyin.';
```

### Adım 2: `/admin/ayarlar/page.tsx`'e toggle ekle

Mevcut `SiteSettings` interface'ine ekle:

```typescript
interface SiteSettings {
  // ... mevcut alanlar ...
  maintenanceMode: boolean;
  maintenanceMessage: string;
}
```

Sayfa UI'da yeni bölüm — **en üstte**, kırmızı çerçeveli:

```
┌─ 🔴 Bakım Modu ──────────────────────────────────┐
│                                                    │
│  [Toggle: Bakım modu ○ Kapalı / ● Açık]          │
│                                                    │
│  Mesaj: [__________________________]               │
│  (varsayılan: "Kısa süreli bakım yapılıyor...")   │
│                                                    │
│  ⚠️ Açık olduğunda müşteriler siteye erişemez.    │
│  Admin paneli etkilenmez.                          │
└────────────────────────────────────────────────────┘
```

Toggle açıldığında:
- `PATCH /api/admin/settings` → `maintenance_mode: true`
- Kırmızı global banner: "⚠️ BAKIM MODU AKTİF — müşteriler siteye erişemiyor"
- Banner admin panelinin her sayfasında topbar altında görünsün

Toggle kapatıldığında:
- `PATCH /api/admin/settings` → `maintenance_mode: false`
- Banner kaybolur

### Adım 3: Middleware güncelle

`src/middleware.ts`'e bakım modu kontrolü ekle:

```typescript
// Middleware'de en başa (auth kontrolünden ÖNCE):
// 1. /admin/* ve /api/* yollarını ATLAT (admin çalışmaya devam etmeli)
// 2. Diğer tüm müşteri sayfaları için:

if (isMaintenanceMode && !isAdminPath && !isApiPath) {
  // Bakım sayfasına yönlendir
  return NextResponse.rewrite(new URL("/bakim", request.url));
}
```

**Maintenance mode nasıl okunur:**
- Middleware'de DB sorgusu PAHALI (her request'te) → alternatif:
- **Seçenek A (önerilen):** Vercel Edge Config veya env var `MAINTENANCE_MODE=true`
- **Seçenek B:** `/api/admin/settings` response'unu 60sn cache'le, middleware'de oku
- **Seçenek C:** `site_settings` tablosundan edge-compatible okuma

**En pratik:** Ayarlar sayfasından toggle değiştiğinde hem DB'ye yaz hem Vercel env'i güncelle (veya basitçe `site_settings`'ten oku, 60sn Supabase edge cache).

### Adım 4: Bakım sayfası

`src/app/bakim/page.tsx`:

```typescript
// Server component — basit, Pim mascot + mesaj
export default async function MaintenancePage() {
  // site_settings'ten maintenance_message çek (veya default)
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-krem px-4">
      <Pim pose="think" size={120} />
      <h1 className="mt-6 text-2xl font-bold text-lacivert">
        Bakım yapılıyor
      </h1>
      <p className="mt-3 text-gri-500 text-center max-w-md">
        {message || "Kısa süreli bakım yapılıyor. Birkaç dakika içinde tekrar deneyin."}
      </p>
      <p className="mt-6 text-sm text-gri-400">
        Acil iletişim: info@pimetiket.com
      </p>
    </main>
  );
}
```

### Adım 5: Admin topbar uyarı banner

`AdminShell.tsx` → `{children}` render'ından ÖNCE:

```typescript
{maintenanceMode && (
  <div className="bg-kirmizi px-4 py-2 text-white text-sm text-center font-medium">
    ⚠️ BAKIM MODU AKTİF — müşteriler siteye erişemiyor.
    <Link href="/admin/ayarlar" className="underline ml-2">Kapat</Link>
  </div>
)}
```

`maintenanceMode` state'ini AdminShell'de `/api/admin/settings` GET response'undan çek (mevcut badge fetch pattern'i gibi 60sn interval).

### Doğrulama
- Migration 098 apply → `maintenance_mode` kolon eklendi
- `/admin/ayarlar` → bakım modu toggle → açık → topbar kırmızı banner
- Müşteri tarafı → `/` açınca bakım sayfası görünüyor
- `/admin/*` → normal çalışıyor (etkilenmiyor)
- Toggle kapat → müşteri tarafı normal
- `npx tsc --noEmit` → 0 hata

---

## Uygulama Sırası

1. **Görev 3** — Bakım modu (en küçük, en hızlı değer — acil durum aracı)
2. **Görev 2** — Cron izleme (migration + 16 cron güncelle + sayfa)
3. **Görev 1** — Ödemeler (en büyük, en çok UI)

Her görev sonrası: `npx tsc --noEmit` + commit.

---

## Sidebar Nihai Yapı (tüm görevler sonrası)

```
Operasyon
  ├── Dashboard
  ├── Siparişler (badge)
  ├── Manuel Sipariş
  ├── AI QC (badge)
  ├── Prova (badge)
  ├── Kargo
  └── Üretim Partnerleri (badge)

Müşteri
  ├── Müşteriler
  ├── Yorumlar
  ├── İadeler
  ├── Tasarımlar
  └── Yardım Talepleri (badge)

İçerik
  ├── Ürünler
  ├── Aboneler
  ├── Galeri
  └── Site Görselleri

Yönetim
  ├── Finans & Raporlar
  ├── Ödemeler                    ← 🆕
  ├── Kuponlar
  ├── Çalışanlar
  └── Fiyat Yönetimi

Sistem
  ├── Denetçiler (badge)
  ├── Cron İzleme                 ← 🆕
  ├── Denetim Kaydı
  ├── KVKK Talepleri
  ├── Yedekler
  ├── Arşiv (R2)
  ├── E-posta Sağlığı
  ├── Debug Araçları
  └── Ayarlar                     ← bakım modu eklendi 🆕
```

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
