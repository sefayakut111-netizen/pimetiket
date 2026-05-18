# Pim Etiket — Yol Haritası

**Son güncelleme**: 18 Mayıs 2026 — gece (24 commit, ~9.500 satır)
**Aktif branch**: `main` (production)
**Domain**: pimetiket.com (Vercel auto-deploy)

---

## 🌙 18 Mayıs 2026 — GECE TURU (Backend + Operasyon paketi)

24 commit, 9.500+ satır kod, 4 Supabase migration, 8 yeni API endpoint, 6 yeni UI sayfa.

### Commit listesi (kronolojik):

```
4de8a0a feat(r2): Cloudflare R2 cold storage altyapısı
adc1c46 fix(r2-migration): Pim Etiket schema uyumu
560805a fix(r2-client): EU endpoint + checksum WHEN_REQUIRED
5bf1a9d fix(r2): forcePathStyle=true + restore helper
8927c3e feat(admin): /admin/arsiv paneli (R2 cold storage)
0665175 feat(bot): Playwright E2E hata-tarayıcı (sonra iptal)
e973af8 feat(shipping): Yurtiçi Kargo SOAP entegrasyon (Migration 052)
f9c7e2e feat(admin): /admin/kargo paneli Faz 1+2
425fb83 feat(shipping): Faz 3 — TR tatil + il dağılımı + histogram
18fcdf8 fix(cro-audit): 5 kritik düzeltme (admin band + taslak vb)
9729d6b feat(admin): sepet min/max + Cmd+K palette
9682247 feat(admin): 10+ fix (2FA + RBAC altyapı + R2 token vb)
ba4b732 feat(admin): kalan denetim (360° + CSV + AI QC tur + breadcrumb + URL state)
```

### Yeni paketler

#### 1) Cloudflare R2 Cold Storage (Migration 051)
- 90+ gün hareketsiz müşteri Supabase → R2 transfer
- `archive_status` enum + `archive_events` audit + RPC fonksiyonlar
- `r2-client.ts` + `archive-service.ts` + `restore-service.ts`
- `/admin/arsiv` paneli + `/admin/arsiv/[userId]` detay
- Müşteri tarafı `RestoreArchivedFileButton`
- KVKK silme endpoint
- Vercel cron `30 3 * * *` + DRY_RUN flag güvenli mod
- **CANLI** — Bucket `pim-etiket-archive` EU jurisdiction'da

#### 2) Yurtiçi Kargo SOAP Entegrasyonu (Migration 052)
- `src/lib/shipping/yurtici-api.ts` SOAP client (TypeScript)
- 8 normalize status (created/picked_up/in_transit/out_for_delivery/delivered/failed/returned/cancelled)
- `shipment_status_events` tablo + idempotent unique constraint
- 2 RPC: `fn_get_my_shipment_timeline`, `fn_get_shipment_poll_candidates`
- Cron `/api/cron/poll-shipments` her 4 saatte
- Admin manuel tracking form (`/admin/siparisler/[id]`)
- Müşteri timeline UI (`/siparis/[id]`)
- **HAZIR** — `YURTICI_USERNAME` + `_PASSWORD` env gelince DRY_RUN=false yapılacak

#### 3) Kargo Paneli (3 faz)
- **Faz 1+2**: 6 KPI kart + filter + tablo + bulk action + detay + override modal
- **Faz 3**: TR resmi tatil takvimi (2026-2027) + il bazlı dağılım treemap + teslim süresi histogram
- 4 backend API: list / stats / bulk-poll / override
- `ShipmentTrendChart` + `GeoDistributionTreemap` + `DeliveryHistogram` SVG component'ler
- `src/lib/turkey-holidays.ts` (ulusal + Ramazan + Kurban)
- `deliveryEstimate()` artık resmi tatilleri atlıyor

#### 4) CRO Denetim Düzeltmeleri (5 kritik)
- **ViewModeBanner** public sızıntı fix (cookie + auth + role triple-check)
- **Yasal sayfalar** taslak uyarısı kaldırıldı (LegalLayout)
- **Sticker mockup CTA** kaldırıldı (DesignDropZone misafir block)
- **Preset ölçü** input pulse feedback (700ms ring animasyonu)
- **Pim AI KB** komple yenilendi (Canva CMYK politikası + 14 site sayfa indeksi + acele baskı YOK + 500 TL kargo)

#### 5) Sepet Min/Max + Cmd+K (Migration 053)
- `site_settings` + `min_order_total_try` + `max_order_total_try` kolonları
- Sepet sayfası uyarı kutuları + ödeme butonu disabled
- `AdminCommandPalette` component — global ⌘K arama, diakritik tolerans

#### 6) Admin UX/Ops Denetim (Migration 054 RBAC)
- **2FA TOTP** enrollment (Supabase MFA) + `/admin/profil` sayfası
- **RBAC altyapı**: 5 rol enum (super_admin/operations/customer_service/production/content_editor) + permission matrix + `fn_has_permission` RPC + `assertPermission()` helper
- **Yedek R2 Access Denied** fix (EU endpoint)
- **Dashboard yatay kayma** fix (auto-fit grid)
- **Sipariş simülatörü** production flag (`NEXT_PUBLIC_ALLOW_SIMULATOR`)
- **Müşteriler query_failed** friendly error + retry
- **Raporlar MOCK DATA** banner
- **İade SLA** yaş rozeti (<24h yeşil / 24-72h sarı / >72h kırmızı)
- **Sidebar İÇERİK** kategorisi yeni (Aboneler + Galeri + Site Görselleri)

#### 7) Müşteri 360° + Tablo İyileştirmeleri
- Müşteri detay sayfası sticky scroll-anchor nav (4 tab)
- Sipariş tablosu sticky thead + bulk CSV indir
- AI QC empty state mikro tur (4-step + 4 ipucu)
- `AdminBreadcrumb` component tüm sayfalarda
- Sipariş filter URL state sync (?status= + ?q=)

---

## 📚 18 Mayıs 2026 — GÜNDÜZ TURU

Tek gün boyunca **12 commit, ~5.000+ satır kod** değişikliği. Konfigüratör tam revizyon + SSS + koruma katmanı + kritik içerik düzeltmeleri.

### Konfigüratör Büyük Revizyon (commit f4c4561)
- **Yeni canlı önizleme sistemi**:
  - `ProductPreviewShell` ortak kabuk (Canlı önizleme rozeti, BOYUT chip, 3D/Eskiz toggle)
  - `EtiketLivePreview` + `StickerLivePreview` aile component'leri
  - 3D ↔ Eskiz toggle (gerçekçi mockup ↔ matbaa diyagramı)
  - Karga maskotu default placeholder (her hücrede, "Pim Etiket" yazı)
  - Kontur kesim → karga silüeti + uniform white outline (8-yön drop-shadow)
- **SVG kütüphanesi**:
  - 17 surface dokusu (kuşe, kraft, ultra clear, metalik, holografik, simli, soft touch, mat/parlak selefon, sıcak yaldız, spot UV, emboss vs.)
  - roll-icon + sheet-icon (etiket türü kartları)
  - `pim-etiket-mark-with-text.svg` dikey lockup (karga + "Pim Etiket" tek dosya, garantili orantı)
- **Reusable component'ler**:
  - `MaterialSwatch` (SVG fit cover/contain + aspect-[2/1])
  - `PopulerBadge` (corner + inline variant)
  - `InfoTooltip` (React Portal → body, z-9999)
- **UX uzman düzeltmeleri**:
  - Stepper "ŞU AN" redundancy temizlik
  - Disabled FormSection WCAG kontrast (opacity 0.4 → 0.6)
  - BOYUT chip pill (buton görünümü kaldırıldı)
  - Dosya sayacı dinamik (0/1 → 0/N çelişkisi)
  - Birim fiyat 4 → 2 ondalık ("2,5079 TL" → "2,51 TL")
  - QtySlider logaritmik tick'ler
  - CTA hiyerarşi (Giriş yap → secondary outline)
  - Mobile sticky horizontal stepper
  - Mobile chat butonu sticky CTA z-index fix
- **Kart grid parity**:
  - Etiket malzeme 3 kolon, kaplama/özelleştirme 4 kolon
  - Sticker malzeme yatay → dikey + 4 kolon
- **Tabaka geometri**:
  - SRA3 (320×450 mm) baz alındı, rotation seç
  - Pricing engine geometry expose
- Düz köşe → tam keskin (radius 0)
- Özel oran şekli → otomatik bumper boyut (100×40)
- "Tabaka yerleşimi" form'u kaldırıldı (admin tarafı)

### SSS Sayfası Genişleme (commit af45297)
- **5 kategori 15 soru → 11 kategori 73 soru**
- Hibrit format: 1 cümle özet + Detay expand
- Schema.org FAQPage JSON-LD (Google rich snippet)
- URL hash navigation (`/sss#siparis`)

### Koruma Katmanı (commit 82d5360)
- **Frontend caydırıcı**:
  - `CopyProtection` component (DevTools detect + agresif console uyarısı)
  - `ProductPreviewShell` watermark (mockup'larda diagonal `© pimetiket.com`)
  - Source maps disable production
- **Hukuki**:
  - `/sartlar` §5 Fikri Mülkiyet ve Kopyalama Yasağı (FSEK 5846 + Sınai Mülkiyet 6769)
  - `/telif-sikayet` yeni sayfa (DMCA-benzeri self-service)
- **AI/SEO scraper engelleme**:
  - robots.txt: GPTBot, anthropic-ai, ClaudeBot, CCBot, PerplexityBot, AhrefsBot, SemrushBot vs.
- **Not yapılmadı (Sefa kararı)**: Sağ tık disable + text selection disable (müşteri içerik kopyalayabilmeli)

### İçerik Düzeltmeleri
- **Anasayfa SSS** (commit f3c5a75, f5492b7): "Acele baskı" yanıltıcı, kaldırıldı
- **Tasarım yardımı** (commit 138db04): Canva, Adobe Express, Figma yönlendirme
- **Üretim süreleri NET** (commit 3c0c535): Etiket 10 / Sticker 5 iş günü (resmi tatiller hariç)
- **SSS resmi + SEO ton** (commit 13c6631): 6 kategori (sipariş, üretim, fiyat, iade, KVKK, yardım) — 37 cevap yeniden yazıldı
- **İletişim sayfası sadeleşme** (commit f5492b7): Atölye/yasal merkez/randevu/yanıt saatleri kaldırıldı, sadece "Mesai saatleri: Hafta içi 09:00-18:00"
- **Bildirim tercihleri** (commit b2eb82d): SMS "Acil sipariş" + "Prova bekliyor" iptal, Faz 2 Resend yazısı kaldırıldı, toggle UI fix
- **3 söylem bölümü kaldırıldı** (commit 80d4357): Etiket/sticker'da yanlış "3-5 iş günü kargo / Acil mi" söylemi gitti

### Pim Chat UX (commit fdc5222)
- Teaser balon pointer vertical-center
- × kapat tap target 20×20 → 32×32 (WCAG 2.5.5)
- Sticky CTA ile uyumlu pozisyon (`--sticky-cta-h` CSS variable)
- SVG triangle pointer (rotate ring çirkinliği gitti)

---

## 🎯 Net Kurallar (Bundan Sonra Geçerli)

| Konu | Kural |
|---|---|
| **Üretim süresi** | Etiket 10 iş günü · Sticker 5 iş günü (resmi tatiller hariç) |
| **Acele baskı** | YOK. Sabit süreler, kalite politikası |
| **Kargo firması** | Sadece Yurtiçi Kargo |
| **Kapıda ödeme** | YOK |
| **Hızlı/premium kargo** | YOK |
| **Atölye ziyareti** | YOK |
| **Telefon hattı** | YOK (2026 Q2'de açılacak) |
| **Mesai saatleri** | Hafta içi 09:00-18:00 (AI sohbet 7/24) |
| **Tasarım yardımı** | Pim AI öneri + Canva/Adobe/Figma yönlendirme |
| **Minimum adet** | Etiket rulo 1.000 · Etiket tabaka 250 · Sticker 25 |
| **Tabaka boyutu** | SRA3 (320×450 mm) |
| **KDV** | %20 dahil her zaman |
| **Cayma hakkı** | TKHK m.15/b — özel üretim, yok (bizim hatamızsa ücretsiz yeniden basım) |
| **3D Secure** | Tüm ödemeler, PayTR PCI-DSS scope dışı |
| **Karga maskotu** | Tüm önizlemelerde lacivert (mark-dark), zemine göre değişmez |

---

## 🧊 18 Mayıs 2026 — R2 Cold Storage Paketi

90+ gün hareketsiz müşterinin Supabase verisi → Cloudflare R2 cold storage'a otomatik transfer. KVKK silme talebine R2 cleanup eklendi. DRY_RUN flag ile güvenli başlangıç.

### Yapılan iş

- **Migration 051** (`051_r2_archive_columns.sql`):
  - `archive_status` enum (`hot`, `archiving`, `cold`, `restoring`, `deleted`)
  - profiles + orders + design_files + reviews + returns tablolarına `archive_status` + `archived_at` + `archive_path` kolonları
  - design_files'a ek `archive_size_bytes`
  - `archive_events` audit tablo (KVKK uyumlu — 5+ yıl saklanır, RLS admin/staff read)
  - `get_archive_candidates(p_days_inactive int)` RPC fonksiyonu (90 günden eski müşterileri listele)
- **`src/lib/storage/r2-client.ts`**:
  - AWS SDK v3 S3Client lazy init
  - `IS_DRY_RUN` flag (env `R2_ARCHIVE_DRY_RUN` default `"true"` — sahte yanıt döndürür, gerçek I/O yok)
  - `uploadToR2`, `getSignedDownloadUrl`, `downloadFromR2`, `deleteFromR2`, `getR2ObjectInfo`, `listR2Objects`
  - `r2KeyBuilders` (customerSnapshot, orderDetails, orderEvents, designFile, vb. tutarlı path şeması)
- **`src/lib/storage/archive-service.ts`** (`archiveCustomer(userId, reason)`):
  - 8 adım: lock → profile snapshot → orders+events → design files (Supabase Storage → R2) → reviews → returns → status update → audit log
  - Rollback: hata olursa `archive_status = 'hot'` geri + `failed_archive` audit
  - DRY_RUN aware her aşamada
- **`src/lib/storage/restore-service.ts`**:
  - `getArchivedDesignFileUrl({designFileId, requesterId, requesterType, reason, ttlSeconds})` — 1 saatlik signed URL
  - Yetki: user → kendi dosyası, admin/cowork → tüm
  - `cold_access` audit log
  - `restoreCustomerToHot(userId, reason)` — profil + orders + reviews + returns geri sıcağa
- **API endpoint'ler**:
  - `POST /api/customer/design-files/[id]/restore-url` — müşteri taraf, signed URL döndürür
  - `POST /api/customer/kvkk-archive-delete` — KVKK m.11/e gereği R2 arşiv tam silme (admin başkası adına da yapabilir)
  - `GET /api/cron/archive-inactive` — günlük cron (03:30), Bearer ${CRON_SECRET}, BATCH_SIZE=10, DAYS_INACTIVE=90, runtime nodejs, maxDuration 300s
- **`src/components/storage/RestoreArchivedFileButton.tsx`**:
  - Müşteri sipariş detayında `archive_status === "cold"` ise gösterilir
  - Saman/amber styled kart + 📦 ikon + 2-3 saniye getirme mesajı
  - Loading state + toast (başarı/hata)
- **`vercel.json`**: `"30 3 * * *"` cron eklendi (mevcut "0 3" ile çakışmayı önlemek için)
- **Test scriptleri**:
  - `scripts/test-r2-archive.mjs` — DRY_RUN modda arşivleme testi
  - `scripts/test-r2-restore.mjs` — signed URL üretim testi

### Sefa'nın yapması gerekenler (R2 canlıya almadan önce)

1. **Cloudflare R2 hesap aç** (free tier: 10 GB depo + 1M class A op + 10M class B op/ay)
2. **Bucket oluştur**: `pim-etiket-archive` (production) + `pim-etiket-archive-dev` (test)
3. **API token üret**: Object Read & Write permission, bucket-scoped
4. **Vercel env vars set**:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET=pim-etiket-archive`
   - `R2_ARCHIVE_DRY_RUN=true` (önce true ile başla, smoke test sonra `false` yap)
   - `CRON_SECRET` (rastgele 32+ karakter, cron auth için)
5. **Migration 051 push**: `npx supabase db push --linked` (workspace'te)
6. **DRY_RUN smoke test**: `node scripts/test-r2-archive.mjs <test_user_uuid>` — log basılmalı, gerçek silme yok
7. **DRY_RUN=false** yap → 1 test müşterisinde gerçek arşivleme dene
8. **Production**: Otomatik cron 03:30'da çalışacak

### Kalan iş (kod tarafı)

- Sipariş detay sayfasında `RestoreArchivedFileButton` koşullu render
- `/admin/arsiv` paneli (archive_events listesi + manuel "şimdi arşivle/geri getir" butonları)
- Email bildirimi: müşteri restore istediğinde otomatik mail (Resend Faz 2 ile birlikte)

---

## 🗺️ Bundan Sonra Yol Haritası (18 May gece güncel)

### 🔴 P0 — Sefa'nın yapacakları (Pim Etiket'te bekliyor)

1. **Yurtiçi Kargo API credentials**:
   - Yurtiçi'den kullanıcı adı + şifre gelince Vercel'de set et:
     - `YURTICI_USERNAME` (yeni)
     - `YURTICI_PASSWORD` (yeni)
     - `YURTICI_DRY_RUN=false` (true → false)
   - Hiç kod değişikliği yok, sadece env update
2. **Avukat onayı** (yasal sayfalar — mesafeli/KVKK/iade/çerez):
   - "Taslak uyarısı" kaldırıldı ama avukat metinleri gerçekten incelemeli
   - Cease & desist şablon hazırlığı (telif ihlali davası için)
3. **VERBİS muafiyet sorgu** (KVKK):
   - Sefa Yakut Kırtasiye Baskı Tic. Ltd. Şti. VERBİS kayıt zorunlu mu?
   - turkpatent.gov.tr + verbis.kvkk.gov.tr sorgu
4. **Marka tescil TÜRKPATENT** (1.500-3.000 TL, 10 yıl koruma):
   - turkpatent.gov.tr online başvuru
5. **5 ürün belirsizliği** (eski TODO):
   - Tabaka sticker boyutu (23×31 mm vs A3?)
   - Tabaka sticker fiyat aralığı
   - Kraft eski siparişler için migration davranışı
   - Sticker tabaka'da kontur kesim olur mu
   - Sticker'a yeni özelleştirme (UV vernik vs.) eklenir mi
   - 050: sticker_die_cut + 4 folyo + rulo malzeme rename
   - 051: archive_status + archive_events (R2 cold storage altyapısı)
3. **Marka tescil başvurusu** TÜRKPATENT (1.500-3.000 TL, 10 yıl koruma) — turkpatent.gov.tr online
4. **Sefa: Cloudflare R2 hesap + bucket + API token + Vercel env** (R2 paketi prerequisite — yukarıdaki "R2 Cold Storage" bölümüne bak)

### 🟡 P1 — Bu ay

4. **Kalan SSS kategorileri resmi ton** (~28 soru)
   - Tasarım & Dosya (10 soru)
   - Malzeme & Teknik (10 soru)
   - Etiket Türü & Kesim (7 soru)
   - Boyut & Adet (5 soru)
   - Önizleme (4 soru)
5. ~~**Resmi tatil takvimi**~~ ✅ TAMAM (turkey-holidays.ts, deliveryEstimate güncel)
6. **Cloudflare WAF kuralları** (ücretsiz, mevcut planda) — Sefa Cloudflare dashboard'dan
   - Rate limit /api endpoints
   - Bot management aktive
   - AI scraper IP block list
7. **Migration 055** (eski "051" planı, numara güncellendi):
   - sticker_die_cut + sticker_tabaka scope ayırma
   - 4 folyo malzeme (Opak Beyaz, Holografik, Simli, Sıcak Yaldız)
   - Rulo etiket malzeme rename (kraft sil, ultra→Clear Şeffaf, metalik→Metalize PP)
   - Şeffaf Etiket ekleme
8. **Admin paneli 3 tab → 4 tab** (Migration 055 sonrası)
   - sticker_die_cut + sticker_tabaka + etiket_rulo + etiket_tabaka
9. **Müşteri tarafı /sticker + /etiket DB-aware**
   - Hardcoded constants → DB pricing config (Migration 047) çekme
10. **/sablonlar gerçek şablon içerik** — Sefa şablonları yükleyecek
    - Vaadi "60+ şablon" karşılansın (TKHK m.61 yanıltıcı reklam riski)
11. **/galeri gerçek müşteri işleri** — 12-20 gerçek fotoğraf
    - Önceki testimonial flow (Migration 019) ile birlikte
12. **RBAC kullanımı yayma** (Migration 054 altyapı hazır):
    - 20+ admin API endpoint'i `assertPermission(module, action)` ile değiştir
    - `/admin/calisanlar` formuna rol dropdown (fn_list_admin_roles RPC)

### 🟢 P2 — 2-3 ay

13. **Backend swap — Raporlar gerçek veriden** (şu an MOCK DATA banner görünüyor)
    - `/admin/raporlar` Supabase aggregations
14. **Müşteri 360 tam tab refactor** (şu an sticky scroll-anchor)
    - Gerçek tab state + tab başına lazy load
15. **Dosya önizleme PDF.js + bleed overlay**
    - Tasarımlar modülünde dosya viewer (pdfjs-dist v5 mevcut)
    - DPI/CMYK/bleed işaretleyici overlay
16. **Onboarding tur** — yeni admin için welcome flow
    - 3-adım kurulum tutorial (Fason ekle → Çalışan davet → Ayarlar)
17. **Polotno entegrasyonu** ($1.290 lifetime) — opsiyonel
    - /tasarim-studyosu yeni sayfa
    - 20-30 etiket/sticker hazır şablon
    - PDF/PNG export → otomatik konfigüratöre bağlanır
18. **E-fatura entegrasyonu** (B2B müşteriler için)
    - Limited Şirket olarak GİB e-fatura mükellef başvuru
19. **Telefon hattı aktivasyonu** (Q2 2026)
20. **Mobile uygulama** (React Native veya PWA push notification)
21. **Çoklu dil genişleme** (Arapça, Rusça — Orta Doğu pazarı)

### 🟣 P3 — Uzun vade (6+ ay)

22. **AI tasarım editörü** (DALL-E 3 / Stable Diffusion entegrasyonu)
    - "Bal etiketi minimal stil oluştur" → AI hazırlar
    - Polotno editörde düzenlenebilir
17. **B2B portal** (toplu sipariş, vadeli fatura, açık hesap)
18. **Tablet/iPad konfigüratör** (mağaza içi self-service kiosk)
19. **Sektör paketleri** (kozmetik bundle, gıda bundle, vb. ön ayarlanmış konfigler)
20. **Yıldız tasarımcı koleksiyonu** (anlaşmalı tasarımcılarla limited edition şablon serisi)

---

## 📊 Aktif İstatistikler (18 May sonu — gece dahil)

| Metric | Değer |
|---|---|
| **Toplam commit (bugün)** | 24 (12 gündüz + 12 gece) |
| **Toplam satır değişimi** | ~9.500+ |
| **Yeni Supabase migration** | 4 (051 R2, 052 shipment, 053 cart limit, 054 RBAC) |
| **Yeni admin sayfası** | 6 (/admin/arsiv + [userId], /admin/kargo + [orderId], /admin/profil, /admin/kargo deta) |
| **Yeni API endpoint** | 9 (R2 + Yurtiçi + admin shipments + bulk-poll + override + signed-url + tracking + override + customers archive) |
| **Yeni component** | 12 (öncekiler + RestoreArchivedFileButton + AdminTrackingForm + ShipmentTrendChart + DeliveryHistogram + GeoDistributionTreemap + AdminCommandPalette + AdminBreadcrumb) |
| **Yeni helper lib** | 4 (r2-client, archive-service, restore-service, yurtici-api, turkey-holidays, assert-permission) |
| **TypeScript yeni hata** | 0 |
| **Pre-existing TS hata** | 9 (backups, kvkk-requests, reviews, magic-bytes — bizim alanımız değil) |

---

## 🔐 Güvenlik Durumu (18 May gece güncel)

| Katman | Durum |
|---|---|
| 3D Secure ödeme (PayTR PCI-DSS) | ✅ Aktif |
| HSTS + CSP header'ları | ✅ Aktif |
| Source maps gizli (production) | ✅ Aktif |
| Console uyarı (self-XSS) | ✅ Aktif |
| robots.txt AI scraper blok | ✅ Aktif |
| Watermark mockup'larda | ✅ Aktif |
| FSEK + Sınai Mülkiyet uyarı | ✅ Aktif |
| KVKK aydınlatma metni | ✅ Aktif |
| Admin band public sızıntı | ✅ Düzeltildi (auth+role triple-check) |
| 2FA/MFA TOTP | ✅ /admin/profil canlı, enrollment hazır |
| RBAC 5 rol altyapı | ✅ Migration 054 + fn_has_permission |
| KVKK m.11/e R2 silme | ✅ /api/customer/kvkk-archive-delete |
| Audit log (archive_events) | ✅ 5+ yıl saklanır, RLS admin/staff |
| Sipariş simülatörü production lock | ✅ Flag kontrolü (default false) |
| Marka tescil | ⏳ Sefa yapacak |
| Cloudflare WAF | ⏳ Sefa yapacak |
| Avukat onayı (yasal sayfalar) | ⏳ Bekliyor |
| VERBİS muafiyet sorgu | ⏳ Sefa sorgulayacak |

---

## 📝 Sefa için Hatırlatmalar

1. **Vercel auto-deploy aktif** — `git push origin main` 2-3 dk sonra canlı
2. **Hard refresh (Ctrl+F5)** her değişiklikten sonra önbellek temizle
3. **TODO listesi memory'de** (`project_pending_critical_fixes.md`)
4. **Test akışı**: anasayfa → /etiket → konfigüre → sepete ekle → ödeme (test kartı)
5. **Çalışma seansı sonu**: bu doküman güncellenir, yarın aynı yerden devam
6. **Yeni Admin shortcut'ları**:
   - **Cmd+K** (veya Ctrl+K): Global arama paleti — 27+ sayfaya hızlı erişim
   - Sidebar > Operasyon > **Kargo (R2)**: Yurtiçi tracking yönetimi
   - Sidebar > Sistem > **Arşiv (R2)**: 90+ gün eski müşteri verisi
   - Sidebar > Sistem > **Profilim & 2FA**: TOTP enrollment + şifre

## 🔑 Bekleyen Production Env'leri

```
# Yurtiçi Kargo (Sefa'dan API bilgileri gelince)
YURTICI_USERNAME=
YURTICI_PASSWORD=
YURTICI_DRY_RUN=true → false (credentials geldiğinde)

# Diğerleri zaten Vercel'de set edilmiş:
# R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_ENDPOINT
# SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_ANON
# PAYTR_MERCHANT_ID / _KEY / _SALT
# OPENAI_API_KEY / RESEND_API_KEY / CRON_SECRET / SENTRY_DSN
```
