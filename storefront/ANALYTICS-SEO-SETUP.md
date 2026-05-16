# Pim Etiket — Analytics + SEO Kurulum Kılavuzu (Sefa için)

> Kod tarafı tamamen hazır (commit `4a0adb2`). Bu dosyada 3-4 hesap açıp
> Vercel env'lerine ekleyeceğin işler var — toplam **15 dakika**.

---

## ✅ Kod tarafı zaten kurulu

- **PostHog** event tracking + A/B test → `eu.posthog.com/project/177669`
- **Sentry** error tracking + source map → `packanalyz-47.sentry.io/pimetiket-prod`
- **Vercel Speed Insights** (Core Web Vitals LCP/CLS/INP) — auto-aktif
- **Vercel Analytics** (free pageview tracking) — auto-aktif
- **Robots.txt** + **Sitemap.xml** dinamik (19 statik + blog dinamik)
- **JSON-LD Organization + WebSite** schema (layout global)
- **JSON-LD Product** schema (etiket + sticker sayfaları)
- **JSON-LD FAQ** schema (/sss)
- **JSON-LD LocalBusiness** schema (/iletisim)
- **JSON-LD Article + BreadcrumbList** schema (/blog/[slug])
- **Open Graph dinamik** — admin/gorseller `og_default` slot yüklerse otomatik
- **7 sayfa özel metadata** (title, description, OG)
- **CSP whitelist** PostHog + Sentry + Google domain'leri için açık

---

## 🟡 SENİN YAPACAĞIN — 4 adım (15 dk toplam)

### 1️⃣ Google Analytics 4 (5 dk)

**Amaç:** PostHog'a paralel olarak Google'ın kendi analytics'i. Türkiye SEO'su
için Google Ads remarketing + Google Search Console entegrasyonu için kritik.

**Adımlar:**
1. https://analytics.google.com adresine git
2. Sol alt **⚙️ Admin** → **Create → Property**
3. Property name: `Pim Etiket`
4. Time zone: `(GMT+03:00) Istanbul`
5. Currency: `TRY`
6. Industry: `Shopping`
7. Business size: `Small`
8. Use case: `Examine user behavior`
9. **Web** platform → URL: `https://pimetiket.com` → Stream name: `Pim Etiket Web`
10. **Measurement ID** kopyala — formatı: `G-XXXXXXXXXX`

**Vercel'e ekle:**
```
https://vercel.com/sefayakut111-netizens-projects/pimetiket-storefront/settings/environment-variables
```
- Add New → Key: `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
- Value: (kopyaladığın `G-XXXXXX`)
- Environments: ✅ Production ✅ Preview
- Save → Redeploy

**Test:**
- Deploy bitince https://pimetiket.com aç
- Cookie banner → Analytics çerez ✅ Kabul et
- GA4 dashboard → Reports → **Real-time** → kendi ziyaretini görmen lazım

---

### 2️⃣ Google Search Console (5 dk)

**Amaç:** Google'da arama sonuçlarında çıkmak için site ownership doğrulama
+ sitemap submit. SEO'nun temel taşı.

**Adımlar:**
1. https://search.google.com/search-console aç
2. **Add property** → **URL prefix** → `https://pimetiket.com`
3. **Verify ownership** seçeneklerinden biri:

   **Yöntem A (en kolay): HTML tag**
   - Sentry verification gibi bir meta tag verir, formatı:
     ```html
     <meta name="google-site-verification" content="abc123..." />
     ```
   - **Sadece `content` değerini kopyala** (abc123... kısmı, max 100 karakter)
   - Vercel env'e ekle:
     - Key: `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`
     - Value: (kopyaladığın content)
     - Environments: Production + Preview
   - Redeploy → Search Console'da **Verify** tuşuna bas → ✓

   **Yöntem B (DNS):**
   - GoDaddy DNS panelinde TXT kayıt ekle (Search Console'un verdiği değer)
   - Daha kararlı (env unutulursa kaybolmaz), ama 5 dk yerine 30 dk sürer (DNS propagation)

4. Verified olduktan sonra **Sitemaps** → "Add new sitemap"
5. URL: `https://pimetiket.com/sitemap.xml`
6. Submit → "Success" → tüm 19 statik + 5 blog yazısı indekslenmeye başlar

**Beklenen sonuç:** İlk 2-7 gün içinde Google site'i indexlemeye başlar.
"Performance" sekmesinden hangi sorgularla site'in çıktığını izle.

---

### 3️⃣ Sosyal medya hesapları — sameAs (2 dk)

**Amaç:** Knowledge Graph + sosyal kanıt için Google'a "bu marka şuralarda
da var" demek.

**Adımlar:**
1. Sosyal medya hesaplarının URL'lerini topla:
   - Instagram: `https://instagram.com/pimetiket` (örnek)
   - X / Twitter: `https://x.com/pimetiket`
   - Facebook: `https://facebook.com/pimetiket`
   - LinkedIn: `https://linkedin.com/company/pimetiket`
   - YouTube: `https://youtube.com/@pimetiket`

2. Hesaplardan **yalnızca aktif olanları** **virgülle ayır**:
   ```
   https://instagram.com/pimetiket,https://x.com/pimetiket
   ```

3. Vercel env'e ekle:
   - Key: `NEXT_PUBLIC_SOCIAL_LINKS`
   - Value: (yukarıdaki virgülle ayrı liste, **HTTPS zorunlu**)
   - Environments: Production + Preview

4. Redeploy → Organization JSON-LD `sameAs` array'i otomatik dolar.

**Henüz sosyal hesap yoksa:** env'i hiç ekleme → `sameAs: []` olarak kalır,
sorun değil. Hesap açtığında ekle.

---

### 4️⃣ Microsoft Clarity (3 dk — opsiyonel, ücretsiz)

**Amaç:** Heatmap + session recording (ekran kaydı). PostHog'da da var ama
Clarity tamamen ücretsiz + Microsoft.

**Adımlar:**
1. https://clarity.microsoft.com aç
2. Google/Microsoft login
3. **+ New project** → Name: `Pim Etiket` → URL: `pimetiket.com`
4. **Get Started** → JS snippet ile başla seçeneği değil, **"Install manually"**
5. **Project ID** kopyala (genelde 10 karakter, `abc123xyz4`)

**Vercel env (gerek değil — kod henüz Clarity entegrasyonu yapmıyor):**
- Şu an kod sadece GA4 + PostHog yüklüyor
- Clarity istersen ben sonra ekleyebilirim, gerek var mı karar ver

**Önerim:** Şimdilik atlayabilirsin. PostHog session replay zaten var.

---

## 🧪 Doğrulama checklist

Tüm env'leri ekledikten + redeploy sonrası:

### GA4 doğrulama
- [ ] pimetiket.com → Console → `gtag !== undefined` true mu
- [ ] GA4 dashboard Real-time → bir kullanıcı görünüyor mu (sen)
- [ ] Network sekmesi → `googletagmanager.com/gtag/js` 200 mü

### Search Console doğrulama
- [ ] `https://pimetiket.com` → sayfa kaynağında `<meta name="google-site-verification" content="..." />` var mı
- [ ] Search Console → Verification ✓ aldın mı
- [ ] Sitemap submit "Success" mu

### Speed Insights / Vercel Analytics
- [ ] Vercel dashboard → Pim Etiket projesi → **Speed Insights** sekmesi → Core Web Vitals verisi akıyor mu
- [ ] Vercel dashboard → **Analytics** sekmesi → pageview akıyor mu

### Rich Results test
- [ ] https://search.google.com/test/rich-results → `https://pimetiket.com` test et
  - Organization + WebSite şemaları geçmeli ✓
- [ ] https://search.google.com/test/rich-results → `https://pimetiket.com/iletisim`
  - LocalBusiness şeması geçmeli ✓
- [ ] https://search.google.com/test/rich-results → `https://pimetiket.com/sss`
  - FAQPage şeması geçmeli ✓
- [ ] https://search.google.com/test/rich-results → `https://pimetiket.com/blog/etiket-baskisinin-on-kontrolu` (veya başka bir blog yazısı)
  - Article + BreadcrumbList şemaları geçmeli ✓

---

## 📊 Hesap özetleri

Setup bitince elinde 4 dashboard olacak:

| Dashboard | URL | Ne işe yarar |
|---|---|---|
| **PostHog** | eu.posthog.com/project/177669 | Custom event tracking, A/B test, funnel analizi |
| **GA4** | analytics.google.com (Pim Etiket property) | Sayfa görüntüleme, demografi, kaynak/medium, Google Ads remarketing audience |
| **Search Console** | search.google.com/search-console | Hangi Google sorgularıyla geliyor, index hatası var mı, tıklama oranı |
| **Vercel Speed Insights** | vercel.com/.../speed-insights | LCP / CLS / INP — Google ranking factor olan Core Web Vitals |
| **Vercel Analytics** | vercel.com/.../analytics | Basit pageview, top pages, referrer |
| **Sentry** | packanalyz-47.sentry.io/pimetiket-prod | Production hatalar, source map'li stack trace |

Sabah PostHog + Search Console'a bakman yeterli — günlük 5 dk.

---

## ⚠️ Notlar

- **Cookie consent:** GA4 ve PostHog **KULLANICI** Analytics çerezini kabul edene kadar çalışmaz (KVKK uyumu). Test ederken kendi tarayıcında "Hepsini kabul et" işaretle.
- **2 hafta veri biriktir:** İlk PostHog Funnel sonucu için. Şu an ölçüm var ama tablo yorumlanmaya yeter veri için 2 hafta lazım.
- **Bing Webmaster Tools** ileride istersen → bing.com/webmaster (5 dk, opsiyonel)
- **Yandex Webmaster** opsiyonel (Türkçe SEO'da %2-3 trafik için)

---

## ❓ Soru olursa

- GA4 measurement ID `G-` ile başlamıyor → property doğru oluşturulmamış, yeniden dene
- Search Console verification fail → meta tag tam doğru içerik mi (kopyalarken bozulma yapma)
- Vercel env'i ekledim ama site eski göstermiyor → Redeploy gerek (env yeni deploy'da aktif olur)

Bu kılavuz tek seferlik — kurulumu yaptıktan sonra silinebilir.
