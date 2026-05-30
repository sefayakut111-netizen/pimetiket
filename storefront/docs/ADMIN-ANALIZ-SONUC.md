# Admin Panel Revizyon — Karar Kaydı

> Tarih: 30 Mayıs 2026
> Girdiler: Claude (1000 ölçek analizi) + Cursor (bugün 1-3 kişi analizi) + kod doğrulaması
> Çerçeve: Mimariyi 1000 sipariş/ay için kur, >1000 özelliklerini ertele. Sefa kararı.

---

## ⚠️ KOD DOĞRULAMASI — Analiz sonrası düzeltmeler

İki analiz de varsaydı ama kod farklı çıktı:

| Madde | Analiz dedi | Kod gerçeği | Sonuç |
|-------|-------------|-------------|-------|
| Destek + Yardım birleştir | "Mükerrer, birleştir" | **Kasıtlı ayrı** — `destek`=genel (form/mail/Pim), `yardim-talepleri`=prova aşaması | ❌ Birleştirme, sadece etiket netleştir |
| Kredi/cüzdan UI sil | "Varsa kaldır" | **Zaten yok** — grant-credit 410 Gone, handleCredit kaldırılmış | ✅ Yapılmış, dokunma |
| 3 fiyat hesaplayıcı → 1 | "Birleştir" | **Zaten redirect** — üçü `/admin/fiyatlar?tab=calculator`'a | ➖ Sadece sidebar temizliği |
| Server-side aggregation | "500 limit tüm KPI" | **KPI zaten finansal API'den**, sadece funnel/top/operational client-side | 🔧 Scope daraldı: 4 metrik |

---

## KARAR TABLOSU (Sefa onaylı)

### 🟢 Dokunulmayacak (Sefa: "kalsın")
| Madde | Karar | Gerekçe |
|-------|-------|---------|
| Denetçiler (9 auditor) | **KALSIN** — görünür + çalışır | Erken uyarı sistemi, 1000'de kritik |
| Müşteri segment | **DURSUN** — veri gelecek | Biriktikçe anlamlanacak |
| Dashboard funnel/ısı | **DURSUN, çalışsın** | Tam haliyle, sadece calc server-side'a taşınacak (ölçekte kırılmasın) |

### 🔴 Hemen (risksiz temizlik)
| # | Madde | Aksiyon |
|---|-------|---------|
| 1 | Fiyat sidebar | 2 fazla giriş kaldır, tek "Fiyatlar" kalsın |
| 2 | Debug sayfaları | Prod sidebar'dan çıkar (env flag) |
| 3 | Destek/Yardım etiket | Sidebar'da net ayrım: "Destek (genel)" / "Prova Yardımı" |

### 🟠 Kritik (ölçek/yasal)
| # | Madde | Aksiyon |
|---|-------|---------|
| 4 | **Operasyon kuyruğu** | Yeni unified inbox — acil işler tek sayfa |
| 5 | Server-side aggregation | funnel/top/operational metrikleri DB-side aggregate'e taşı |
| 6 | E-fatura + VKN | Paraşüt entegrasyon + kurumsal fatura profili (Sefa: Paraşüt hesabı gerekli) |

### 🟡 Orta (ekle)
| # | Madde | Aksiyon |
|---|-------|---------|
| 7 | Fason dosya transfer logu | Hangi PDF/cutline, kime, ne zaman |
| 8 | CRM aktivite logu | Müşteri detayına telefon/WhatsApp notu |
| 9 | Global arama (Cmd+K) | Sipariş/müşteri/takip no |
| 10 | Aylık muhasebe PDF | Tahsilat/iade/KDV özeti |
| 11 | RBAC UI sadeleştir | Backend koru, UI'da 3 rol (admin/operatör/finans), detay "gelişmiş" |

### 🟢 Düşük (sadeleştir/taşı)
| # | Madde | Aksiyon |
|---|-------|---------|
| 12 | Raporlar | Finans'a birleştir veya mükerrer grafik temizle |
| 13 | CMS 4 sayfa | Tek "İçerik" hub, alt sekmeler |
| 14 | Aboneler | İçerik/ayarlar altına taşı |
| 15 | Arşiv/Yedek | Sistem menüsüne, admin-only |

### 🔵 Ölçekte (şimdi değil)
| # | Madde | Eşik |
|---|-------|------|
| 16 | Kargo API otomasyonu | 500+ sipariş/ay |
| 17 | Operatör çakışma kilidi | 5+ operatör |
| 18 | Stok/malzeme takibi | 1000+ veya kendi üretim |

---

## SİDEBAR YENİDEN GRUPLAMA (mental model)

Mevcut sidebar 3 modu karıştırıyor. Önerilen ayrım:

```
🔵 OPERATÖR MODU (günlük)
├─ Operasyon Kuyruğu  ← YENİ (acil işler)
├─ Panel (dashboard)
├─ Siparişler
├─ Sipariş Ekle
├─ AI QC
├─ Prova
├─ Kargo
├─ Fason
├─ Destek (genel)
└─ Prova Yardımı

🟣 MÜŞTERİ & BÜYÜME
├─ Müşteriler (segment dahil)
├─ Yorumlar
├─ İadeler
├─ Tasarımlar
├─ Aboneler
└─ Raporlar (finans dahil)

🟢 FİNANS
├─ Finans & Raporlar
├─ Ödemeler
├─ Kuponlar
└─ Fiyatlar

⚙️ SİSTEM (admin-only, haftalık)
├─ Çalışanlar
├─ Denetçiler
├─ Denetim Kaydı
├─ KVKK
├─ İçerik (urunler+blog+galeri+gorseller)  ← hub
├─ Cron / Bakım / Mail Sağlığı
└─ Arşiv / Yedekler
```

---

## UYGULAMA FAZLARI

| Faz | İçerik | Bağımlılık | Prompt |
|-----|--------|-----------|--------|
| 1 | Temizlik (sidebar, debug, etiket) | — | CURSOR-PROMPT-ADMIN-REVIZE.md FAZ 1 |
| 2 | Operasyon kuyruğu | — | CURSOR-PROMPT-OPERASYON-KUYRUGU.md |
| 3 | Server-side aggregation | — | FAZ 3 |
| 4 | RBAC UI sadeleştir | — | FAZ 4 |
| 5 | Orta eklemeler (fason log, CRM log, arama, muhasebe) | — | FAZ 5 |
| 6 | E-fatura + VKN | **Paraşüt hesabı (Sefa)** | FAZ 6 (blocked) |
| 7 | Düşük (CMS hub, taşımalar) | — | FAZ 7 |
| 8 | Ölçekte (kargo API, kilit, stok) | Eşikler | Ertelendi |

**Sefa bağımlılığı:** Faz 6 (e-fatura) Paraşüt API key olmadan başlayamaz — diğer fazlar paralel ilerler.
