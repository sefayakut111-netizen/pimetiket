# Admin Panel Revizyon — Fazlı Master Prompt

> Karar kaydı: `@docs/ADMIN-ANALIZ-SONUC.md`
> Fazları sırayla uygula. Her faz sonunda `npx tsc --noEmit` + commit.
> **ÖNEMLİ:** Dokunulmayacaklar → denetçiler, müşteri segment, dashboard funnel/ısı (Sefa: kalsın).
> Her görevde ÖNCE kodu kontrol et — bazıları zaten yapılmış olabilir.

---

## ✅ DOĞRULANMIŞ DURUM (analiz vs kod)

Bunlar **zaten yapılmış veya yanlış varsayım** — DOKUNMA:
- Kredi/cüzdan UI → zaten yok (grant-credit 410 Gone)
- 3 fiyat hesaplayıcı → zaten redirect `/admin/fiyatlar`'a (sadece sidebar temizliği kaldı)
- Destek vs Yardım → **kasıtlı ayrı** (destek=genel, yardım=prova), birleştirme!

---

## FAZ 1 — Temizlik (risksiz, ~40 dk)

### 1.1 Fiyat sidebar temizliği
Sidebar'da `/admin/fiyat-hesapla`, `-etiket`, `-tabaka` üç ayrı giriş var ama hepsi `/admin/fiyatlar`'a redirect.
- Sidebar'dan bu 3 girişi kaldır, tek **"Fiyatlar"** kalsın (`/admin/fiyatlar`)
- Redirect sayfaları kalsın (eski linkler kırılmasın), sadece menüden çıkar

### 1.2 Debug sayfaları prod'dan gizle
`/admin/agents/design-qc-test`, `/admin/debug/design-qc-test`, `/admin/test-siparis-simulator`
- Sidebar'da `process.env.NODE_ENV !== 'production'` guard'ı ekle
- Sayfa içinde de prod'da `notFound()` döndür

### 1.3 Destek/Yardım etiket netleştirme
Birleştirme YOK. Sadece sidebar etiketlerini netleştir:
- `/admin/destek` → "Destek (Genel)"
- `/admin/yardim-talepleri` → "Prova Yardımı"
- Her sayfa başına 1 satır açıklama: hangi tip talep buraya düşer

**Commit:** `refactor(admin): sidebar temizlik — fiyat tek giris, debug gizle, destek etiket`

---

## FAZ 2 — Operasyon Kuyruğu (~2.5 saat)

`@CURSOR-PROMPT-OPERASYON-KUYRUGU.md` sırayla uygula (4 görev).

En yüksek değerli yeni özellik. Detaylı spec ayrı dosyada.

**Commit:** `feat(admin): operasyon kuyrugu — unified inbox`

---

## FAZ 3 — Server-Side Aggregation (~2 saat)

### Sorun (doğrulanmış)
Dashboard'da `revenue` finansal API'den geliyor (✓) ama **funnel, topCustomers, topCities, operationalMetrics** hâlâ client-side `orders` array'inden (500 limit). 1000 ölçekte kırılır.

> NOT: Funnel/ısı haritası **KALACAK** (Sefa kararı). Sadece **hesaplaması** server-side'a taşınacak — özellik aynı, ölçekte çalışsın diye.

### 3.1 Yeni aggregate endpoint
`src/app/api/admin/dashboard-aggregate/route.ts` (YENİ)
```typescript
// GET /api/admin/dashboard-aggregate?range=7d (veya custom from/to)
// assertPermission("dashboard", "view")
// DB-side SQL aggregate — 500 limit YOK:
// - dailySeries (gün bazlı ciro/sipariş)
// - productMix (ürün dağılımı)
// - topCustomers (top 5)
// - topCities (top 5)
// - operationalMetrics (funnel state counts, ortalama süreler)
// - heatmapData (saatlik yoğunluk)
```

### 3.2 Dashboard'ı bağla
`src/app/admin/page.tsx`:
- `buildDailySeries`, `aggregateProductMix`, `topCustomers`, `topCities`, `operationalMetrics`, heatmap client-side hesaplarını kaldır
- Hepsini `dashboard-aggregate` API'sinden al
- `orders` array'i sadece liste gösterimi için kalsın (KPI hesabı için değil)
- `ordersTruncated` uyarısı kalabilir ama artık KPI'ları etkilemiyor

### 3.3 Siparişler sayfası (opsiyonel, bu fazda)
`/admin/siparisler` server-side pagination'a geçebilir ama 1000'e kadar 500 limit + uyarı idare eder. **Bu fazda sadece dashboard yeter.** Siparişler pagination'ı ölçek eşiğine ertelenebilir — Cursor karar versin, riskli ise atla.

**Commit:** `perf(admin): dashboard metrikleri server-side aggregate`

---

## FAZ 4 — RBAC UI Sadeleştirme (~1 saat)

### Karar (Sefa)
Backend RBAC tablolarını (26 modül × 4 aksiyon) **KORU** — sökme. Sadece UI'yı sadeleştir.

### 4.1 Çalışanlar sayfası 3 rol preset
`/admin/calisanlar`:
- Üstte 3 hazır rol: **Admin** (tüm izinler) / **Operatör** (operasyon modülleri) / **Finans** (finans+rapor)
- Rol seçince backend permission matrix otomatik dolsun (preset → 104 izin satırı arka planda)
- Detaylı 26×4 matris **"Gelişmiş izinler"** accordion'ı altında gizli (isteyen açar)

### 4.2 Rol preset tanımları
```typescript
const ROLE_PRESETS = {
  admin:     // tüm modüller, tüm aksiyonlar
  operator:  // dashboard, orders, ai_qc, proof, shipments, fason, customers(view), 
             // returns, designs, help_requests — finans/staff/pricing HARİÇ
  finance:   // dashboard(view), finans, payments, coupons, pricing, reports — 
             // operasyon modülleri view-only
};
```

**Commit:** `feat(admin): RBAC UI — 3 rol preset + gelismis matris gizli`

---

## FAZ 5 — Orta Eklemeler (~3 saat)

> ⚠️ Migration numara notu: 119 RBAC'te (Faz 4) kullanıldı. Sıralama bozulmasın diye Faz 5 → **Mig 120**, Faz 6 → **Mig 121**. (118 atla — back-numbering migration runner'ı bozar.)

### 5.1 Fason dosya transfer logu
Partner detay (`/admin/fason/[id]`) — atanan siparişlerde "dosya gönderildi" kaydı:
- Migration 120: `fason_file_transfers` (id, order_id, partner_id, file_type [image/cutline/both], file_url, sent_by, sent_at)
- Atama akışında "Baskı dosyalarını gönder" butonu → log + signed URL
- Geçmiş: hangi dosya, kime, ne zaman

### 5.2 CRM aktivite logu
Müşteri detay (`/admin/musteriler/[id]`) — manuel iletişim notu:
- Migration 120 (aynı dosya): `customer_activity_log` (id, customer_id, channel [phone/whatsapp/email/note], summary, created_by, created_at)
- "Not ekle" formu + timeline gösterimi
- Operatör değişiminde geçmiş kalıcı

### 5.3 Global arama (Cmd+K)
- `src/components/admin/CommandPalette.tsx` (YENİ)
- Cmd+K / Ctrl+K ile aç
- Arama: sipariş no, müşteri adı/email/telefon, kargo takip no
- `GET /api/admin/search?q=` (DB-side, ILIKE + limit 10)
- Sonuca tıkla → ilgili sayfaya git

### 5.4 Aylık muhasebe paketi
`/admin/finans` veya `/admin/raporlar`:
- "Aylık paket indir" → ay seç → PDF/Excel
- İçerik: tahsilat toplamı, iade toplamı, KDV özeti (toplam/oran bazında), sipariş sayısı
- Muhasebeci formatı (sade tablo)

**Commit:** Her alt görev ayrı veya birleşik — Cursor karar. Önek: `feat(admin):`

---

## FAZ 6 — E-Fatura + VKN (BLOKE — Paraşüt hesabı gerekli)

> ⚠️ Sefa'nın **Paraşüt API key** sağlaması gerekiyor. Key gelene kadar sadece VKN profil kısmı yapılabilir.

### 6.1 Kurumsal fatura profili (key'siz yapılabilir)
- Migration 121: `customer_billing_profiles` (customer_id, company_title, vkn/tckn, tax_office, e_invoice_alias, address)
- Müşteri detayında "Fatura Bilgileri" sekmesi
- Sipariş ekranında fatura profili seçimi/gösterimi
- CSV export (e-fatura entegrasyonu öncesi bile manuel kullanılır)

### 6.2 Paraşüt entegrasyonu (key bekliyor)
- `src/lib/integrations/parasut.ts` — OAuth + invoice create
- Sipariş `paid` olunca otomatik e-arşiv/e-fatura kesimi
- 5000 TL+ e-arşiv zorunluluğu kuralı
- Env: `PARASUT_CLIENT_ID`, `PARASUT_CLIENT_SECRET`, `PARASUT_COMPANY_ID`

**Commit:** `feat(billing): VKN profil` (6.1) + `feat(billing): parasut e-fatura` (6.2, key sonrası)

---

## FAZ 7 — Düşük Öncelik Sadeleştirme (~2 saat)

### 7.1 İçerik hub
`/admin/urunler`, `/admin/blog`, `/admin/galeri`, `/admin/gorseller` → tek `/admin/icerik` hub, alt sekmeler. Eski rotalar redirect.

### 7.2 Raporlar → Finans
`/admin/raporlar` ile `/admin/finans` mükerrer grafikleri birleştir. Tek "Finans & Raporlar".

### 7.3 Sidebar taşımalar
- Aboneler → İçerik/ayarlar altına
- Arşiv + Yedekler → Sistem menüsüne, admin-only

### 7.4 Sidebar yeniden gruplama
`@docs/ADMIN-ANALIZ-SONUC.md`'deki 4 grup yapısını uygula:
Operatör Modu / Müşteri & Büyüme / Finans / Sistem

**Commit:** `refactor(admin): icerik hub + sidebar yeniden grupla`

---

## ⏸️ ERTELENEN (Ölçek eşiği — şimdi YAPMA)

| Madde | Eşik |
|-------|------|
| Kargo API otomasyonu (Yurtıçi) | 500+ sipariş/ay |
| Operatör çakışma kilidi (optimistic lock) | 5+ operatör |
| Stok/malzeme takibi | 1000+ veya kendi üretim |

---

## UYGULAMA SIRASI ÖZET

| Faz | İçerik | Süre | Bağımlılık |
|-----|--------|------|-----------|
| 1 | Temizlik | 40 dk | — |
| 2 | Operasyon kuyruğu | 2.5 saat | — |
| 3 | Server-side aggregation | 2 saat | — |
| 4 | RBAC UI | 1 saat | — |
| 5 | Orta eklemeler | 3 saat | Mig 118 |
| 6 | E-fatura + VKN | 2+ saat | **Paraşüt key** + Mig 119 |
| 7 | Düşük sadeleştirme | 2 saat | — |
| **Toplam** | | **~13 saat** | |

## GENEL KURALLAR
- Her faz sonunda `npx tsc --noEmit` + commit
- Migration'lar (118, 119) önce DB'ye apply
- Yeni endpoint'lerde `assertPermission(...)` zorunlu
- DB-side aggregate/filtre — client'a toplu kayıt çekme YOK
- CLAUDE.md sefaRules: cüzdan/puan/üyelik indirimi YASAK, "süresiz" YASAK, Bursa YASAK
- Dokunulmayacaklar: denetçiler, müşteri segment, dashboard funnel/ısı
- Test verisi filtresi tüm yeni listelerde aktif

## ÖNCE BAŞLA
Faz 1 (temizlik) + Faz 2 (operasyon kuyruğu) ile başla — ikisi de bağımsız, hızlı değer. Faz 6 Paraşüt key beklediği için en sona.
