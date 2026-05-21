# 🎬 Sipariş Akışı Snapshot — v1.0

> **Snapshot tarihi:** 21 Mayıs 2026 v68
> **Amaç:** Müşteri tarafı sipariş akışının uçtan uca **anlık fotoğrafı**.
> İlerideki snapshot'lar (v1.1, v2.0...) bu dosyaya eklenir; **diff**
> alarak nerede ne ilerlemiş, neyin gerilemiş görülür.
>
> Yeni snapshot eklerken: [aşağıdaki "Snapshot ekleme rehberi"](#-snapshot-ekleme-rehberi) bölümüne bak.

---

## 📌 v1.0 — Pre-Launch Hazırlık Anı

**Kapatılan commit aralığı:** `e6a193a` (Faz 2 grid) → `6acac3c` (launch-ready hazırlık)
**Toplam commit:** 50+
**Hazırlık seviyesi:** %85

---

### Bütün adım tablosu (21 adım)

| # | Adım | Tetikleyici | Durum | Şu an gerçekte ne olur |
|---|------|-------------|-------|-----------------------|
| 1 | Anasayfa ziyareti | Müşteri pimetiket.com'a girer | ✅ | Hero görseli + Pim chat balonu |
| 2 | Çerez bandı | İlk ziyaret + 800ms | ✅ | Modal çıkar, Reddet=Kabul eşit boyut |
| 3 | /etiket veya /sticker liste | Tıklama | ✅ | 11+11 kart DB'den (encoding fallback aktif) |
| 4 | Konfigüratör | Karttan giriş | ✅ | Doğru başlık + Şeffaf material preselect |
| 5 | Fiyat hesabı | Boyut/adet seçim | ✅ | Anlık (admin live_config + quantize) |
| 6 | Sepete ekle | CTA tıklama | ✅ | LocalStorage + DB sync (login varsa) |
| 7 | /sepet | Sayfa açılır | ✅ | Tasarım preview + KDV ayrı + düzenle |
| 8 | /odeme | "Ödemeye geç" | 🟠 | Fatura formu, e-arşiv (manuel kesim) |
| 9 | **PayTR iframe** | Form submit | 🔴 **TEST MODE** | Sahte kartlar, gerçek tahsilat YOK |
| 10 | Callback | Banka 3D sonrası | ✅ | HMAC verify + idempotency + reconciler cron |
| 11 | Sipariş oluşur | DB'ye yazılır | ✅ | Statü `paid` / `awaiting_upload` |
| 12 | **Onay maili** | enqueueMail | 🔴 **mail_outbox'ta bekler** | Resend env yok → gönderim yok |
| 13 | Tasarım yükleme | (yoksa) `/siparis/[id]/tasarim-yukle` | ✅ | PSD/AI/PDF preview + Supabase upload |
| 14 | AI QC | Otomatik | ✅ | OpenAI, DPI/CMYK/kenar kontrolü |
| 15 | Prova hazır | proof_generating → proof_pending | ✅ | /onay sayfası, geri sayım, düzenle/onayla |
| 16 | Prova maili | enqueueMail | 🔴 mail_outbox | Aynı sebep |
| 17 | Üretim atama | Müşteri onayı sonrası | ✅ | Admin → /admin/fason → auto-assign |
| 18 | Kargo | "Kargoya verildi" | 🟠 | Etiket PDF + tracking no manuel (DRY_RUN) |
| 19 | Tracking polling | 5 dk cron | 🟠 | Sahte event üretir (env yok) |
| 20 | Teslim mail/SMS | tracking_delivered_at | 🔴 mail outbox | Müşteri haberdar olmaz |
| 21 | Fatura | Sefa manuel | 🟡 | E-arşiv arayüzde, Paraşüt yok |

**Skor:** 12 ✅ · 4 🟠 · 4 🔴 · 1 🟡

---

### Müşteri senaryosu — "Ayşe Hanım'ın 7 günlük öyküsü"

Bal etiketi siparişi için, bugün siparişe başlayan bir müşteri:

| Gün/Saat | Olay | Sistem davranışı |
|----------|------|------------------|
| Pazartesi 14:30 | Konfigüratör (Şeffaf rulo, 1.000 adet, 60×80mm) | ✅ Fiyat 2.510 ₺ |
| 14:35 | Sepete ekler, ödeme → kart girer | 🔴 PayTR test → gerçek tahsilat yok |
| 14:36 | "Tasarımı sonra yükle" der | ✅ awaiting_upload statüsü |
| 14:37 | **Onay maili bekler** | 🔴 Gelmez — "siparişim oldu mu?" stresi |
| 14:40 | /siparislerim sayfasına bakar | ✅ Sipariş listede görünür |
| Salı 10:00 | Tasarımı hazırlar, yükler | ✅ PSD preview ✓ |
| 10:01 | AI QC | ✅ "300 DPI ✓, CMYK ✗ otomatik dönüşür" |
| 10:05 | /onay sayfası — prova | ✅ Lightbox + onayla |
| 10:06 | **Prova hazır maili bekler** | 🔴 Gelmez |
| 10:10 | Onaylar | ✅ Üretime düşer |
| Salı 15:00 | Sefa admin'de görür | 🟠 Sefa kendisi açıp bakacak |
| Çarşamba | Üretime gönderir | ✅ /admin/fason |
| Çarş. akşam | Operatör mail alır | ✅ (fason mail outbox ayrı) |
| Pazartesi | Üretim tamam, kargoya | 🟠 PDF + manuel takip no |
| Salı | Tracking sahte event | 🟠 in_transit gözükür |
| Çarşamba | Teslim | ✅ Manuel `delivered` |
| Çarşamba | **Teslim maili bekler** | 🔴 Gelmez |

**3 kritik müşteri sorunu:**
1. Hiçbir mail almaz → panik
2. Tracking sahte → gerçek yer bilinmez
3. Fatura için telefon eder

**1 kritik Sefa sorunu:**
- Yeni sipariş bildirimi yok → admin sürekli açık

---

### Mermaid akış diyagramı

```mermaid
graph LR
    M[Müşteri] -->|tıklar| A[Anasayfa ✅]
    A -->|konfigüre| B[Konfigüratör ✅]
    B -->|sepet| C[Sepet ✅]
    C -->|öde| D[PayTR 🔴<br/>TEST MODE]
    D -->|callback| E[Sipariş ✅]
    E -.->|mail| F[Resend 🔴<br/>env yok]
    F -.x M
    E -->|tasarım| G[Upload ✅]
    G -->|AI QC| H[OpenAI ✅]
    H -->|prova| I[/onay ✅]
    I -->|onay| J[Üretim ✅]
    J -->|kargo| K[Yurtıçi 🟠<br/>DRY_RUN]
    K -.->|tracking| L[Sahte event 🟠]
    L -.x M
    K -->|teslim| N[delivered ✅]
    N -.->|fatura| O[Paraşüt 🔴<br/>yok]
    O -.x M

    classDef ok fill:#d1fae5,stroke:#059669
    classDef warn fill:#fef3c7,stroke:#f59e0b
    classDef err fill:#fee2e2,stroke:#dc2626
    class A,B,C,E,G,H,I,J,N ok
    class K,L warn
    class D,F,O err
```

---

### 🚨 Kritik engeller (snapshot v1.0)

#### 🔴 Sipariş alımını TEHLİKEYE atan
| # | Engel | Çözüm | Süre |
|---|-------|-------|------|
| 1 | PayTR test modunda | `PAYTR_TEST_MODE=0` + canlı creds | 1 sa |
| 2 | Resend yok | `docs/RESEND-SETUP.md` | 30 dk |
| 3 | Telefon yok | Sefa numarayı söyleyecek | 30 dk |

#### 🟠 Operasyonu zorlaştıran
| # | Engel | Çözüm |
|---|-------|-------|
| 4 | Yurtıçi DRY_RUN | Anlaşma sonrası env |
| 5 | Paraşüt yok — fatura manuel | İlk siparişlerde elle veya API |
| 6 | Admin yeni sipariş bildirimi yok | Mail template ekle (15 dk) |

#### 🟡 Veri kalitesi
| # | Engel | Çözüm |
|---|-------|-------|
| 7 | DB encoding bozuk (admin görüyor) | Migration 075 apply (5 dk) |
| 8 | Müşteriler CRM API prod debug | `/api/admin/customers/diagnostic` |

---

### 📊 Ölçülebilir metrikler (v1.0 baseline)

| Metrik | Değer | Yorum |
|--------|-------|-------|
| Tam çalışan adım | **12/21** | %57 — kabul edilebilir baseline |
| Kısmi çalışan adım | **4/21** | %19 |
| Çalışmayan adım | **4/21** | %19 |
| Manuel müdahale | **1/21** | %5 (fatura) |
| **Müşteri-engeli** | **3** | mail/tracking/fatura |
| **Sipariş alımı engeli** | **1** | PayTR test |
| **Yasal eksik** | **1** | telefon |
| **Genel hazırlık** | **%85** | Sefa kendi tahmini |

---

### 🎯 "Bugün canlıya geç" minimum paketi

```
1. PAYTR_TEST_MODE=0 + canlı creds       (1 sa)
2. RESEND_API_KEY + RESEND_FROM_EMAIL    (30 dk)
3. Telefon numarası → 6 dosya            (30 dk)
4. Migration 075 apply                    (5 dk)
─────────────────────────────────────────
TOPLAM: ~2.5 saat → canlı satışa hazır
```

**Bu pakette kabul edilebilir kayıp:**
- ❌ Yurtıçi otomatik tracking → manuel takip
- ❌ Paraşüt fatura → ilk 10-20 sipariş manuel kesim
- ❌ Admin yeni sipariş bildirimi → günde 2x manuel açış

---

## 📋 Snapshot Ekleme Rehberi

### Yeni snapshot ne zaman alınır?
- ✅ Resend aktif olduğunda (mail durumları değişir)
- ✅ PayTR canlıya geçince (#9 + #12 + #16 + #20 hepsi etkilenir)
- ✅ Yurtıçi anlaşma + env tamam (#18 + #19 değişir)
- ✅ Paraşüt entegrasyonu (#21 değişir)
- ✅ Her launch sprint sonunda (post-launch v2.0, v3.0...)

### Format şablonu

Yeni bölüm ekle:
```markdown
## 📌 vX.Y — [Sprint adı] ([Tarih])

**Önceki snapshot:** v(X-1).Y
**Kapatılan commit aralığı:** `xxxxx` → `yyyyy`
**Değişen adımlar:**
- #N — eski 🔴 → yeni ✅ (Resend aktif)
- #M — eski 🟠 → yeni ✅ (Yurtıçi anlaşma)

**Yeni metrik:**
| Metrik | v(X-1).Y | vX.Y | Δ |
|--------|----------|------|---|
| Tam çalışan | 12 | 16 | +4 |
| Müşteri-engeli | 3 | 1 | -2 |
| Genel hazırlık | %85 | %93 | +8 |

**Müşteri senaryosu değişiklikleri:**
- Pazartesi 14:37 — "Onay maili gelir" (eskiden gelmiyordu)
- Çarşamba — "Teslim SMS'i gelir"

**Karar/Riskler:**
- ...
```

### Diff alma yöntemi

```bash
# Git ile snapshot karşılaştırması
git diff <eski-commit> <yeni-commit> -- docs/SIPARIS-AKISI-SNAPSHOT.md
```

---

## 🔮 Beklenen sonraki snapshot'lar

| Versiyon | Tetik | Beklenen değişim |
|----------|-------|------------------|
| **v1.1** | Resend + telefon aktif (~2 saat iş) | 🔴 mail engelleri ✅, müşteri-engeli 3 → 1 |
| **v2.0** | PayTR canlı + Migration 075 (~1 saat) | Sipariş alımı engeli 1 → 0, hazırlık %85 → %95 |
| **v2.1** | Yurtıçi anlaşma (1-2 hafta sonra) | 🟠 kargo engelleri ✅ |
| **v3.0** | Paraşüt API entegrasyonu (post-launch sprint) | 🟡 fatura otomatik, manuel iş tamamen biter |

---

**Bu snapshot'un hedefi:** İlk gerçek müşteri siparişi gelmeden önce
"şu an gerçekte ne çalışıyor / ne çalışmıyor" net görünür olsun. v1.1
ekleyince baseline ile farkı somut sayılarla görebiliyoruz.

---

**Versiyon geçmişi**
- **v1.0** — 21.05.2026 — İlk snapshot. 12/21 tam çalışan, 4 kritik engel, %85 hazırlık.
