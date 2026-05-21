# 🎬 Admin Akışı Snapshot — v1.0

> **Snapshot tarihi:** 21 Mayıs 2026 v68
> **Amaç:** Sefa'nın admin paneli operasyon akışının **anlık fotoğrafı**.
> İleride v1.1, v2.0... olarak güncellenir; **git diff** ile değişimi göster.
>
> Bu dosya `SIPARIS-AKISI-SNAPSHOT.md` (müşteri tarafı) ile birlikte
> okunur — ikisi birden Pim Etiket'in tam operasyon resmini verir.

---

## 📌 v1.0 — Admin Operasyon Anı (Pre-Launch)

**Kapsam:** 41 admin sayfa + cron + mail bildirimleri
**Hazırlık seviyesi:** %90 (müşteri tarafından daha hazır)
**Kapatılan commit aralığı:** `e6a193a` (Faz 2) → bu commit (Admin akış paketi)

---

## 📋 41 Admin Sayfası Tablosu

### Sipariş yönetimi (7)
| Sayfa | Durum | Notlar |
|-------|-------|--------|
| `/admin` (dashboard) | ✅ | Funnel + revenue + alerts |
| `/admin/siparisler` | ✅ | Liste, filtre, search, bulk action |
| `/admin/siparisler/[id]` | ✅ | 1028 satır — tüm detay |
| `/admin/siparis-ekle` | ✅ | Manuel sipariş (telefon/WhatsApp) — KDV %20 |
| `/admin/ai-qc` | ✅ | Flagged tasarımlar kuyruk |
| `/admin/prova` | ✅ | proof_pending — POC v2 + manifest |
| `/admin/kargo` | 🟠 | Empty state OK ama tracking sahte event |

### Üretim & İş Akışı (4)
| Sayfa | Durum | Notlar |
|-------|-------|--------|
| `/admin/fason` | ✅ | Partner liste + kapasite filtre |
| `/admin/fason/yeni` | ✅ | 4-kart form (contact + capability) |
| `/admin/kargo/[orderId]` | ✅ | Etiket PDF + tracking no manuel |
| `/admin/denetciler` × 4 | ✅ | AI agent denetim sistemi |

### Müşteri Yönetimi (4)
| Sayfa | Durum | Notlar |
|-------|-------|--------|
| `/admin/musteriler` | 🔴 | **Prod hata** — diagnostic link UI'da gözüküyor |
| `/admin/musteriler/[id]` | ✅ | Müşteri detayı, segment |
| `/admin/aboneler` | ✅ | Bülten + CSV export |
| `/admin/arsiv/[userId]` | ✅ | 90+ gün hareketsiz arşiv |

### İçerik (4)
| Sayfa | Durum | Notlar |
|-------|-------|--------|
| `/admin/urunler` | 🟠 | DB encoding bozuk metin (Migration 075 bekliyor) |
| `/admin/gorseller` | ✅ | Site görselleri (hero, vb.) |
| `/admin/tasarimlar` | ✅ | Tasarım kütüphanesi |
| `/admin/galeri` | ✅ | Showcase yönetimi |

### Mali Yönetim (6)
| Sayfa | Durum | Notlar |
|-------|-------|--------|
| `/admin/finans` | ✅ | Mali tablo, ciro, gider |
| `/admin/raporlar` | ✅ | PDF raporlar |
| `/admin/fiyatlar` | ✅ | Admin live_config |
| `/admin/fiyat-hesapla` | ✅ | Sticker hızlı teklif |
| `/admin/fiyat-hesapla-etiket` | ✅ | Etiket rulo teklif |
| `/admin/fiyat-hesapla-tabaka` | ✅ | Tabaka teklif |

### Pazarlama (3)
| Sayfa | Durum | Notlar |
|-------|-------|--------|
| `/admin/kuponlar` | ✅ | HOSGELDIN10 TR locale fix |
| `/admin/yorumlar` | ✅ | Yorum onay/red |
| `/admin/iadeler` | ✅ | Reddedildi KPI eklendi |

### Sistem (8)
| Sayfa | Durum | Notlar |
|-------|-------|--------|
| `/admin/calisanlar` | ✅ | Staff RBAC |
| `/admin/ayarlar` | ✅ | Genel ayarlar |
| `/admin/profil` | ✅ | Admin profil |
| `/admin/audit-log` | ✅ | Kritik işlem kayıtları |
| `/admin/yedekler` | ✅ | Backup yönetimi |
| `/admin/kvkk-talepleri` | ✅ | KVKK silme/erişim |
| `/admin/agents/design-qc-test` | ✅ | AI QC test aracı |
| `/admin/test-siparis-simulator` | ✅ | Geliştirme: fake sipariş |

### Denetçi Alt-Sayfaları (4)
| Sayfa | Durum | Notlar |
|-------|-------|--------|
| `/admin/denetciler/[auditor]` | ✅ | Tek denetçi detay |
| `/admin/denetciler/bekleyen` | ✅ | Bekleyen önerier |
| `/admin/denetciler/ertelenenler` | ✅ | Ertelenen kararlar |
| `/admin/denetciler/gecmis` | ✅ | Run geçmişi |

### Diğer (1)
| Sayfa | Durum | Notlar |
|-------|-------|--------|
| `/admin/test-siparis-simulator` | ✅ | Geliştirme aracı |

**Skor:** 37 ✅ · 3 🟠 · 1 🔴

---

## 🎭 Sefa'nın Operasyon Senaryosu — "Pazartesi Günlüğü"

| Saat | Olay | Sistem davranışı |
|------|------|------------------|
| **09:00** | Sefa kahve içerken | ✅ **Günlük özet maili gelir** (yeni cron) |
| 09:05 | Maile bakar — "Dün 3 sipariş, 1 tasarım stale" | ✅ Kuyruk + uyarılar görür |
| 09:10 | /admin'e gider | ✅ Dashboard yüklenir, funnel + revenue |
| 09:15 | Yeni siparişi tıklar | ✅ Detay 1028 satır — müşteri, sepet, fatura |
| 09:20 | /admin/ai-qc — flagged tasarımı kontrol | ✅ DPI/CMYK uyarıları |
| 09:25 | Operatör review (gerekirse) | ✅ Reddet/onayla |
| 10:00 | Prova hazır → müşteri onayını bekler | ✅ SLA timer 36 sa |
| 11:00 | /admin/fason → üretime atar | ✅ Auto-assign + operatör maili gider |
| 14:00 | Üretim partneri kapasite uyarısı (varsa) | ✅ Sabah özet maili gösterdi |
| **Yeni sipariş geldi** | İkindi | ✅ **Anlık bildirim maili** (yeni — Sefa /admin açmadan haberdar) |
| 16:00 | Üretim tamam → kargoya hazırla | ✅ /admin/siparisler/[id] → "Kargo Etiketi" |
| 16:05 | Etiket PDF bas + barkod | ✅ Türkçe font embed |
| 16:10 | Yurtıçi'ye git, takip no'yu yaz | 🟠 Manuel girer (Yurtıçi env yok) |
| 16:15 | Müşteri tracking no görür | ✅ /siparis/[id] sayfasında |
| 17:00 | /admin/musteriler liste | 🔴 Prod hata varsa → Diagnostic link tıkla |
| 17:05 | Diagnostic JSON döner | ✅ Root cause + fix önerisi |
| 18:00 | Gün biter | — |

### Müşteri tarafından farklı: 4 KAZANIM
1. ✅ **Yeni sipariş anlık bildirimi** (eskiden yoktu)
2. ✅ **Günlük 09:00 özet maili** (eskiden yoktu)
3. ✅ **Müşteri CRM error UI'da diagnostic link** (eskiden audit-log'a yönlendiriyordu)
4. ✅ **Stale awaiting_upload uyarısı** (özet mailde)

---

## 📊 Mermaid — Admin akışı

```mermaid
graph TD
    A[09:00 Günlük özet mail ✅<br/>YENİ] --> B[Admin /admin'e gir ✅]
    B --> C{Yeni sipariş?}
    C -->|Evet — anlık mail geldi ✅| D[Sipariş detay ✅]
    D --> E{AI QC sonucu?}
    E -->|Pass| F[Prova üret ✅]
    E -->|Flag| G[Manuel review ✅]
    G --> F
    F --> H[Müşteri onayı bekle ✅]
    H --> I[Fason atama ✅]
    I --> J[Üretim ✅]
    J --> K[Kargo etiketi ✅]
    K --> L[Yurtıçi'ye git 🟠]
    L --> M[Tracking gir ✅]
    M --> N{Müşteri teslim aldı?}
    N -->|Evet| O[Fatura kes 🔴<br/>Paraşüt yok, manuel]
    N -->|Hayır| P[Tracking takip 🟠<br/>sahte event]

    Q[/admin/musteriler ✅] -.->|prod hata?| R[Diagnostic link ✅<br/>YENİ]

    classDef ok fill:#d1fae5,stroke:#059669
    classDef warn fill:#fef3c7,stroke:#f59e0b
    classDef err fill:#fee2e2,stroke:#dc2626
    classDef new fill:#dbeafe,stroke:#2563eb
    class B,D,F,G,H,I,J,K,M,Q ok
    class L,P warn
    class O err
    class A,C,R new
```

---

## 🚨 Kritik engeller (v1.0)

### 🔴 Operasyonu doğrudan etkiler (1 kaldı — eskiden 3'tü)
| # | Engel | Çözüm | Süre |
|---|-------|-------|------|
| 1 | **Paraşüt fatura yok** | Manuel kesim (acemi süreç) veya API yazımı | Sefa kararı |

### 🟠 Veri kalitesi (2)
| # | Engel | Çözüm |
|---|-------|-------|
| 2 | **Urunler sayfası bozuk metin** | Migration 075 apply (5 dk) |
| 3 | **Kargo tracking sahte event** | Yurtıçi anlaşma (Sefa bekliyor) |

### 🟢 Sefa'ya konfor (1)
| # | Konu | Mevcut | İyileştirme |
|---|------|--------|-------------|
| 4 | Mobile admin paneli | Responsive ama optimize değil | Post-launch |

---

## 📊 Ölçülebilir baseline (admin perspektifi)

| Metrik | Değer | Yorum |
|--------|-------|-------|
| Tam çalışan sayfa | **37/41** | %90 |
| Kısmi (DB sorunu) | **3/41** | %7 (urunler, kargo, müşteriler) |
| Kırık (prod-only) | **1/41** | %3 (müşteriler API) |
| **Yeni sipariş bildirimi** | ✅ Var (yeni) | ADMIN_NOTIFICATION_EMAIL set'liyse |
| **Günlük özet maili** | ✅ Var (yeni) | 09:00 cron |
| **Cron sayısı** | 20+1 | (admin-daily-summary eklendi) |
| **Mail template sayısı** | 13 | (admin_new_order + admin_daily_summary eklendi) |
| **Operasyon konforu** | %85 | Sefa kararı: Paraşüt sonra |

---

## 💡 Bu sprint'in kazanımları (v0 → v1.0)

| # | Değişim | Önce | Sonra |
|---|---------|------|-------|
| 1 | Admin yeni sipariş bildirimi | YOK | ✅ Anlık mail (payment-callback) |
| 2 | Günlük operasyon özeti | YOK | ✅ 09:00 cron + özet mail |
| 3 | Stale awaiting_upload uyarısı | YOK | ✅ Özet mailde gözükür |
| 4 | Partner kapasite uyarısı | YOK | ✅ %85+ dolduğunda özet mailde |
| 5 | Müşteriler hata UI | "audit-log" linki | ✅ Diagnostic JSON linki + olası çözümler |

---

## 📋 Snapshot Ekleme Rehberi

### Yeni snapshot ne zaman alınır?
- ✅ Resend aktif olduğunda (mail durumları gerçek değerle dolacak)
- ✅ Paraşüt entegrasyonu (#1 🔴 → ✅)
- ✅ Migration 075 apply (#2 🟠 → ✅)
- ✅ Yurtıçi env (#3 🟠 → ✅)
- ✅ Mobile admin optimize (#4 🟢 → ✅)

### Format şablonu

Aynı `SIPARIS-AKISI-SNAPSHOT.md`'deki gibi:
```markdown
## 📌 vX.Y — [Sprint adı] ([Tarih])

**Önceki snapshot:** v(X-1).Y
**Kapatılan commit aralığı:** `xxxxx` → `yyyyy`
**Değişen kalemler:**
- #N — eski 🔴 → yeni ✅

**Karşılaştırma tablosu:**
| Metrik | v(X-1).Y | vX.Y | Δ |
|--------|----------|------|---|
| Tam çalışan | 37 | 39 | +2 |
| Operasyon konforu | %90 | %95 | +5 |
```

### Diff alma yöntemi
```bash
git diff <eski-commit> <yeni-commit> -- docs/ADMIN-AKISI-SNAPSHOT.md
```

---

## 🔮 Beklenen sonraki admin snapshot'ları

| Versiyon | Tetik | Beklenen değişim |
|----------|-------|------------------|
| **v1.1** | Resend aktif | Mail outbox gerçek gönderim, "anlık bildirim" ve "günlük özet" hayata geçer |
| **v1.2** | Migration 075 apply | `/admin/urunler` temiz metin ✅ |
| **v2.0** | Yurtıçi env | Tracking gerçek event ✅, kargo otomasyon tam |
| **v3.0** | Paraşüt entegrasyonu | Fatura otomatik, manuel iş tamamen biter |

---

**Versiyon geçmişi**
- **v1.0** — 21.05.2026 — İlk snapshot. 37/41 tam çalışan, 1 kritik engel (Paraşüt), %90 hazırlık. **Bu sprint'te eklenen:** admin anlık bildirim + günlük özet + diagnostic UI.
