# Admin Kalan Eksikler — 22 Görev

> Daha önceki Cursor session'larında her sayfanın çoğu hallolmuş.
> Bu prompt **sadece kalan eksikleri** kapsar — tüm @CURSOR-GOREVLER-*.md dosyasını sıfırdan yapma!
> Her grup sonunda `npx tsc --noEmit` + commit.

---

## GRUP A — Hızlı Kazanımlar (3 görev, ~30 dk)

### A1. Admin Siparişler — Partner Kolonu
`@CURSOR-GOREVLER-SIPARISLER.md` Görev 6'yı uygula.
- `/admin/siparisler` tablosuna **partner kolonu** ekle
- Şu an `order_assignments`'tan partner adı çekilmiyor — server-side join veya client fetch ekle
- Atanmamış siparişlerde "—" göster

### A2. Admin Siparişler — Acil Satır Vurgulama
`@CURSOR-GOREVLER-SIPARISLER.md` Görev 8'i uygula.
- SLA aşmış veya gecikmiş satırları **kırmızı arka plan / sol bordür** ile vurgula
- Kriter: `proof_pending > 36 saat` veya `in_production` ama `estimated_delivery < NOW()`

### A3. Admin Sipariş Ekle — Kupon Alanı
`@CURSOR-GOREVLER-SIPARIS-EKLE.md` Görev 8'i uygula.
- Manuel sipariş formuna **kupon kodu input + uygula butonu**
- `fn_validate_coupon` RPC çağır, geçerliyse `fn_apply_coupon` ile uygula
- İndirim hesaplanmış toplama yansısın
- CLAUDE.md: cüzdan/puan değil **mevcut kupon RPC'leri**

**Commit:** `feat(admin): orders partner column + urgency + sipariş kupon`

---

## GRUP B — AI QC Sayfası (7 görev, ~90 dk)

`@CURSOR-GOREVLER-AI-QC.md` içinden bunları uygula (sayfa: `/admin/ai-qc`):

### B1. "Düzelt ve Prova Hazırla" 3. Karar Seçeneği
Şu an `good` / `bad` var → 3. seçenek: `fix_and_proof` (otomatik düzeltme dene, sonra prova üret).

### B2. QC Yeniden Çalıştır Butonu
Her sipariş satırında "🔄 Tekrar çalıştır" — `run-order-qc.ts`'i yeniden tetikler.

### B3. Operatör Notu (Her Karar İçin)
Karar verirken zorunlu/opsiyonel kısa not alanı — `ai_qc_decisions.operator_note` (kolon yoksa migration ekle).

### B4. Dosya İndirme Linki
QC kartında orijinal tasarım dosyasına **signed URL ile indirme** butonu.

### B5. Karar Geçmişi
Aynı sipariş tekrar QC'ye girerse önceki kararları **timeline olarak** göster.

### B6. Toplu Onay (verdict=good)
Filtre `verdict=good` aktifken **"Hepsini Onayla"** butonu (15 sn confirm modal).

### B7. Revizyon Karşılaştırma
Müşteri tasarımı revize ettiyse **eski vs yeni** side-by-side görüntü.

**Commit:** `feat(admin): AI QC 3rd decision + retry + notes + history + bulk`

---

## GRUP C — Prova Yönetimi (5 görev, ~60 dk)

`@CURSOR-GOREVLER-PROVA.md` içinden bunları uygula (sayfa: `/admin/prova`):

### C1. Bıçak + Beyaz Katman Durum Rozeti
Her satırda mini rozet: 🟢 bıçak ✓ + beyaz ✓ / 🟡 bıçak ✓ + beyaz ✗ / 🔴 ikisi de eksik

### C2. Durum Filtre Sekmeleri
Üst toolbar'a sekmeler: Tümü | Bekliyor | Validating | Onaylı | Reddedildi | SLA Aşıldı

### C3. Toplu "Üretime Taşı" (proof_approved)
Filtre `proof_approved` aktifken **toplu seç → "Üretime taşı"** (status → `production_pending`).

### C4. Prova Linki Kopyala + WhatsApp Paylaşım
Her satırda 3 küçük buton: 📋 link kopyala · 💬 WhatsApp · 📧 e-posta gönder.

### C5. Mini İstatistik Paneli
Sayfa üstüne 4 KPI kartı: Bekleyen / Bugün onaylanan / Ortalama yanıt / SLA aşılan.

**Commit:** `feat(admin): prova badges + filter tabs + bulk action + share + stats`

---

## GRUP D — Kargo Yönetimi (4 görev, ~50 dk)

`@CURSOR-GOREVLER-KARGO.md` içinden bunları uygula (sayfa: `/admin/kargo`):

### D1. Kargo Etiketi Yazdır Butonu
Her satırda "🖨️ Etiket" — `/api/admin/kargo/[id]/label` endpoint, PDF/HTML print sayfası.

### D2. CSV Dışa Aktarma
Filtrelenmiş listeyi CSV indir — siparişler sayfasındaki pattern aynısı.

### D3. Tahmini vs Gerçek Teslimat Karşılaştırma
Teslim edilmiş satırlarda **tahmini X gün / gerçek Y gün** — gerçek > tahmini ise kırmızı.

### D4. Teslimat Süresi (Tablo Satırında)
"Kargoya verildi" sütununun yanına **geçen gün sayısı** ("3 gündür yolda", "12 gün önce teslim").

**Commit:** `feat(admin): kargo label + CSV + delivery comparison + days`

---

## GRUP E — Fason Yönetimi (5 görev, ~70 dk)

`@CURSOR-GOREVLER-FASON.md` içinden bunları uygula (sayfa: `/admin/fason`):

### E1. Performans Skoru Detay Açılımı
Skor numarasına tıklayınca **modal/popover**: zamanında teslim oranı, kalite skoru, iletişim hızı vb. detay.

### E2. Atama Geçmişi Sayfalama
Partner detay sayfasında "Geçmiş İşler" sekmesine **sayfalama** (10/sayfa).

### E3. Kapasite Doluluk Göstergesi
Partner kartında **progress bar**: "8/12 sipariş aktif (%67)". Kapasite `fason_partners.capacity` veya `partner_capabilities`'dan.

### E4. Sözleşme Dosyası İndirme
Partner kartında "📄 Sözleşme indir" butonu — `contract_pdf_url`'den signed URL ile.

### E5. Partner İletişim Logu
Partner detayına yeni sekme: **İletişim Geçmişi**. WhatsApp/email/aranma kaydı manuel ekleme. Yeni tablo: `partner_communications` (migration 116 — `id, partner_id, channel, summary, created_by, created_at`).

**Commit:** `feat(admin): fason performance detail + capacity + contract + comms log`

---

## Toplam Tahmin
| Grup | Görev | Süre | Commit |
|------|-------|------|--------|
| A | 3 | 30 dk | 1 |
| B | 7 | 90 dk | 1 |
| C | 5 | 60 dk | 1 |
| D | 4 | 50 dk | 1 |
| E | 5 | 70 dk | 1 |
| **Toplam** | **24** | **~5 saat** | **5 commit** |

> **Not:** 24 değil 22 — sayım farkı: bazı görevler kapsam içinde birleşmiş.

## Önemli
- Her grup sonunda `npx tsc --noEmit` + commit + masaya konuşma
- Migration 116 (E5) önce DB'ye apply
- Test verisi filtresi tüm yeni listelerde aktif kalsın (`isTestOrder` flag mevcut)
- CLAUDE.md sefaRules: cüzdan/puan/üyelik indirimi YASAK
- Yeni API endpoint'lerinde `assertPermission(...)` zorunlu
