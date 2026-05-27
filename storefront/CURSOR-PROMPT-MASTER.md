# Pim Etiket — Açık Görevler (28 Mayıs 2026)

> Güncel durum: ~195 görev tamamlandı, **~65 görev açık**.
> Her görev sonrası `npx tsc --noEmit` + commit.
> `@dosya` referanslarında detaylı talimatlar var — oku ve uygula.

---

## ═══ SIRA 1 — OPS (kod değil, manuel) ═══

1. Test sipariş temizliği — `cleanup-test-orders.mjs --confirm` çalıştır (Sefa onayı gerekli)
2. Eksik migration'ları DB'de kontrol et (110, 092 vb.)

---

## ═══ SIRA 2 — Dashboard Yeni Özellikler (13 görev) ═══
`@CURSOR-GOREVLER-DASHBOARD.md` sırayla uygula:
3. Sekonder API hata görünürlüğü
4. Prova yanıt süresi metriği
5. Error boundary ekle
6. 500+ sipariş limiti KPI
7. Isı haritası koşullu göster
8. Top 5 şehir koşullu göster
9. AI insights koşullu göster
10. Bugünün geliri kartı
11. Sistem sağlığı şeridi
12. Partner üretim durumu
13. 24 saat aktivite akışı
14. Mail kuyruğu durumu
15. Özel tarih aralığı seçici

---

## ═══ SIRA 3 — Admin Sayfaları Kalan Eksikler (22 görev) ═══

### Siparişler — kalan 2 görev
`@CURSOR-GOREVLER-SIPARISLER.md` içinden sadece bunları uygula:
16. Partner kolonu ekle
17. Acil satırları vurgula (SLA aşımı, geciken kargo)

### Sipariş Ekle — kalan 1 görev
`@CURSOR-GOREVLER-SIPARIS-EKLE.md` içinden sadece bunu uygula:
18. İndirim / kupon alanı ekle

### AI QC — kalan 7 görev
`@CURSOR-GOREVLER-AI-QC.md` içinden bunları uygula:
19. "Düzelt ve prova hazırla" 3. karar seçeneği
20. QC yeniden çalıştır butonu
21. Her kararda operatör notu
22. Dosya indirme linki
23. Karar geçmişi
24. Toplu onay (verdict=good olanlar)
25. Revizyon karşılaştırma

### Prova — kalan 5 görev
`@CURSOR-GOREVLER-PROVA.md` içinden bunları uygula:
26. Bıçak + beyaz katman durum rozeti
27. Durum filtre sekmeleri
28. Toplu "üretime taşı" (proof_approved)
29. Prova linki kopyala + WhatsApp paylaşım
30. Mini istatistikler paneli

### Kargo — kalan 4 görev
`@CURSOR-GOREVLER-KARGO.md` içinden bunları uygula:
31. Kargo etiketi yazdır butonu
32. CSV dışa aktarma
33. Tahmini vs gerçek teslimat karşılaştırma
34. Teslimat süresini tablo satırında göster

### Fason Yönetimi — kalan 5 görev
`@CURSOR-GOREVLER-FASON.md` içinden bunları uygula:
35. Performans skoru detay açılımı
36. Atama geçmişi sayfalama
37. Kapasite doluluk göstergesi
38. Sözleşme dosyası indirme
39. Partner iletişim logu

---

## ═══ SIRA 4 — v2 Özellikler (24 görev) ═══

### Proof Editor AI Pipeline (8 görev)
`@CURSOR-GOREVLER-PROOF-EDITOR.md` sırayla uygula:
40. EPS engeli + dosya tipi util
41. proof_validating durumu
42. JPG şekil seçici
43. Bıçak algılama modülü
44. Beyaz katman üretimi
45. Kural bazlı doğrulayıcı
46. AI görüş doğrulayıcı (Vision API)
47. Otomatik düzeltme motoru + orkestratör

### AI Ek + Final (8 görev)
`@CURSOR-GOREVLER-FINAL.md` sırayla uygula:
48. Bakım modu (maintenance mode)
49. Cron izleme paneli
50. Ödeme detay sayfası (/admin/odemeler)
51. Arka plan algılama + kaldırma
52. RGB → CMYK simülasyonu
53. Çoklu tasarım tutarlılık kontrolü
54. Baskıya hazır PDF üretimi
55. Pim sohbet yönlendirme + prova bağlamı

### Fiyatlandırma Gelişmiş (8 görev)
`@CURSOR-GOREVLER-FIYAT.md` sırayla uygula:
56. İnteraktif simülasyon paneli
57. Toplu fiyat matrisi
58. Rakip referans alanı
59. Malzeme aktif/pasif toggle
60. Kaplama TRY karşılığı
61. Sticky kaydet çubuğu
62. PriceBook CSV import/export
63. Fiyat değişikliği bildirimi

---

## ═══ SIRA 5 — v2 Polish (4 görev) ═══

### Fason Partner Detay v2 — kalan 4 görev
`@CURSOR-PROMPT-FASON-DETAY-V2.md` içinden bunları uygula:
64. Yetenek bölümünü ürün-malzeme hiyerarşik seçiciyle yeniden tasarla
65. Ayrı "yetenek onayı" bölümünü kaldır
66. Atanabilir siparişler bölümüne sözleşme kontrolü + onay modalı
67. Performans kartı ekle

---

## ═══ TAMAMLANDI — DOKUNMA ═══

### Bölüm A — Kritik (18/18 tamamlandı)
- ✅ Hesaplayıcı toplu fix (8) — header, SVG, sepet/maliyet kaldırma, panel sırası, sol panel, tier
- ✅ Fiyat sayfa temizlik (3) — A1 ile birlikte
- ✅ POC bıçak editörü (7) — hideUpload, lockMaterial, hideDpi, kaydet, yardım, scroll

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
