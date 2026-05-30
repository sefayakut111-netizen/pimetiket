# Pim Etiket — Açık Görevler (28 Mayıs 2026)

> Güncel durum: ~195 görev tamamlandı, **~65 görev açık**.
> Her görev sonrası `npx tsc --noEmit` + commit.
> `@dosya` referanslarında detaylı talimatlar var — oku ve uygula.

---

## ═══ SIRA 1 — OPS (kod değil, manuel) ═══

1. Test sipariş temizliği — `cleanup-test-orders.mjs --confirm` çalıştır (Sefa onayı gerekli)
2. Eksik migration'ları DB'de kontrol et (110, 092 vb.)
3. **`.env.agent` explicit gitignore** (acil değil) — şu an `.env` pattern'i kapsıyor ama `core/.gitignore`'a `.env.agent` satırı eklemek temizlik için iyi. Doğrulama: `git check-ignore .env.agent` zaten OK döndürüyor, riski yok.

---

## ═══ SIRA 2 — Dashboard Yeni Özellikler (TAMAMLANDI ✅) ═══
12/12 görev tamamlandı (commit 05320ff). Detay: yapılanlar tablosunda.

---

## ═══ SIRA 3 — Bıçak Algılama Entegrasyonu (TAMAMLANDI ✅) ═══
5/5 görev + ek `fn_proof_summary_cutline_source_fix` migration. Detay: yapılanlar tablosunda.

---

## ═══ SIRA 4 — Otomatik Ölçü Algılama + Boyut UX (TAMAMLANDI ✅) ═══
4/4 görev, 4 ayrı commit (a60c01a → e2fb8f4). Detay: yapılanlar tablosunda.

---

## ═══ SIRA 5 — Admin Sayfaları Kalan Eksikler (TAMAMLANDI ✅) ═══
24/24 görev, 5 commit (300e6fe → 50acfd6) + Migration 116. Detay: yapılanlar tablosunda.

---

## ═══ SIRA 6 — v2 Özellikler (TAMAMLANDI ✅) ═══
24/24 görev — çoğu zaten yapılmıştı. Tek commit (8eaf6fd) ile 3 yeni özellik. Detay: yapılanlar tablosunda.

---

## ═══ SIRA 7 — Fason Detay v2 Kalan (TAMAMLANDI ✅) ═══
4/4 görev, commit f180028 + Migration 117. Detay: yapılanlar tablosunda.

---

## ═══ SIRA 8 — Admin Panel Revizyon (YENİ — analiz sonrası) ═══

> Claude + Cursor analizi + kod doğrulaması sonucu. Karar kaydı: `@docs/ADMIN-ANALIZ-SONUC.md`
> 7 faz, ~13 saat. Faz 6 (e-fatura) Paraşüt key bekliyor.

`@CURSOR-PROMPT-ADMIN-REVIZE.md` fazları sırayla uygula.

| Faz | İçerik | Durum |
|-----|--------|-------|
| 1 | Temizlik (sidebar, debug, etiket) | ✅ `6e842cf` |
| 2 | **Operasyon kuyruğu** (en yüksek değer) | ✅ `e0bb2d9` |
| 3 | Server-side aggregation | ✅ `e3486dd` |
| 4 | RBAC UI 3 rol | ✅ `6b69085` + Mig 119 |
| 5 | Orta eklemeler (fason log, CRM log, arama, muhasebe) | ✅ 4 commit + Mig 120 |
| 6 | E-fatura + VKN (Paraşüt key bekliyor) | 🔒 bloke, Mig 121 |
| 7 | Düşük sadeleştirme (içerik hub, taşıma) | ✅ 3 commit |

**Dokunulmayacak:** denetçiler, müşteri segment, dashboard funnel (Sefa: kalsın)

---

## 🎉 PLANLI CURSOR GÖREVLERİ TAMAMLANDI (SIRA 2-7)

Sadece **SIRA 1 (OPS — manuel)** + **SIRA 8 (admin revizyon — yeni)** kaldı. OPS Sefa'nın işi:
1. Test sipariş temizliği — `cleanup-test-orders.mjs --confirm`
2. Migration 092 + 110 + 115 + 116 + 117 prod DB kontrolü (uygulanmamış varsa apply)

**Launch için kalan diğer maddeler:**
- PayTR sandbox → canlı mod (key gelince)
- Tarayıcı testleri (Sefa)
- RESEND_WEBHOOK_SECRET (düşük öncelik)

---

## ═══ TAMAMLANDI — DOKUNMA ═══

### Bölüm A — Kritik (18/18 tamamlandı)
- ✅ Hesaplayıcı toplu fix (8) — header, SVG, sepet/maliyet kaldırma, panel sırası, sol panel, tier
- ✅ Fiyat sayfa temizlik (3) — A1 ile birlikte
- ✅ POC bıçak editörü (7) — hideUpload, lockMaterial, hideDpi, kaydet, yardım, scroll

### Fason Detay v2 SIRA 7 (4/4 tamamlandı, commit f180028 + Mig 117)
- ✅ Migration 117: `approval_status` (pending/approved/rejected) + `is_verified=true` backfill + `fn_find_best_partner` sadece onaylı yetenekler
- ✅ Yetenek hiyerarşik UI: `ProductMaterialPicker` paylaşılan bileşen, accordion ürün grubu → malzeme
- ✅ Inline onay rozetleri (🟢/🟡/🔴) + satır içi onay/ret butonları, yeni yetenekler otomatik pending
- ✅ Atama "Ata ve Bildir" modalı: sözleşme/kapasite/yetenek kontrolü, başarısızsa disabled
- ✅ Performans kartı sağ sidebar üst (90 gün özeti), "Detayları gör" mevcut modal'a

### v2 Özellikler SIRA 6 (24/24 tamamlandı, commit 8eaf6fd)
- ✅ **Proof Editor AI Pipeline (8/8)** — hepsi önceki sprint'lerde yapılmış (EPS, JpgShape, white-layer, rule/AI validator, auto-fix, orchestrator)
- ✅ **AI Ek + Final (5/8 zaten + 3 yeni)** — `/admin/sistem/bakim` (bakım modu UI), `/admin/odemeler/[id]` (PayTR detay + iade), PimChat `/onay` orderId context
- ✅ **Fiyat Gelişmiş (8/8)** — hepsi zaten vardı (PriceMatrix, sticky, CSV, diff modal, m²/TRY)
- ✅ Migration kontrolü: 101, 102, 103, 104, 105 hepsi prod'da, çift apply yapılmadı

### Admin Kalan SIRA 5 (24/24 tamamlandı, 5 commit + Mig 116)
- ✅ **Grup A** (300e6fe) — Siparişler partner kolonu + acil vurgu + manuel sipariş kupon
- ✅ **Grup B** (db176eb) — AI QC: retry, timeline, 15sn bulk modal, "iyi" toplu onay
- ✅ **Grup C** (7508b67) — Prova: rozet, sekmeler, e-posta paylaşım, KPI, bulk onaylı
- ✅ **Grup D** (39bfd96) — Kargo: tahmini/gerçek gün, transit süre
- ✅ **Grup E** (50acfd6) — Fason: performans modal, kapasite bar, sözleşme, iletişim sekmesi
- ✅ **Migration 116** prod'da — `partner_communications` (profiles.role RLS)

### Otomatik Ölçü SIRA 4 (4/4 tamamlandı, a60c01a → e2fb8f4)
- ✅ `design-dimensions.ts` helper (a60c01a) — PNG/JPG (300 DPI), PDF/SVG (exact)
- ✅ MultiDesignUploader callback + kart rozeti (bad287f)
- ✅ Etiket + sticker step sıralama (tasarım→boyut) + mercan banner (bdc0f74)
- ✅ Etiket + sticker W↔H swap butonu (e2fb8f4)

### Bıçak Algılama SIRA 3 (5/5 + 1 fix tamamlandı, d105d3c)
- ✅ Magenta spot color (#FF00FF) tespiti (`cutline-detect.ts`)
- ✅ Orchestrator embedded öncelik (`orchestrator.ts` — POC atlanıyor)
- ✅ Headless POC + run-order-cutline pass-through
- ✅ Migration 115: `cutline_source` + `detection_method` kolonları
- ✅ `fn_proof_summary_cutline_source_fix` (apply sonrası eksiklik)
- ✅ /onay yeşil/mavi rozet
- 🔲 **Manuel test:** embedded-magenta-cutline.svg ile gerçek sipariş aç → yeşil rozet doğrula

### Dashboard SIRA 2 (12/12 tamamlandı, commit 05320ff)
- ✅ Secondary API hata rozetleri (statsError, funnelError, auditorError)
- ✅ Prova yanıt süresi (funnelMetrics.proof_pending)
- ✅ Error boundary (admin/error.tsx)
- ✅ 500 limit sarı banner + finans linki
- ✅ Heatmap koşullu (50+), Top 5 şehir (30+), AI Insights (10+)
- ✅ Bugünün geliri kartı (server todayFinancial)
- ✅ Sistem sağlığı strip (/api/admin/system-health)
- ✅ Partner üretim (/api/admin/partner-production-summary)
- ✅ 24 saat aktivite (/api/admin/activity-feed)
- ✅ Mail kuyruğu (sistem sağlığı strip'inde)
- ✅ Özel tarih aralığı (custom range + date picker)

### Bölüm B — Yüksek (97/99 tamamlandı)
- ✅ Partner panel redesign (6) — PartnerShell, sidebar, dashboard, acil sıra, ayarlar
- ✅ Admin kritik fix V1+V2+V3 (18) — cron, badge, Türkçe durum, migration 110
- ✅ Dashboard fix + emoji (9) — gelir birleştirme, AI kuyruk, banner, timezone, SVG ikon
- ✅ Operasyon V4+V5 (18) — drill-down, tooltip, SLA alarm, KVKK, spam koruma
- ✅ Müşteri CRM fix (11) — veri çekme, onarım script, test filtre, KVKK
- ✅ İçerik fix (6) — test filtre, blog modal, sıralama, SEO
- ✅ Yönetim fix (9) — ödemeler, kupon checkout, KVKK finans, son giriş
- ✅ Sistem fix (9) — ayarlar formu, eski şifre, 404, denetim log, cron modal
- ✅ Cron/SLA fix (3) — cascade, top şehir, AI süre
- ✅ Toplu inceleme fix (4) — chip gruplama, alt toplam, yardım UX, partner tam sayfa
- ✅ Fason detay UX (8) — partner adı, sözleşme banner, test filtre, sekmeler

### Bölüm C — Orta (kısmen)
- ✅ C1 Anasayfa (6/6) — blog, Instagram, sticky CTA, FAQ+Pim, hero microcopy
- ✅ C3 Siparişler (8/10) — tarih filtresi, sıralama, sayfalama, KPI, CSV, geçiş, kargo no
- ✅ C4 Sipariş ekle (9/10) — çoklu ürün, malzeme, müşteri arama, fiyat, dosya, taslak
- ✅ C5 AI QC (3/10) — önizleme, verdict filtresi, KPI
- ✅ C6 Prova (4/9) — SLA, hatırlatma, tüm durumlar, SLA sıralama
- ✅ C7 Kargo (4/8) — toplu yenileme, sayfalama, takip no, tablo sıralama
- ✅ C8 Fason (4/9) — duraklat/sonlandır, arama, partner sıralama, ata butonu

### Bölüm D — Düşük (kısmen)
- ✅ D4 Fason v2 (2/6) — 2 kolon layout
- ✅ D5 Analytics (3/3) — funnel + davranış + GA4

### Master dışı tamamlanan işler
- ✅ Güvenlik analizi (6 başlık) — auth, API, XSS, KVKK, ödeme, storage
- ✅ Responsive fix (3 commit) — müşteri sayfaları, admin dashboard, Pim chat
- ✅ Ops — Sentry tunnel, /api/health, cron registry, R2 restore, mail-health, Resend
- ✅ RBAC granular permissions + partner UI preview
- ✅ Sipariş status sync (migration 092)

### Eski tamamlananlar (~150)
- ✅ ODEME-SONRASI-KOMPLE, ODEME-SONRASI-AKIS, SERVER-CUTLINE, SIPARISLERIM
- ✅ AKIS-KONTROL, ONAY-SAYFASI V1+V2, ONAY-DETAYLI-ANALIZ, ONAY-MULTI-DESIGN-REVIZE
- ✅ TASARIM-YUKLE-UX, TASARIM-YUKLE-FIX, PANELIM, SIPARIS-DETAY
- ✅ MULTI-DESIGN-UI, TASARIM-YONETIMI, TASARIM-PROMOTE-FIX, TASARIMLARIM-FIX
- ✅ DUZENLE-ANALIZ, FIYAT-YAPISAL-DEGISIKLIK, HESAPLAYICI-TEMIZLIK
- ✅ FIYAT-HESAPLAYICI-ANALIZ, LAUNCH-HAZIRLIK, ENV-SETUP
- ✅ BUG-TARAMA, P2, ADMIN eski, SPRINT2, EKSIK, AI-EK

---

## ÖZET

| Durum | Görev |
|-------|-------|
| ✅ Tamamlandı | ~195 |
| 🔲 Açık | **67** |

| Sıra | Alan | Açık Görev |
|------|------|------------|
| 1 | OPS (manuel) | 2 |
| 2 | Dashboard yeni özellikler | 13 |
| 3 | Admin kalan eksikler | 24 |
| 4 | v2 özellikler | 24 |
| 5 | v2 polish | 4 |
