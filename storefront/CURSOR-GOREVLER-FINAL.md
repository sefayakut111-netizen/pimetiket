# Cursor Final Görev Paketi — 8 Kalan İş

> Claude Code (mimari) tarafından hazırlanmıştır.
> Tüm önceki paketlerden kalan işler tek dosyada birleştirildi.
> Sırayla uygulanacak. Her görev sonrası `npx tsc --noEmit` + commit.

---

## GÖREV 1/8 — Bakım Modu (En küçük, acil durum aracı)

### Migration: `supabase/migrations/103_maintenance_mode.sql`

```sql
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS maintenance_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_message text DEFAULT 'Kısa süreli bakım yapılıyor. Birkaç dakika içinde tekrar deneyin.';
```

### `/admin/ayarlar/page.tsx` güncelle

Mevcut `SiteSettings` interface'ine ekle:
```typescript
maintenanceMode: boolean;
maintenanceMessage: string;
```

Sayfanın EN ÜSTÜNE kırmızı çerçeveli bakım toggle bölümü ekle:

```
┌─ 🔴 Bakım Modu ────────────────────────────────┐
│ [Toggle: ○ Kapalı / ● Açık]                    │
│ Mesaj: [________________________________]       │
│ ⚠️ Açıkken müşteriler siteye erişemez.         │
│ Admin paneli etkilenmez.                         │
└──────────────────────────────────────────────────┘
```

Toggle değiştiğinde `PATCH /api/admin/settings` → `maintenance_mode: true/false`

### `/api/admin/settings/route.ts` güncelle

GET ve PATCH'te `maintenance_mode` + `maintenance_message` alanlarını ekle.

### Bakım sayfası: `src/app/bakim/page.tsx` (yeni)

```typescript
import { Pim } from "@/components/Pim";

export default function MaintenancePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-krem px-4">
      <Pim pose="think" size={120} />
      <h1 className="mt-6 text-2xl font-bold text-lacivert">Bakım yapılıyor</h1>
      <p className="mt-3 text-gri-500 text-center max-w-md">
        Kısa süreli bakım yapılıyor. Birkaç dakika içinde tekrar deneyin.
      </p>
      <p className="mt-6 text-sm text-gri-400">Acil iletişim: info@pimetiket.com</p>
    </main>
  );
}
```

### `src/middleware.ts` güncelle

Middleware'in en başına (auth kontrolünden ÖNCE) bakım modu kontrolü ekle:

```typescript
// Admin ve API yollarını ATLA (admin çalışmaya devam etmeli)
const isAdminPath = request.nextUrl.pathname.startsWith('/admin');
const isApiPath = request.nextUrl.pathname.startsWith('/api');
const isMaintenancePath = request.nextUrl.pathname === '/bakim';

if (!isAdminPath && !isApiPath && !isMaintenancePath) {
  // site_settings'ten maintenance_mode kontrol et
  // Basit yaklaşım: /api/admin/settings'i çağırma (pahalı)
  // Bunun yerine: Supabase'den direkt oku (edge-compatible)
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('maintenance_mode')
      .single();

    if (data?.maintenance_mode) {
      return NextResponse.rewrite(new URL('/bakim', request.url));
    }
  } catch {
    // DB erişimi başarısızsa siteyi kapatma — fail-open
  }
}
```

### AdminShell topbar banner

`src/components/layout/AdminShell.tsx` → children render'ından ÖNCE, maintenance_mode aktifse kırmızı banner göster:

```typescript
// AdminShell içinde /api/admin/settings'ten maintenance_mode çek (mevcut badge fetch pattern gibi)
{maintenanceMode && (
  <div className="bg-kirmizi px-4 py-2 text-white text-sm text-center font-medium">
    ⚠️ BAKIM MODU AKTİF — müşteriler siteye erişemiyor.
    <a href="/admin/ayarlar" className="underline ml-2">Kapat</a>
  </div>
)}
```

### Doğrulama
- Migration apply → maintenance_mode kolonu eklendi
- `/admin/ayarlar` → toggle aç → topbar kırmızı banner
- Müşteri tarafı → `/` açınca bakım sayfası
- `/admin/*` → normal çalışıyor
- Toggle kapat → müşteri tarafı normal
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 2/8 — Cron İzleme Paneli

### Migration: `supabase/migrations/104_cron_runs.sql`

```sql
CREATE TABLE IF NOT EXISTS public.cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name varchar(60) NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status varchar(20) NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'error')),
  duration_ms integer,
  summary text,
  error_message text,
  items_processed integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX cron_runs_name_idx ON public.cron_runs(cron_name, started_at DESC);

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads cron runs" ON public.cron_runs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'staff')
  ));
```

### Cron logger: `src/lib/cron-logger.ts` (yeni)

```typescript
import { createClient } from "@supabase/supabase-js";

export async function startCronRun(cronName: string) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const startedAt = new Date();
  const { data } = await admin.from("cron_runs").insert({
    cron_name: cronName, started_at: startedAt.toISOString(), status: "running",
  }).select("id").single();

  const runId = data?.id;

  return {
    async complete(summary: string, itemsProcessed = 0) {
      if (!runId) return;
      const duration = Date.now() - startedAt.getTime();
      await admin.from("cron_runs").update({
        status: "success", finished_at: new Date().toISOString(),
        duration_ms: duration, summary, items_processed: itemsProcessed,
      }).eq("id", runId);
    },
    async fail(error: string) {
      if (!runId) return;
      const duration = Date.now() - startedAt.getTime();
      await admin.from("cron_runs").update({
        status: "error", finished_at: new Date().toISOString(),
        duration_ms: duration, error_message: error,
      }).eq("id", runId);
    },
  };
}
```

### 16 cron dosyasına entegre

`src/app/api/cron/*/route.ts` dosyalarının HEPSİNDE:

```typescript
import { startCronRun } from "@/lib/cron-logger";

export async function GET(req: Request) {
  const guard = assertCronAuth(req);
  if (guard) return guard;

  const cron = await startCronRun("auto-refund"); // cron adı
  try {
    // ... mevcut logic ...
    await cron.complete(`${count} sipariş işlendi`, count);
    return Response.json({ ok: true });
  } catch (err) {
    await cron.fail((err as Error).message);
    return Response.json({ error: "Internal" }, { status: 500 });
  }
}
```

Güncellenecek 16 dosya:
`auto-refund`, `archive-inactive`, `poll-shipments`, `process-mail-outbox`, `detect-abandoned-carts`, `cleanup-orphan-previews`, `cleanup-stale-uploads`, `cleanup-temp-designs`, `paytr-reconciler`, `purge-expired-designs`, `refresh-fason-scores`, `request-reviews`, `upload-reminders`, `admin-daily-summary`, `auditors/daily-digest`, `auditors/[name]`

### API: `src/app/api/admin/cron-status/route.ts` (yeni)

```typescript
// GET — tüm cron'ların son durumu
// assertPermission("settings", "view")
// Her cron_name için son kayıt: status, started_at, duration_ms, summary, error

// Cron listesi (hardcoded registry):
const CRON_REGISTRY = [
  { name: "auto-refund", schedule: "0 2 * * *", label: "Otomatik iade (36sa)" },
  { name: "archive-inactive", schedule: "0 3 * * *", label: "Arşiv (90gün)" },
  { name: "poll-shipments", schedule: "0 */4 * * *", label: "Kargo takip" },
  { name: "process-mail-outbox", schedule: "0 3 * * *", label: "Mail kuyruğu" },
  { name: "detect-abandoned-carts", schedule: "0 4 * * *", label: "Terk sepet" },
  { name: "cleanup-orphan-previews", schedule: "0 4 * * *", label: "Orphan preview" },
  { name: "cleanup-stale-uploads", schedule: "0 4 * * *", label: "Stale upload" },
  { name: "cleanup-temp-designs", schedule: "0 4 * * *", label: "Temp tasarım" },
  { name: "paytr-reconciler", schedule: "30 3 * * *", label: "PayTR mutabakat" },
  { name: "purge-expired-designs", schedule: "0 4 * * *", label: "KVKK tasarım silme" },
  { name: "refresh-fason-scores", schedule: "0 3 * * *", label: "Partner skor" },
  { name: "request-reviews", schedule: "0 10 * * *", label: "Yorum daveti" },
  { name: "upload-reminders", schedule: "0 9 * * *", label: "Upload hatırlatma" },
  { name: "admin-daily-summary", schedule: "0 9 * * *", label: "Günlük özet" },
  { name: "auditors-daily-digest", schedule: "0 8 * * *", label: "Denetçi rapor" },
  { name: "auditors-agent", schedule: "varies", label: "Denetçi agent" },
];
```

### Manuel tetikleme: `src/app/api/admin/cron-status/trigger/route.ts` (yeni)

```typescript
// POST { cronName: string }
// assertPermission("settings", "update")
// İlgili cron endpoint'ine internal fetch (Authorization: Bearer CRON_SECRET)
// audit_log INSERT
```

### Sayfa: `src/app/admin/sistem/cronlar/page.tsx` (yeni)

16 cron tablo halinde: isim, schedule, son çalışma, durum (yeşil/kırmızı), süre, "Çalıştır" buton.
Detay panel: son 7 gün geçmişi + hata mesajı.

### Sidebar ekle

`AdminShell.tsx` → Sistem grubunda, Denetçiler altına:
```typescript
{ href: "/admin/sistem/cronlar", label: "Cron İzleme", icon: <Icon.Refresh size={16} />, module: "settings" }
```

`PATH_TITLES`'a ekle: `"/admin/sistem/cronlar": "Cron izleme"`

---

## GÖREV 3/8 — Ödeme Detay Sayfası

### API: `src/app/api/admin/payments/route.ts` (yeni)

```typescript
// GET — ödeme listesi + KPI toplamları
// assertPermission("finans", "view")
// Query: ?status=success|pending|failed|refunded&from=ISO&to=ISO&q=search
// Supabase: payments JOIN orders JOIN profiles
// Response: { ok, payments: [...], totals: { revenue, pending, refunded, failed } }
```

### Refund API: `src/app/api/admin/payments/refund/route.ts` (yeni)

```typescript
// POST { paymentId, amount?, reason }
// assertPermission("finans", "update")
// Mevcut /api/payment/refund endpoint logic'ini çağır
// İade tutarı ≤ orijinal tutar guard
// audit_log INSERT
```

### Sayfa: `src/app/admin/odemeler/page.tsx` (yeni)

```
┌──────────────────────────────────────────────────┐
│ Ödemeler                                          │
├──────────────────────────────────────────────────┤
│ [4 KPI] Toplam gelir | Bekleyen | İade | Başarısız │
├──────────────────────────────────────────────────┤
│ [Filtre] Status chips + tarih aralık + arama     │
├──────────────────────────────────────────────────┤
│ [Tablo] Tarih | Sipariş | Müşteri | Tutar | Status │
├──────────────────────────────────────────────────┤
│ [Detay panel] PayTR ref + auth code + kart maskeli │
│ [İade başlat] butonu (sadece success'te)          │
└──────────────────────────────────────────────────┘
```

### Sidebar ekle

`AdminShell.tsx` → Yönetim grubunda, "Finans & Raporlar" altına:
```typescript
{ href: "/admin/odemeler", label: "Ödemeler", icon: <Icon.Wallet size={16} />, module: "finans" }
```

`PATH_TITLES`'a ekle: `"/admin/odemeler": "Ödemeler"`

---

## GÖREV 4/8 — Arka Plan Tespiti + Kaldırma

### Dosya: `src/lib/proof/background-detect.ts` (yeni)

Detaylı spec `CURSOR-GOREVLER-AI-EK.md` Görev 1'de var. Özet:

- PNG alpha analizi (sharp ile piksel tarama)
- Beyaz arka plan tespiti: R>240 && G>240 && B>240 && Alpha>245 oranı > %30 → `solid_white`
- Malzeme kontrolü: şeffaf malzeme + beyaz arka plan → `needsRemoval: true`
- JPG → her zaman `hasBackground: true`
- SVG/PDF/AI → atla (POC halletsin)

### Dosya: `src/lib/proof/background-remove.ts` (yeni)

- Solid beyaz arka plan → sharp threshold kaldırma (R>240 && G>240 && B>240 → alpha=0)
- Karmaşık arka plan → Replicate rembg API (`REPLICATE_API_TOKEN` env gerekli)
- Fallback: sharp threshold yöntemi

### Müşteri UX: `src/components/proof/BgRemovalPrompt.tsx` (yeni)

`/onay/[orderId]` sayfasında, arka plan tespit edildiğinde:
- Önce/sonra preview
- "Arka planı kaldır" + "Bu şekilde devam et" butonları

### Orkestratöre entegre

`src/lib/proof/orchestrator.ts` → cutline detect'ten ÖNCE `detectBackground()` çağır.
`needsRemoval` ise → proof_pending'de `BgRemovalPrompt` göster.

---

## GÖREV 5/8 — RGB → CMYK Simülasyon

### Dosya: `src/lib/proof/cmyk-simulate.ts` (yeni)

- sharp `modulate({ saturation: 0.82, brightness: 0.95 })` ile basit CMYK simülasyon
- Simülasyon PNG → Supabase Storage cache
- Renk kayması tespiti: `minor` / `noticeable` / `significant`

### API: `src/app/api/orders/[id]/proof/[itemId]/cmyk-preview/route.ts` (yeni)

- GET → cache varsa döndür, yoksa üret
- Response: `{ simulatedPngUrl, colorShift, affectedAreas }`

### Müşteri UX

`/onay/[orderId]` katman toggle'larına ekle:
```
[🎨 Tasarım] [✂️ Bıçak] [⬜ Beyaz] [🏁 Zemin] [🖨️ CMYK Önizleme]
```

"CMYK Önizleme" açılınca simülasyon PNG gösterilir + colorShift uyarısı.

---

## GÖREV 6/8 — Çoklu Tasarım Tutarlılık

### Dosya: `src/lib/proof/multi-design-check.ts` (yeni)

- Tüm QC sonuçlarını karşılaştır (DPI, renk profili, kalite skoru)
- DPI farkı > 2× → `dpi_mismatch` warning
- Farklı renk profilleri → `color_mismatch` info
- Kalite skoru farkı > 30 → `quality_mismatch` warning

### Entegrasyon

`src/lib/agents/run-order-qc.ts` → tüm QC bittikten sonra:
```typescript
if (qcResults.length > 1) {
  const consistency = checkMultiDesignConsistency(qcResults);
  if (!consistency.consistent) {
    await saveConsistencyWarning(orderId, consistency);
  }
}
```

### Müşteri UX

`/onay/[orderId]` item listesinin üstünde tutarsızlık uyarı banner'ı.

---

## GÖREV 7/8 — Print-Ready PDF Üretimi

### Dosya: `src/lib/proof/print-ready.ts` (yeni)

- pdf-lib ile: tasarım + bleed (2mm) + crop marks + cutline (CutContour spot color) + beyaz (sayfa 2)
- `proof_approved → ready_to_ship` geçişinde otomatik üretilir
- URL → `order_items.print_ready_pdf_url`

### Migration

```sql
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS print_ready_pdf_url text;
```

### Mevcut manifest endpoint güncelle

`/api/admin/print-job/[orderId]/manifest` → her item'a `print_ready_pdf_url` ekle.

---

## GÖREV 8/8 — Pim Chat Yönlendirme + Proof Bağlamı

### 3 yeni tool ekle: `src/lib/pim/personas.ts`

**Tool 1: `redirect_to_configurator`**
```typescript
// Müşteriyi konfigüratöre yönlendir
// Input: { product, material?, shape?, cut?, width?, height?, qty? }
// Output: { type: 'redirect', url: '/sticker/yapilandir?material=transparan', label: '...' }
```

**Tool 2: `redirect_to_order`**
```typescript
// Müşteriyi sipariş/prova sayfasına yönlendir
// Input: { orderId, page: 'detail' | 'proof' | 'upload' }
// Output: { type: 'redirect', url: '/onay/ORDER_ID', label: 'Provayı İncele' }
```

**Tool 3: `get_proof_status`**
```typescript
// Siparişin proof durumunu getir
// Input: { orderId }
// Output: { status, aiVerdict, cutlineIssues, whiteLayerStatus, pimSuggestion }
// Kaynak: orders + proof_validations + cutline_designs
```

### PimChat UI buton render

`src/components/pim/PimChat.tsx` → tool result'ta `type === 'redirect'` ise tıklanabilir buton göster:

```typescript
if (toolResult.type === 'redirect') {
  return (
    <Link href={toolResult.url}
      className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-pim-mercan text-white rounded-lg font-medium hover:bg-pim-mercan/90">
      {toolResult.label}
    </Link>
  );
}
```

### Örnek senaryolar

| Müşteri | Pim tool | Sonuç |
|---|---|---|
| "Şeffaf sticker istiyorum" | `redirect_to_configurator({product:'sticker', material:'transparan'})` | Tıklanabilir buton → konfigüratör |
| "Siparişim ne durumda?" | `get_proof_status({orderId:'00001234'})` | Bağlamla cevap + link |
| "Provamı onaylayacağım" | `redirect_to_order({orderId:'00001234', page:'proof'})` | Tıklanabilir buton → /onay |
| "Kraft etiket 5000 adet" | `redirect_to_configurator({product:'etiket', material:'kraft', qty:5000})` | Buton → konfigüratör |

---

## Uygulama Sırası

| # | Görev | Süre (tahmini) |
|---|---|---|
| 1 | Bakım modu | 30dk |
| 2 | Cron izleme | 2-3 saat (16 dosya güncelle) |
| 3 | Ödemeler sayfası | 1-2 saat |
| 4 | Arka plan tespiti + kaldırma | 1-2 saat |
| 5 | CMYK simülasyon | 45dk |
| 6 | Multi-design tutarlılık | 30dk |
| 7 | Print-ready PDF | 1-2 saat |
| 8 | Pim Chat yönlendirme + proof | 1 saat |

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
