# PostHog Kurulum — Sefa Checklist

> Süre: **5 dakika** · Yarım saatlik veri toplandıktan sonra ilk içgörü gelir
> Maliyet: **Free** (aylık 1 milyon event'e kadar — yeter)

Bu dosya tek seferlik. Tamamladıktan sonra silebilirsin.

---

## 1. Hesap aç (2 dk)

1. https://posthog.com/eu adresine git
   - **EU host şart** (KVKK için zorunlu — veriler Frankfurt'ta saklanır)
2. "Sign up" → email + şifre veya Google login
3. Workspace adı: `Pim Etiket` (canın isterse `pimetiket`)
4. Project tipi: **Web** (Cloud, Free plan otomatik)

## 2. Project key'i al (1 dk)

1. Sol menü → ⚙️ Project Settings → **API Keys**
2. **Project API Key** kopyala — `phc_` ile başlar
3. **Host URL** zaten `https://eu.i.posthog.com` (default)

## 3. Vercel env'e ekle (1 dk)

Vercel dashboard → Pim Etiket projesi → **Settings → Environment Variables**:

| Key | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_xxxxx` (az önce kopyaladığın) | Production, Preview |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://eu.i.posthog.com` | Production, Preview |

**Save** → Vercel otomatik yeni deploy başlatır (~40 sn).

## 4. Doğrula (1 dk)

Deploy tamamlanınca:

1. https://pimetiket.com adresine git
2. F12 → Console → şu satırı yapıştır:
   ```js
   posthog.capture("test_event_from_sefa")
   ```
3. PostHog dashboard → **Activity** → 5-10 sn içinde event görünmeli ✓

## 5. Çerez izni — KULLANICILAR için

PostHog yalnızca **kullanıcı analytics çerez kabul ettiğinde** çalışır
(KVKK + Analytics.tsx zaten bu kontrol içeriyor). İlk ziyarette cookie
banner çıkar → kullanıcı "Analytics çerezlerini kabul ediyorum"
işaretlemezse PostHog yüklenmez.

Senin test için: cookie banner'da Analytics'i işaretle, save et.

---

## Otomatik track ettiğimiz event'ler

Kod tarafı bunları zaten gönderiyor (consent varsa):

| Event | Ne zaman fire eder | Property'ler |
|---|---|---|
| `$pageview` | Her sayfa yüklenmesi | url, referrer (otomatik) |
| `add_to_cart` | Sticker/etiket sepete eklendi | product, material, qty, total |
| `begin_checkout` | /odeme sayfası açıldı | item_count, total |
| `purchase` | Sipariş oluştu | order_id, total, payment_method |
| `admin_bulk_status_changed` | Bulk durum güncelleme | count, new_status |
| `auth_signup_completed` | Email signup (şablon dahil) | source, interests_count |

İleride wiring için hazır event isimleri (`posthog-events.ts`):
- `design_upload_started/completed/failed`
- `proof_approved/rejected`
- `ai_chat_message_sent`
- `review_submitted`
- `coupon_applied`
- `payment_failed`

---

## İlk hafta önerilen dashboard'lar

### Dashboard 1 — Conversion funnel
**Insights → New → Funnels**

Steps:
1. `$pageview` URL contains `/sticker` veya `/etiket`
2. `add_to_cart`
3. `begin_checkout`
4. `purchase`

Sonuç: "100 kişi sticker sayfasına geldi → kaçı sepete ekledi → kaçı checkout açtı → kaçı ödedi"

### Dashboard 2 — Toplam ciro trend
**Insights → New → Trends**

Event: `purchase`
Property: `sum(total)` (Math: Sum)
Group by: day

### Dashboard 3 — En çok kullanılan ürün
**Insights → New → Trends**

Event: `add_to_cart`
Breakdown by: `product` (sticker vs etiket)

### Dashboard 4 — Lead magnet performansı
**Insights → New → Trends**

Event: `auth_signup_completed`
Filter: `source = sablonlar`
Group by: day

---

## A/B test feature flag tanımlama (5 dk)

İlk testimiz: **Sticker CTA varyantları** (`sticker_cta_v2`).

1. PostHog → sol menü → **Feature Flags** → **+ New feature flag**
2. **Key**: `sticker_cta_v2` (ESKİ KULLANMA — kod bunu okuyor)
3. **Description**: "Sticker sayfası CTA — 5-7 gün teslim mesajı testi"
4. **Multiple variants** seç:
   - `control` → Rollout: 50% → Description: "Sepete ekle"
   - `test` → Rollout: 50% → Description: "Sepete ekle · 5-7 günde teslim"
5. **Release conditions**: "Match all users" (filtre yok, herkese aktif)
6. **Save**

2-3 hafta sonra:
- **Experiments → New experiment** → `sticker_cta_v2`
- **Primary goal**: `add_to_cart`
- "Show winner" PostHog otomatik istatistiksel anlamlılığı hesaplar

---

## Maliyet kontrolü

- Free plan: 1.000.000 event/ay
- Aylık ortalama Pim Etiket trafiği için bu RAHATLIKLA yeter
- Kotaya yaklaşırsan PostHog ücretsiz uyarı mail atar — `$5/M` plana geçilir

---

## Sefa için pratik: günlük 5 dk PostHog

Her gün PostHog'a girip şunu sor:
1. **"Dün kaç sipariş?"** → Trends `purchase` event'i, son 24 saat
2. **"En çok hangi sayfada vakit harcıyorlar?"** → Web Analytics → Top pages
3. **"Hangi adımda kayıp veriyoruz?"** → Funnels dashboard'una bak, en yüksek drop-off yüzdesini bul → o sayfa kötü, düzelt

---

## Sorun olursa

Console'da `posthog is not defined` görüyorsan:
- Cookie banner'da Analytics işaretlenmemiş olabilir
- Env'ler doğru ama deploy henüz gitmemiş olabilir (Vercel deploy log'larına bak)
- `NEXT_PUBLIC_POSTHOG_KEY` çevresel değişkende whitespace olabilir (kopyala-yapıştırda boşluk gelir)
- AdBlock kapalı olduğundan emin ol (devekapatma için)

---

Bu kadar. PostHog kuruldu, A/B test hazır, lead magnet sayfası canlı.
Sıradaki adım: 2 hafta veri topla, sonra "en zayıf funnel adımı"nı düzelt.
