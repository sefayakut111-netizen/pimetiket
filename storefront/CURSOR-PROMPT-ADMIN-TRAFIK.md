# Admin Trafik Dashboard — GA4 Data API (`/admin/trafik`)

## SORUN
Admin panelinde trafik/ziyaretçi verisi görünmüyor. İki ayrı katman var:

1. **AYAR (kod değil — Sefa yapacak):** `.env.local`/Vercel'de `NEXT_PUBLIC_GA4_MEASUREMENT_ID` ve
   `NEXT_PUBLIC_POSTHOG_KEY` **boş** → `src/components/Analytics.tsx` script'i hiç yüklemiyor → şu an
   HİÇBİR yerde trafik toplanmıyor. Bu prompt bunu çözmez; Sefa env'leri girmeli (aşağıda "ÖN KOŞUL").
2. **KOD (bu prompt):** Admin'de trafiği gösteren sayfa yok; GA Data API entegrasyonu hiç yazılmamış
   (`/admin/raporlar` sadece finansa redirect; `admin-analytics.ts` yalnızca sipariş verisi).
   Bu prompt **`/admin/trafik`** sayfasını GA4 Data API ile kurar.

## ÖN KOŞUL (Sefa — kod değil, bu prompt'tan bağımsız)
Bunlar olmadan dashboard "kurulum gerekli" boş durumu gösterir (çökmez):
- **Veri toplama:** GA4 property aç → Measurement ID → Vercel env `NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXX`.
- **Admin'e veri çekmek (Data API):** Google Cloud'da service account → ilgili GA4 property'ye "Viewer" yetkisi →
  JSON key → Vercel env'e: `GA4_PROPERTY_ID`, `GA4_SA_CLIENT_EMAIL`, `GA4_SA_PRIVATE_KEY` (PEM, satır sonları `\n`).

## MİMARİ
- Trafik verisi GA4 Data API'den (server-side, service account) çekilir; istemciye anahtar SIZMAZ.
- Salt-okunur, admin-only. Sipariş/DB'ye dokunmaz. CLAUDE.md sefaRules geçerli.
- Env yoksa graceful "kurulum gerekli" durumu (P0: çökmesin).

---

## ÇÖZÜM — 4 GÖREV

### GÖREV 1/4 — Paket + GA4 Data API istemcisi
- `package.json`'a ekle: `@google-analytics/data` (BetaAnalyticsDataClient).

#### Yeni dosya: `src/lib/analytics/ga4-data-api.ts`
```typescript
import { BetaAnalyticsDataClient } from "@google-analytics/data";

export type TrafficRange = "7d" | "28d" | "90d";

export interface TrafficSummary {
  configured: true;
  range: TrafficRange;
  totals: { activeUsers: number; sessions: number; pageViews: number; avgSessionSec: number; bounceRate: number };
  byDay: Array<{ date: string; users: number; sessions: number; pageViews: number }>;
  topPages: Array<{ path: string; views: number }>;
  sources: Array<{ source: string; sessions: number }>;
}
export interface TrafficNotConfigured { configured: false; reason: string }

function getClient(): BetaAnalyticsDataClient | null {
  const email = process.env.GA4_SA_CLIENT_EMAIL;
  const key = process.env.GA4_SA_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key || !process.env.GA4_PROPERTY_ID) return null;
  return new BetaAnalyticsDataClient({ credentials: { client_email: email, private_key: key } });
}

const RANGE_DAYS: Record<TrafficRange, number> = { "7d": 7, "28d": 28, "90d": 90 };

export async function getTrafficSummary(range: TrafficRange): Promise<TrafficSummary | TrafficNotConfigured> {
  const client = getClient();
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!client || !propertyId) return { configured: false, reason: "GA4 Data API env eksik" };
  const property = `properties/${propertyId}`;
  const startDate = `${RANGE_DAYS[range]}daysAgo`;

  // 3 paralel runReport: günlük seri + top sayfalar + kaynaklar
  // metrics: activeUsers, sessions, screenPageViews, averageSessionDuration, bounceRate
  // 1) byDay  → dimensions: [date]
  // 2) topPages → dimensions: [pagePath], orderBy views desc, limit 15
  // 3) sources → dimensions: [sessionSource], orderBy sessions desc, limit 10
  // (BetaAnalyticsDataClient.runReport ile; sonuçları yukarıdaki tiplere map'le.)
  // ... implement ...
}
```
> Cursor: 3 `runReport` çağrısını yaz, sonuçları `TrafficSummary`'ye map'le. Sayıları `Number(...)` ile parse et.
> `runtime`'da gRPC kullanır → çağıran route **nodejs** olmalı.

**Doğrulama:** env doluyken `getTrafficSummary("28d")` gerçek sayılar döner; env boşken `{configured:false}`.

---

### GÖREV 2/4 — `/api/admin/traffic` route
#### Yeni dosya: `src/app/api/admin/traffic/route.ts`
- `export const runtime = "nodejs";`
- **Admin guard:** `assertAdmin()` (`@/lib/supabase/assert-admin`) — null değilse onun döndürdüğü hata response'unu dön (mevcut admin API deseni).
- Query `range` (7d/28d/90d, default 28d) — zod doğrula.
- `getTrafficSummary(range)` çağır; `not_configured` ise **200** + `{configured:false}` (UI setup state göstersin, hata değil).
- Hata olursa 200 + `{configured:false, reason}` (dashboard çökmesin) + `console.error`.
- Basit in-memory cache (5-10 dk) — GA Data API kotası için (`maintenance-cache.ts` TTL desenine benzer).

**Doğrulama:** Admin değilse 401/403. Admin + env yok → `{configured:false}`. Admin + env var → trafik JSON.

---

### GÖREV 3/4 — `/admin/trafik` sayfası + nav
#### Yeni dosya: `src/app/admin/trafik/page.tsx` (+ gerekirse client `TrafficDashboard.tsx`)
- `assertAdmin()` guard (sayfa seviyesi, diğer admin sayfalarıyla aynı desen).
- `/api/admin/traffic?range=` çağır. Aralık seçici (7/28/90 gün).
- **configured: true** ise:
  - KPI kartları: Aktif kullanıcı, Oturum, Sayfa görüntüleme, Ort. süre, Bounce.
  - Günlük çizgi grafik (`LineChart` — `@/components/charts`).
  - Top sayfalar tablosu + Trafik kaynakları tablosu (veya `BarChart`/`DonutChart`).
- **configured: false** ise: sade "Trafik kurulumu gerekli" kartı + adımlar (GA4 Measurement ID env + Data API service account) — yukarıdaki ÖN KOŞUL metni.

#### Nav: `src/components/layout/AdminShell.tsx`
- `navGroups` içine (Finans yakınına) `{ href: "/admin/trafik", label: "Trafik", icon: <Icon.? size={16} />, module: "dashboard" }` ekle.
- `MODULE`/title map'ine `"/admin/trafik": "Trafik"` ekle (satır ~129 deseni).

**Doğrulama:** Admin nav'da "Trafik" görünür; sayfa env doluyken grafik+tablo, boşken kurulum kartı.

---

### GÖREV 4/4 — Sağlık kontrolü + env örneği
- `.env.example`'a ekle (yorumla): `GA4_PROPERTY_ID=`, `GA4_SA_CLIENT_EMAIL=`, `GA4_SA_PRIVATE_KEY=`.
- `/api/health` `analytics` kontrolüne dokunma (zaten `NEXT_PUBLIC_GA4_MEASUREMENT_ID` bakıyor).

---

## GENEL DOĞRULAMA
1. `tsc --noEmit` temiz; `@google-analytics/data` package-lock'a eklendi.
2. Admin olmayan `/admin/trafik` → erişemez.
3. Env boşken sayfa "kurulum gerekli" gösterir, ÇÖKMEZ.
4. Env doluyken son 28 gün trafik: KPI + günlük grafik + top sayfalar + kaynaklar.
5. Sipariş/finans sayfaları etkilenmedi.

## YENİ/DEĞİŞEN DOSYALAR
Yeni: `src/lib/analytics/ga4-data-api.ts`, `src/app/api/admin/traffic/route.ts`,
`src/app/admin/trafik/page.tsx` (+`TrafficDashboard.tsx`).
Düzenlenecek: `package.json`, `src/components/layout/AdminShell.tsx`, `.env.example`.

## NOT (alternatif)
GA Data API service account kurmak istemezsen, aynı dashboard PostHog API (HogQL + personal API key)
ile de beslenebilir — daha basit kimlik ama metrikler PostHog event'lerine bağlı. İlk sürümde GA4
standart trafik metrikleri için daha doğru.
</content>
