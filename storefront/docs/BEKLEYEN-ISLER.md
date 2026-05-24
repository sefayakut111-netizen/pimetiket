## 🔜 Denetçi sistemi — sonraki tur (25 May 2026)

> Auditor fix oturumundan (snooze, security RPC, finance cron, digest stale, tokens_used, ApprovalCard deep link) kalan geniş işler.

| # | İş | Öncelik | Not |
|---|---|---|---|
| 1 | **Pim Chat maliyet izleme** | P2 | `design_quality_checks` dışında chat token/cost log tablosu veya mevcut observability; Ai Cost denetçisine Pim Chat kırılımı |
| 2 | **Aksiyon rollback** | P2 | `extend-coupon-expiry`, `cancel-no-design-order`, `block_ip` vb. için reverse handler + admin UI "geri al" |
| 3 | Deploy sonrası smoke | P1 | `node scripts/verify-auditor-fixes.mjs` + Vercel Crons finance `0 6 * * *` |
| 4 | Test ödeme → `tokens_used` | P1 | Yeni QC kayıtlarında kolon dolu mu (eski kayıtlar null kalabilir) |

**Doğrulama script'i:** `scripts/verify-auditor-fixes.mjs`

---


## ✅ 23 Mayıs 2026 — API entegrasyon analizi & dayanıklılık (commit + push)

> **Oturum logu:** [`SESSION-LOG-2026-05-23-API-ENTEGRASYON.md`](../SESSION-LOG-2026-05-23-API-ENTEGRASYON.md)  
> **Teknik detay:** [`docs/API-INTEGRATION-FIXES.md`](API-INTEGRATION-FIXES.md)  
> **Git:** `f58b183` → `origin/main` (`pimetiket`)

| İş | Durum | Referans |
|---|---|---|
| Dış API / OpenAI analiz raporu | ✅ | Oturum log Paket A |
| HTTP timeout katmanı (`lib/http/*`) | ✅ | PayTR, Netgsm, Yurtiçi, Upstash |
| QC pipeline güvenlik sarmalayıcı | ✅ | `run-order-qc.ts` |
| Circuit breaker fail-closed | ✅ | `circuit-breaker.ts` |
| OpenAI timeout + retry | ✅ | chat, QC, cutline |
| Smart Context `integrations` domain | ✅ | `manifest.json`, `integrations.mdc` |
| Agent bağlam kopuklukları giderildi | ✅ | `alsoLoads`, glob fix, keyword fix |
| Commit + push | ✅ | `f58b183` |

### Bugün başarıyla biten — 23 May 2026 (API entegrasyon oturumu)

- ✅ Mimari ve API entegrasyon analizi (salt rapor — risk listesi)
- ✅ `fetchWithTimeout` + `external-timeouts.ts` merkezi katman
- ✅ Ödeme sonrası QC: fatal hata → `human_review` (paid'de takılma önlendi)
- ✅ Cutline vision: hata/limit → 200 + kural-tabanlı fallback
- ✅ Yeni Smart Context domain: **integrations** (14. domain)
- ✅ Cursor rule: `.cursor/rules/integrations.mdc`
- ✅ `npm run context -- --path src/lib/payment/paytr.ts` → order + integrations doğrulandı
- ✅ Git push: `main` @ `f58b183`

### Sıradaki (API oturumundan kalan — deploy sonrası)

| # | İş | Öncelik |
|---|---|---|
| 1 | Smoke test checklist (`API-INTEGRATION-FIXES.md`) | 🟡 deploy sonrası |
| 2 | PDF/vektör gerçek vision QC | 🟢 ürün kararı |
| 3 | Upstash production zorunlu kılma | 🟢 infra |

---

## ✅ 24 Mayıs 2026 — Şema & TypeScript agent altyapısı — **KAPATILDI**

> **Oturum logu:** [`SESSION-LOG-2026-05-24.md`](../SESSION-LOG-2026-05-24.md)  
> **Kalıcı rehber:** [`docs/SCHEMA-TYPES-AGENT-GUIDE.md`](SCHEMA-TYPES-AGENT-GUIDE.md)  
> **Git:** `886933c` + `c8b7d0e` → `origin/main`

| İş | Durum | Referans |
|---|---|---|
| `types.ts` remote regenerate | ✅ | `src/lib/supabase/types.ts` |
| `npm run supabase:types` script | ✅ | `package.json` |
| Modüler domain şema referansı | ✅ | `docs/DOMAIN-SCHEMA-REFERENCE.md` |
| Agent kuralları (sefaRules vs şema) | ✅ | `CLAUDE.md` |
| Kalıcı sistem rehberi | ✅ | `docs/SCHEMA-TYPES-AGENT-GUIDE.md` |
| Manifest `schemaMigrations` alanları | ✅ | `smart-context/manifest.json` |
| TS hata düzeltmeleri (10→0) | ✅ | oturum log Paket B |
| `admin/designs` enum hizalama | ✅ | `design-file-status.ts` |
| `Tables<>` + RPC `as never` (yüksek trafik) | ✅ | oturum log Paket F |
| Auth lookup + admin mail helper | ✅ | `auth-user-lookup.ts`, `admin-recipients.ts` |
| Smoke test checklist | ✅ | `docs/SCHEMA-SMOKE-TEST.md` |
| Mig 085–089 apply script | ✅ | `scripts/apply-migrations-085-089.mjs` |
| Commit + push | ✅ | `c8b7d0e` |

### Tamamlanan — 24 May 2026 (ana + follow-up)

- ✅ `types.ts` remote regenerate (~4053 satır, 89 migration uyumlu)
- ✅ `npm run supabase:types` · `design-file-status.ts` tek kaynak
- ✅ Agent kuralları, Smart Context şema alanları, domain referansı
- ✅ Payment/agents/proof/design `as never` temizliği (~52 dosya, `c8b7d0e`)
- ✅ `profiles.email` hatası giderildi (mailer, notify-sefa, lock-admin-account)
- ✅ Mig apply tooling + smoke test dokümantasyonu

### Deploy bekleyen (bu başlık dışı — infra)

| # | İş | Öncelik |
|---|---|---|
| 1 | Migration **085–089** remote apply + `supabase:types` | P1 deploy |
| 2 | Kalan `as never` (~150 dosya) | P3 teknik borç |
| 3 | Manuel smoke (`SCHEMA-SMOKE-TEST.md`) | P2 deploy sonrası |

---

## 📅 21 Mayıs akşamı — devam edilecek işler

> Bugün ~8 saatlik Resend + sticker akışı testi sonrası mola.
> Detay: `docs/LAUNCH-READINESS-21MAY.md`

### Sıradaki (öncelik sırası)

| # | İş | Durum | Süre | Ne lazım? |
|---|---|---|---|---|
| 1 | **Telefon numarası** (footer + KVKK + iletişim, 6 dosya) | ⏳ bekliyor | 5 dk | Sefa numarayı verecek (aşağıda detay) |
| 2 | **PayTR canlıya geçiş** (test → live env) | ⏳ bekliyor | 10 dk | Vercel env değişimi + Sefa onayı |
| 3 | **Yurtıçi Kargo anlaşma** (USERNAME/PASSWORD) | 🔄 dış bağımlılık | bağımsız | Yurtıçi ile görüşme |
| 4 | **Storage test PNG temizlik** (199 KB, zararsız) | 🟢 opsiyonel | 30 sn | Sefa Dashboard → Storage → design-previews → `73c4bcab.../90213029-...png` sil |
| 5 | **Paraşüt fatura entegrasyonu** | ❌ ileride | — | Sefa hariç tutuyor |

### Bugün başarıyla biten — geri dönmeye gerek yok

- ✅ Resend mail altyapısı (`/admin/mail-health` 3/3 yeşil)
- ✅ Resend uçtan uca canlı test (21 May 19:12 — 2 mail Gmail'e düştü, webhook delivered event geldi)
- ✅ Migration 075, 076, 072 prod'a uygulandı
- ✅ Sticker konfigüratör → sepet → preview kalıcılığı (Pikachu test başarılı)
- ✅ Server-side upload proxy (`/api/cart/upload-preview`)
- ✅ KVKK uyumlu unsubscribe (RFC 8058)
- ✅ 4 P0 launch blocker düzeltildi
- ✅ 7 yeni doküman + 14 commit

---

## 🔐 Admin paneli auth tutarsızlığı (21 May akşam analizi)

**Bulgu:** 23 admin endpoint test edildi (canlı, no auth):

| Kategori | Sayı | Status |
|---|---|---|
| ✅ `assertAdmin` pattern sağlam | 17 | 403 |
| 🟡 Zayıf auth (user check var, admin role check yok) | 6 | 401 |
| 🔴 **PUBLIC — auth yok** | 1 | 200 |

### 🔴 P0 — `/api/admin/settings` GET PUBLIC
```typescript
// src/app/api/admin/settings/route.ts
export async function GET() {  // ← AUTH CHECK YOK
  // sızan veri: kargo ücreti, kredi miktarı, updated_by user_id (PII leak)
}
// PATCH'te assertPermission var, GET unutulmuş
```
**Fix:** GET fonksiyonuna 3 satır `const auth = await assertAdmin(); if (!auth) return forbidden;` ekle.

### 🟡 P1 — 6 endpoint zayıf auth (RLS bağımlı, tutarsız)

| Endpoint | Sayfa |
|---|---|
| `/api/admin/customer-stats` | `/admin` dashboard |
| `/api/admin/funnel-metrics` | `/admin` dashboard |
| `/api/admin/reviews` | `/admin/yorumlar` |
| `/api/admin/backups` | `/admin/yedekler` |
| `/api/admin/product-cards` | `/admin/urunler` |
| `/api/admin/kvkk-requests` | `/admin/kvkk-talepleri` |

Sadece `supabase.auth.getUser()` çağırıyor, admin role check yok. RLS reddetse de tutarsızlık + saldırı yüzeyi.

**Fix:** Her birini `assertAdmin` pattern'ine çevir (~15 dk toplam).

**Veri akışı kopukluğu:** YOK — tüm admin sayfaları doğru endpoint'lere bağlı, fetch'ler doğru target'a gidiyor. Sorun **veri akışı değil, güvenlik tutarsızlığı**.

**Detay:** Bu analiz `LAUNCH-READINESS-21MAY.md`'ye eklenmedi — Sefa "şimdi yapma, note al" dedi. Acil değil ama launch öncesi düzeltilmeli.

---

## 🔍 SEO Sprint — yarım kaldı (21 May akşam)

**Detay:** `docs/SEO-DURUM-21MAY.md` (full rapor)

**Yapıldı (commits c0c0340, 9022e4e, 1d26084):**
- og:image dinamik üretim (/etiket 40KB ✅, /sticker 72KB ✅)
- Schema.org Product (/etiket + /sticker)
- Organization zenginleştirme (legalName + vatID + tam adres)
- ISR (TTFB 1.2s → 0.4s)

**Bekleyen:**
- 🟡 Anasayfa og:image v3 verify (deploy yeni) — ScheduleWakeup ile otomatik
- 🟠 **A seçeneği:** `/admin/ayarlar`'a SEO/iletişim sekmesi (30 dk)
  - Migration 078: `site_settings`'e 7 yeni kolon (social_*, phone, support_email)
  - layout.tsx env yerine DB'den okur
  - Schema sameAs + contactPoint otomatik dolar
- 🟢 Sefa: `NEXT_PUBLIC_SOCIAL_LINKS` env (geçici, A yapılırsa gereksiz)
- 🟢 Sefa: `/admin/gorseller` → og_default slot özel görsel yükleme (opsiyonel)

**Sefa kararı:** "şimdilik beklesin" — başka konuya geçildi (21 May akşam).

### Akşam başlarken neye bak

1. **`docs/LAUNCH-READINESS-21MAY.md`** — bugünkü iş özeti
2. **`docs/MIGRATIONS-APPLIED.md`** — DB apply durumu
3. **`docs/BEKLEYEN-ISLER.md`** (bu dosya) — sıradaki adımlar
4. **Vercel** → en son deployment "Ready" mi?
5. **/admin/mail-health** → 3/3 yeşil duruyor mu?

---

## 🔴 Acil (yasal)

### Telefon numarası eklenmesi
**Risk:** Mesafeli Sözleşmeler Yönetmeliği m.5/1-a satıcı telefon bilgisini
"açık ve anlaşılır" şekilde istiyor. Şu an sitede telefon yok — tüketici
şikayetinde eksik bilgilendirme olarak değerlendirilebilir.

**Bilgi geldiğinde aşağıdaki dosyalara ekle:**
- `src/components/layout/Footer.tsx` — şirket iletişim bloğu
- `src/app/iletisim/page.tsx` — iletişim kanalları listesi
- `src/app/mesafeli-satis/page.tsx` — SATICI bilgileri bloğu (m.1)
- `src/app/on-bilgilendirme/page.tsx` — SATICI bilgileri (m.1)
- `src/app/kvkk/page.tsx` — Veri Sorumlusu iletişim
- `src/lib/mail/templates.ts` — sipariş onay/iade mail imzaları

**Hatırlatma:** Sefa telefon numarasını aldığında bu listedeki 6 dosya tek
seferde güncellensin. WhatsApp linki de aynı numaradan yönlendirilecekse
İletişim sayfasında da WhatsApp blok aktif olur (bkz. P2 #9).

---

## 🟠 Önemli (yasal/teknik — bilgi/karar gerek)

### AI sohbet açık rıza modal (KVKK m.9)
**Şu an:** Pim sohbeti açıldığında otomatik kabul varsayılıyor.

**Yapılması gereken:** İlk sohbet öncesi modal:
> "Bu sohbet OpenAI (ABD)'ye veri aktarır. Sohbet içerikleri yapay zekayla
> işlenir. Kabul ediyor musun?"
> [Kabul Ediyorum] [Vazgeç]

Kabul → localStorage `pim_ai_chat_consent_v1` = true. Sonraki sohbetler
sessizce açılır. Vazgeç → modal kapanır, sohbet açılmaz.

**Risk:** KVKK Kurulu denetiminde "açık rıza" tanımına uymuyor.

### Çerez bandı varlık kontrolü
**Şu an:** Çerez bandı görünmüyor (Sefa raporu). GA4/PostHog rıza
olmadan çalışıyorsa KVKK ihlali.

**Doğrula:**
1. Incognito mode'da /anasayfa aç — çerez bandı çıkıyor mu?
2. Eğer çıkmıyorsa: çerez bandı componenti eksik veya rıza state'i
   yanlış default true.
3. "Reddet" butonu "Kabul" kadar erişilebilir mi (WCAG)?

**Çözüm:** `src/components/CookieBanner.tsx` mevcut mu kontrol et + RootLayout'a
ekle. GA/PostHog init rıza state'inden sonra.

### Pim chatbot canlı yanıt kontrolü
**Sefa raporu:** Pim "şablon yok" diyor ama /sablonlar var; "Canva'da RGB
bırak" diyor (yanlış — CMYK doğru).

**Personas dosyası DOĞRU** (src/lib/pim/personas.ts line 137, 161-173).
Canlı yanıt sorunu varsa:
- OpenAI API yanıt çeşitliliği (temperature)
- System prompt'ta personas.ts gerçekten kullanılıyor mu?
- Konuşma geçmişi /sohbet hangi sayfada açılıyor — örnek diyaloglar
  hardcoded ise temizle.

### Pim AI cevaplarına test soruları
1. "Hazır şablon var mı?" → Doğru cevap: "/sablonlar'da 60+ şablon var"
2. "Canva'da CMYK yok ne yapayım?" → Doğru: "RGB indir, biz çeviriyoruz,
   %5-10 sapma olağan"
3. "Etiket kaç günde gelir?" → Doğru: "10 iş günü kargoya verilir"
4. "Sticker kaç günde gelir?" → Doğru: "5 iş günü kargoya verilir"

---

## 🟢 İyileştirme (zaman bulduğunda)

- Galeri sayfası gerçek içerikle dolsun (boş + tek yorum "öne çıkan" eksik)
- Blog "1 dk okuma" göstergesi içerik uzaması ile otomatik düzelir
- Anasayfa "Nasıl çalışır" akış sırası: "Konfigüre → Öde → Tasarımı yükle
  → Provayı onayla → Teslim al" (eski "yükle → öde" çelişkisi)

---

## 🔴 Admin denetim raporu (21 May 2026 — production debug gerek)

### Müşteriler CRM API (P0 #3 — production-only sorun?)
**Frontend + Backend kod tutarlı**, DB'de `v_admin_customers` view'da 3 müşteri var,
service_role çağrı yapıyor. Lokalde çalışıyor görünüyor.

**Sefa production'da "Müşteri verisi şu an çekilemiyor" hatası alıyor.**

**Sefa için debug playbook (öncelik sırasıyla):**

**1. Tarayıcı DevTools — Network tab (en hızlı yol):**
   - `/admin/musteriler` sayfasını aç
   - Network filtre `customers` yaz
   - `/api/admin/customers` request'in **Response** body'sine bak — JSON içinde `code` ve `detail` field'ları var
   - **Bu JSON'u kopyala bana paste'le, 30 saniyede çözerim**

**2. Vercel Functions log:**
   - Vercel dashboard → Project → Functions
   - `/api/admin/customers` arat
   - Son hata satırı: `[admin/customers] view query failed: ...`

**3. ENV vars kontrol:**
   - Vercel Project Settings → Environment Variables
   - Production scope'da olmalı:
     - `SUPABASE_SERVICE_ROLE_KEY` ✓
     - `NEXT_PUBLIC_SUPABASE_URL` ✓
   - Eksikse Supabase Dashboard → Settings → API → service_role key kopyala, Vercel'e ekle, **yeniden deploy**

**4. Migration 046 view (en az olası):**
   - Supabase SQL Editor: `select count(*) from v_admin_customers;`
   - Hata dönüyorsa view eksik → `npx supabase db push --linked`
   - 0 dönüyorsa view var ama veri yok (boş prod DB) — beklenen davranış

**Beklenen 3 olası code:**
   - `42P01` → view yok, Migration 046 push gerek
   - `42501` → permission denied, service role key yanlış
   - generic 500 → view stale (üst migration'lar şemayı değiştirdi)

Düzelme: Sefa Network tab'dan response JSON paylaşana kadar bekliyor.

## 🟠 Admin P1/P2 düzeltmeleri — TAMAMLANDI (21 May 2026 v68)

Tüm admin denetim P1+P2 (P2 #12 PayTR hariç) commit'lendi:
- ✅ P2 #9 KDV, #10 city normalize, #11 üretim toplam, #13 sidebar badge
- ✅ P2 #14 kronolojik sort, #15 İadeler tab/stat, #16 separator, #17 breadcrumb
- ✅ P2 #18 HOSGELDIN10 TR locale
- ✅ P1 #5 Kargo empty state, #6 Tasarımlar loading, #7 Ürünler skeleton, #8 Aboneler skeleton

P2 #12 PayTR aktif değil ama Kart %100 — **Sefa kararı: bu alana dokunulmadı** (manuel test sonrası ele alınacak).

---

## 🔴 Site denetim raporu (21 May 2026 v68) — ATLANAN/NOT EDİLEN

### DB encoding cleanup (Site P0 #1 takip)
**Sorun:** /etiket ve /sticker liste sayfalarındaki kart başlık/açıklamaları DB'de bozuk Türkçe karakter ("�zel", "Sil�etine") olarak saklı. Migration 074 INSERT encoding hatası.

**Yapılan:** Client-side guard eklendi (page.tsx) — bozuk karakter algılanırsa fallback hardcoded array kullanılıyor, kullanıcı bozuk metin görmüyor.

**Bekleyen:** Migration 075 — `product_cards` tablosundaki bozuk satırları UPDATE ile düzelt. Sefa onayı sonrası uygulanacak. Pattern:
```sql
UPDATE product_cards SET title_tr = '...doğru metin...' WHERE id = '...';
```

### Bumper render bug (Site P2 #18)
**Sorun:** `/sticker/yapilandir?form=&shape=bumper` URL'inde sayfa render olmuyor, sadece comment article dönüyor.

**Reprod gerek:** Lokalde tekrarlanmadı (cutMode=diecut default, shape=bumper valid). Production'da test edilmeli — belki SSR cache veya hidration sorunu.

### /yorumlar ve /galeri içerik dolumu
**Sorun:** Her iki sayfa da DB'den çekiyor, gerçek müşteri verisi gelene kadar boş kalıyor.

**Karar:** Boş state'leri açıklayıcı — fallback yok (TKHK m.61 yanıltıcı reklam riski). İlk gerçek yorum/galeri öğesi gelince otomatik dolar. Geçici nav gizleme YOK (Sefa istemedi).

### Şablonlar 60+ tutarlılık (Site P1 #10)
**Sorun:** "60+ hazır şablon" ifadesi 3 yerde yazılı ama 12 kategoride somut sayım yapılmamış.

**Karar:** "60+" pazarlama ifadesi, gerçek şablon sayısı arttıkça güncellenecek. Şu an müdahale edilmedi.

---

## 🟢 Ürün denetim raporu (21 May 2026 v68) — TAMAMLANDI

24 madde commit'lendi (acea2b1 + 9aba1fe + fc931e6):
- ✅ P0 #1 tabaka özet sarım/rulo, #2 Bumper preset, #3 oval label, #4 sticker dinamik boyut, #5 ?material= pre-select
- ✅ P1 #6 Şeffaf "şekil" fix, #7 Title Case, #8 material default seffaf, #10 deliveryEstimate saat sıfırlama, #11 savings tooltip, #12 binlik ayraç
- ✅ P2 #14 sticker title, #15+16 Tabaka Sticker, #18 default qty 250, #19 köşe tooltip, #20 schema TR, #21 "Açık ve net", #22 slider tic, #24 adedi yazım

**Atlanan:** #9 rulo varyant fiyat (shape fiyatı kasıtlı etkilemiyor — material #6 ile çözüldü), #13 footer parens (kod doğru — cache görüntü), #17 default boyut Bumper farklı (kasıtlı), #23 kart açıklamaları admin DB'den (manuel Sefa).

---

## 🟢 Konfigüratör denetim raporu (21 May 2026 v68) — TAMAMLANDI

10 madde commit'lendi (fc931e6 + bu commit):
- ✅ P0 #1 sessiz fail (touched temizlenince toast düzgün çalışıyor), #2+#10 touched vs unlocked ayrımı (kendi bug fix'im), #4 PriceCard "Tahmini fiyat" uyarı bandı
- ✅ #5 Önizleme görselleri — shape'e göre dinamik render (circle Ø, oval ellipse, square eş kenar, bumper özel pad, kiss-cut taşıyıcı kağıt, diecut dashed outline, transparan checker, sketch mode showBrand=false)
- ✅ P1+P2 #3 FormSection inert, #6 sticky bar aria-label, #7 Ø format, #8 geçersiz URL toast

**Atlanan:** #9 Kaplama/Yüzey terminoloji (kasıtlı farklı kavramlar — Sefa kararı).

---

## 🟡 Site denetim P2 #18 takip — Bumper render bug
**Durum:** Lokalde reprod edilemedi. Sefa "/sticker/yapilandir?form=&shape=bumper sayfası kopuk" demişti — şu an URL routing fix'leri (P0 #2, konfigüratör #2) sonrası test edilmeli. Production'da hâlâ varsa SSR cache veya hidration sorunu.

---

## 🟠 Sistem denetim #2 — Yuvarlak Rulo Etiket malzeme listesi farklı (admin içerik)
**Tespit:** Yuvarlak Rulo Etiket konfigüratöründe malzemeler "Kuşe / Beyaz semi-glos / Metalik / Şeffaf Etiket" — diğer rulo varyantlarında "Kuşe / Opak PP / Şeffaf / Metalize". **Opak PP yok**, isimler farklı.

**Sebep:** Material isimleri `adminText("material", id, "name")` ile admin `live_config`'ten override geliyor. Yani DB'de Sefa'nın `/admin/fiyatlar` sayfasından girdiği isimler.

**Kod bug değil — içerik:** Sefa muhtemelen admin'de 1-2 malzeme adını manuel değiştirmiş veya yuvarlak için ayrı config oluşturmuş.

**Aksiyon:** Sefa `/admin/fiyatlar` → "etiket_rulo" scope → Materials sekmesinden 4 malzeme adını normalize etmeli:
- `kuse` → "Kuşe Etiket"
- `beyaz` → "Opak PP Etiket"
- `seffaf` → "Şeffaf Etiket"
- `metalik` → "Metalize Etiket"

Default JS array zaten bu isimleri taşıyor, admin override'ı silmek de yeter (boş `name` field).
